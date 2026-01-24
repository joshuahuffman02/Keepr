import { Injectable, Logger, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * AI access tiers for onboarding sessions
 */
export type AiAccessTier = "none" | "trial" | "full" | "blocked";

/**
 * AI access level information
 */
export interface AiAccessLevel {
  tier: AiAccessTier;
  aiCallsUsed: number;
  aiCallsRemaining: number | null; // null = unlimited
  reason?: string;
  canMakeAiCall: boolean;
  emailVerified: boolean;
  progressPercent: number;
}

/**
 * Abuse detection signals with weights
 */
interface AbuseSignal {
  type: string;
  weight: number;
  description: string;
  detected: boolean;
}

/**
 * Constants for token gate configuration
 */
const TRIAL_AI_CALLS_LIMIT = 5;
const FULL_ACCESS_PROGRESS_THRESHOLD = 50; // 50% progress unlocks full access
const ABUSE_THRESHOLD = 0.7; // Block if abuse weight >= 0.7
const RAPID_CALLS_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RAPID_CALLS_THRESHOLD = 10;
const STALE_SESSION_HOURS = 24;
const UPLOAD_SPAM_THRESHOLD = 10;

/**
 * Cost per 1000 tokens in cents for onboarding AI usage tracking
 */
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.25, output: 1.0 },
  "gpt-4o-mini": { input: 0.015, output: 0.06 },
  "gpt-4-turbo": { input: 1.0, output: 3.0 },
  "text-embedding-3-small": { input: 0.002, output: 0 },
};

@Injectable()
export class OnboardingTokenGateService {
  private readonly logger = new Logger(OnboardingTokenGateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check the current AI access level for an onboarding session
   */
  async checkAccess(sessionId: string): Promise<AiAccessLevel> {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        emailVerified: true,
        emailVerifiedAt: true,
        aiCallsUsed: true,
        aiAccessTier: true,
        lastAiCallAt: true,
        completedSteps: true,
        status: true,
      },
    });

    if (!session) {
      return {
        tier: "none",
        aiCallsUsed: 0,
        aiCallsRemaining: 0,
        reason: "Session not found",
        canMakeAiCall: false,
        emailVerified: false,
        progressPercent: 0,
      };
    }

    // Calculate progress
    const totalSteps = 26; // ONBOARDING_TOTAL_STEPS
    const progressPercent = Math.round((session.completedSteps.length / totalSteps) * 100);

    // If blocked, stay blocked
    if (session.aiAccessTier === "blocked") {
      return {
        tier: "blocked",
        aiCallsUsed: session.aiCallsUsed,
        aiCallsRemaining: 0,
        reason: "AI access has been blocked due to abuse detection",
        canMakeAiCall: false,
        emailVerified: session.emailVerified,
        progressPercent,
      };
    }

    // Not email verified - no AI access
    if (!session.emailVerified) {
      return {
        tier: "none",
        aiCallsUsed: session.aiCallsUsed,
        aiCallsRemaining: 0,
        reason: "Please verify your email to unlock AI-assisted import",
        canMakeAiCall: false,
        emailVerified: false,
        progressPercent,
      };
    }

    // Check for full access eligibility
    const hasFullAccess =
      session.aiAccessTier === "full" || progressPercent >= FULL_ACCESS_PROGRESS_THRESHOLD;

    if (hasFullAccess) {
      // Upgrade tier if needed
      if (session.aiAccessTier !== "full") {
        await this.prisma.onboardingSession.update({
          where: { id: sessionId },
          data: { aiAccessTier: "full" },
        });
      }

      return {
        tier: "full",
        aiCallsUsed: session.aiCallsUsed,
        aiCallsRemaining: null, // unlimited
        canMakeAiCall: true,
        emailVerified: true,
        progressPercent,
      };
    }

    // Trial tier - limited calls
    const remaining = Math.max(0, TRIAL_AI_CALLS_LIMIT - session.aiCallsUsed);

    return {
      tier: "trial",
      aiCallsUsed: session.aiCallsUsed,
      aiCallsRemaining: remaining,
      reason:
        remaining === 0
          ? "Trial limit reached. Complete more steps to unlock unlimited AI assistance."
          : undefined,
      canMakeAiCall: remaining > 0,
      emailVerified: true,
      progressPercent,
    };
  }

  /**
   * Record an AI call and update usage counters
   */
  async recordAiCall(
    sessionId: string,
    featureType: string,
    inputTokens: number,
    outputTokens: number,
    modelUsed: string,
    success: boolean,
    errorType?: string,
  ): Promise<void> {
    // Calculate cost
    const costCents = this.calculateCost(inputTokens, outputTokens, modelUsed);

    await this.prisma.$transaction([
      // Update session counters
      this.prisma.onboardingSession.update({
        where: { id: sessionId },
        data: {
          aiCallsUsed: { increment: 1 },
          lastAiCallAt: new Date(),
        },
      }),
      // Log the usage
      this.prisma.onboardingAiUsage.create({
        data: {
          sessionId,
          featureType,
          inputTokens,
          outputTokens,
          costCents,
          modelUsed,
          success,
          errorType,
        },
      }),
    ]);

    this.logger.log(
      `AI call recorded: session=${sessionId}, feature=${featureType}, ` +
        `tokens=${inputTokens + outputTokens}, cost=${costCents}¢, success=${success}`,
    );
  }

  /**
   * Check if session shows abuse patterns
   */
  async isAbusePattern(sessionId: string): Promise<{ isAbuse: boolean; signals: AbuseSignal[] }> {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        emailVerified: true,
        emailVerifiedAt: true,
        aiCallsUsed: true,
        lastAiCallAt: true,
        completedSteps: true,
        createdAt: true,
        importDrafts: {
          select: {
            id: true,
            status: true,
          },
        },
        aiUsageLogs: {
          select: {
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: RAPID_CALLS_THRESHOLD + 1,
        },
      },
    });

    if (!session) {
      return { isAbuse: false, signals: [] };
    }

    const signals: AbuseSignal[] = [];
    const now = new Date();

    // Signal 1: Rapid calls without saves
    const recentCalls = session.aiUsageLogs.filter(
      (log) => now.getTime() - log.createdAt.getTime() < RAPID_CALLS_WINDOW_MS,
    );
    const rapidCallsDetected = recentCalls.length >= RAPID_CALLS_THRESHOLD;
    signals.push({
      type: "rapid_calls",
      weight: 0.3,
      description: `> ${RAPID_CALLS_THRESHOLD} AI calls in 5 minutes`,
      detected: rapidCallsDetected,
    });

    // Signal 2: AI calls without corresponding saves
    const noSavesRatio = session.aiCallsUsed > 0 && session.completedSteps.length === 0;
    signals.push({
      type: "no_saves",
      weight: 0.4,
      description: "AI calls without completing any onboarding steps",
      detected: noSavesRatio && session.aiCallsUsed >= 3,
    });

    // Signal 3: Stale session (verified but no progress)
    const hoursSinceVerification = session.emailVerifiedAt
      ? (now.getTime() - session.emailVerifiedAt.getTime()) / (1000 * 60 * 60)
      : 0;
    const isStale =
      session.emailVerified &&
      hoursSinceVerification > STALE_SESSION_HOURS &&
      session.completedSteps.length === 0 &&
      session.aiCallsUsed > 0;
    signals.push({
      type: "stale_session",
      weight: 0.2,
      description: "Email verified but no progress in 24h with AI usage",
      detected: isStale,
    });

    // Signal 4: Upload spam without imports
    const uploadCount = session.importDrafts.length;
    const importedCount = session.importDrafts.filter((d) => d.status === "imported").length;
    const uploadSpam = uploadCount >= UPLOAD_SPAM_THRESHOLD && importedCount === 0;
    signals.push({
      type: "upload_spam",
      weight: 0.3,
      description: `> ${UPLOAD_SPAM_THRESHOLD} uploads without any imports`,
      detected: uploadSpam,
    });

    // Calculate total weight
    const totalWeight = signals.filter((s) => s.detected).reduce((sum, s) => sum + s.weight, 0);

    const isAbuse = totalWeight >= ABUSE_THRESHOLD;

    // If abuse detected, block the session
    if (isAbuse) {
      await this.prisma.onboardingSession.update({
        where: { id: sessionId },
        data: { aiAccessTier: "blocked" },
      });
      this.logger.warn(
        `Abuse detected and session blocked: ${sessionId}, weight=${totalWeight}, ` +
          `signals=${signals
            .filter((s) => s.detected)
            .map((s) => s.type)
            .join(", ")}`,
      );
    }

    return { isAbuse, signals };
  }

  /**
   * Require AI access or throw forbidden
   */
  async requireAiAccess(sessionId: string): Promise<AiAccessLevel> {
    // First check for abuse
    const { isAbuse } = await this.isAbusePattern(sessionId);
    if (isAbuse) {
      throw new ForbiddenException("AI access has been blocked due to unusual activity patterns");
    }

    const access = await this.checkAccess(sessionId);

    if (!access.canMakeAiCall) {
      throw new ForbiddenException(access.reason || "AI access not available");
    }

    return access;
  }

  /**
   * Generate a 6-digit verification code
   */
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Set up email verification for a session
   */
  async initiateEmailVerification(sessionId: string): Promise<{ code: string; expiresAt: Date }> {
    const code = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        emailVerifyCode: code,
        emailVerifyExpiry: expiresAt,
      },
    });

    return { code, expiresAt };
  }

  /**
   * Verify the email code and unlock AI access
   */
  async verifyEmailCode(sessionId: string, code: string): Promise<boolean> {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      select: {
        emailVerifyCode: true,
        emailVerifyExpiry: true,
        emailVerified: true,
      },
    });

    if (!session) {
      return false;
    }

    // Already verified
    if (session.emailVerified) {
      return true;
    }

    // Check code and expiry
    if (!session.emailVerifyCode || !session.emailVerifyExpiry) {
      return false;
    }

    const isExpired = new Date() > session.emailVerifyExpiry;
    const isMatch = session.emailVerifyCode === code;

    if (!isMatch || isExpired) {
      return false;
    }

    // Mark as verified
    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerifyCode: null,
        emailVerifyExpiry: null,
        aiAccessTier: "trial",
      },
    });

    this.logger.log(`Email verified for session: ${sessionId}`);
    return true;
  }

  /**
   * Calculate cost in cents for token usage
   */
  private calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    const costs = MODEL_COSTS[model] || MODEL_COSTS["gpt-4o-mini"];
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    return Math.round((inputCost + outputCost) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get platform-wide AI usage stats for onboarding (admin use)
   */
  async getPlatformUsageStats(startDate: Date, endDate: Date) {
    const usage = await this.prisma.onboardingAiUsage.aggregate({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costCents: true,
      },
      _count: { id: true },
    });

    const successRate = await this.prisma.onboardingAiUsage.groupBy({
      by: ["success"],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    const byFeature = await this.prisma.onboardingAiUsage.groupBy({
      by: ["featureType"],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { costCents: true, inputTokens: true, outputTokens: true },
      _count: true,
    });

    return {
      totalCostCents: usage._sum.costCents || 0,
      totalInputTokens: usage._sum.inputTokens || 0,
      totalOutputTokens: usage._sum.outputTokens || 0,
      totalRequests: usage._count.id,
      successRate: this.calculateSuccessRate(successRate),
      byFeature: byFeature.map((f) => ({
        feature: f.featureType,
        costCents: f._sum.costCents || 0,
        requests: f._count,
        inputTokens: f._sum.inputTokens || 0,
        outputTokens: f._sum.outputTokens || 0,
      })),
    };
  }

  private calculateSuccessRate(groups: Array<{ success: boolean; _count: number }>): number {
    const total = groups.reduce((sum, g) => sum + g._count, 0);
    if (total === 0) return 100;
    const successCount = groups.find((g) => g.success)?._count || 0;
    return Math.round((successCount / total) * 100);
  }
}
