import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { OnboardingStep } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Issue that blocks or warns about launching
 */
export interface GoLiveIssue {
  code: string;
  message: string;
  stepToFix: string;
  autoFixable: boolean;
  severity: "blocker" | "warning";
}

/**
 * Result of go-live check
 */
export interface GoLiveCheckResult {
  canLaunch: boolean;
  blockers: GoLiveIssue[];
  warnings: GoLiveIssue[];
  completionPercent: number;
  requirements: {
    sitesExist: boolean;
    ratesSet: boolean;
    depositPolicySet: boolean;
    teamMemberExists: boolean;
    stripeConnected: boolean;
    emailTemplatesConfigured: boolean;
    cancellationPolicySet: boolean;
    taxRulesConfigured: boolean;
  };
}

/**
 * Service to validate all requirements before a campground can go live
 */
@Injectable()
export class OnboardingGoLiveCheckService {
  private readonly logger = new Logger(OnboardingGoLiveCheckService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a campground is ready to go live
   */
  async check(sessionId: string): Promise<GoLiveCheckResult> {
    // Get session with related data
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        campgroundId: true,
        completedSteps: true,
        data: true,
        status: true,
      },
    });

    if (!session) {
      throw new BadRequestException("Session not found");
    }

    if (!session.campgroundId) {
      return this.buildResult(
        false,
        0,
        {
          sitesExist: false,
          ratesSet: false,
          depositPolicySet: false,
          teamMemberExists: false,
          stripeConnected: false,
          emailTemplatesConfigured: false,
          cancellationPolicySet: false,
          taxRulesConfigured: false,
        },
        [
          {
            code: "NO_CAMPGROUND",
            message: "Please complete the Park Profile to create your campground",
            stepToFix: "park_profile",
            autoFixable: false,
            severity: "blocker",
          },
        ],
        [],
      );
    }

    // Get campground with related data
    const campground = await this.prisma.campground.findUnique({
      where: { id: session.campgroundId },
      select: {
        id: true,
        stripeAccountId: true,
        Site: {
          where: { status: { not: "maintenance" } },
          select: { id: true },
          take: 1,
        },
        SiteClass: {
          select: {
            id: true,
            defaultRate: true,
          },
        },
        CampgroundMembership: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!campground) {
      throw new BadRequestException("Campground not found");
    }

    const sessionData = isRecord(session.data) ? session.data : {};
    const completedSteps = new Set<OnboardingStep>(session.completedSteps ?? []);

    // Check requirements
    const requirements = {
      sitesExist: campground.Site.length > 0,
      ratesSet: campground.SiteClass.every((sc) => (sc.defaultRate ?? 0) > 0),
      depositPolicySet:
        !!sessionData.deposit_policy || completedSteps.has(OnboardingStep.deposit_policy),
      teamMemberExists:
        campground.CampgroundMembership.length > 0 || completedSteps.has(OnboardingStep.team_setup),
      stripeConnected: !!campground.stripeAccountId,
      emailTemplatesConfigured: completedSteps.has(OnboardingStep.communication_setup),
      cancellationPolicySet: completedSteps.has(OnboardingStep.cancellation_rules),
      taxRulesConfigured: completedSteps.has(OnboardingStep.tax_rules),
    };

    const blockers: GoLiveIssue[] = [];
    const warnings: GoLiveIssue[] = [];

    // === Required Checks (Blockers) ===

    if (!requirements.sitesExist) {
      blockers.push({
        code: "NO_SITES",
        message: "Add at least one campsite to accept reservations",
        stepToFix: "sites_builder",
        autoFixable: false,
        severity: "blocker",
      });
    }

    if (!requirements.ratesSet) {
      blockers.push({
        code: "NO_RATES",
        message: "Set base rates for all site classes",
        stepToFix: "rates_setup",
        autoFixable: false,
        severity: "blocker",
      });
    }

    if (!requirements.depositPolicySet) {
      blockers.push({
        code: "NO_DEPOSIT_POLICY",
        message: "Configure your deposit policy for collecting payments",
        stepToFix: "deposit_policy",
        autoFixable: false,
        severity: "blocker",
      });
    }

    if (!requirements.teamMemberExists) {
      blockers.push({
        code: "NO_TEAM",
        message: "Add at least one team member or skip this step",
        stepToFix: "team_setup",
        autoFixable: false,
        severity: "blocker",
      });
    }

    // === Recommended Checks (Warnings) ===

    if (!requirements.stripeConnected) {
      warnings.push({
        code: "NO_STRIPE",
        message: "Connect Stripe to accept online payments",
        stepToFix: "stripe_connect",
        autoFixable: false,
        severity: "warning",
      });
    }

    if (!requirements.emailTemplatesConfigured) {
      warnings.push({
        code: "NO_EMAIL_TEMPLATES",
        message: "Set up email templates for automated guest communications",
        stepToFix: "communication_setup",
        autoFixable: false,
        severity: "warning",
      });
    }

    if (!requirements.cancellationPolicySet) {
      warnings.push({
        code: "NO_CANCELLATION_POLICY",
        message: "Configure cancellation and refund policies",
        stepToFix: "cancellation_rules",
        autoFixable: false,
        severity: "warning",
      });
    }

    if (!requirements.taxRulesConfigured) {
      warnings.push({
        code: "NO_TAX_RULES",
        message: "Set up tax rules for your location",
        stepToFix: "tax_rules",
        autoFixable: false,
        severity: "warning",
      });
    }

    // Calculate completion percent (26 total steps)
    const completionPercent = Math.round((completedSteps.size / 26) * 100);

    return this.buildResult(
      blockers.length === 0,
      completionPercent,
      requirements,
      blockers,
      warnings,
    );
  }

  /**
   * Get a summary of what's left to complete
   */
  async getSummary(sessionId: string): Promise<{
    ready: boolean;
    blockersCount: number;
    warningsCount: number;
    nextStep: string | null;
  }> {
    const result = await this.check(sessionId);

    // Determine next step to fix
    let nextStep: string | null = null;
    if (result.blockers.length > 0) {
      nextStep = result.blockers[0].stepToFix;
    } else if (result.warnings.length > 0) {
      nextStep = result.warnings[0].stepToFix;
    }

    return {
      ready: result.canLaunch,
      blockersCount: result.blockers.length,
      warningsCount: result.warnings.length,
      nextStep,
    };
  }

  private buildResult(
    canLaunch: boolean,
    completionPercent: number,
    requirements: GoLiveCheckResult["requirements"],
    blockers: GoLiveIssue[],
    warnings: GoLiveIssue[],
  ): GoLiveCheckResult {
    return {
      canLaunch,
      blockers,
      warnings,
      completionPercent,
      requirements,
    };
  }
}
