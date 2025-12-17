import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { IdempotencyStatus, OnboardingStatus, OnboardingStep } from "@prisma/client";
import { instanceToPlain, plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { ONBOARDING_STEP_ORDER, ONBOARDING_TOTAL_STEPS, OnboardingStepKey } from "./onboarding.constants";
import {
  AccountProfileDto,
  CommunicationsTemplatesDto,
  CreateOnboardingInviteDto,
  ImportsDto,
  InventorySitesDto,
  PaymentGatewayDto,
  PoliciesDto,
  RatesAndFeesDto,
  StartOnboardingDto,
  TaxesAndFeesDto
} from "./dto";

type OnboardingPayload =
  | AccountProfileDto
  | PaymentGatewayDto
  | TaxesAndFeesDto
  | InventorySitesDto
  | RatesAndFeesDto
  | PoliciesDto
  | CommunicationsTemplatesDto
  | ImportsDto;

const STEP_VALIDATORS: Record<OnboardingStepKey, any> = {
  account_profile: AccountProfileDto,
  payment_gateway: PaymentGatewayDto,
  taxes_and_fees: TaxesAndFeesDto,
  inventory_sites: InventorySitesDto,
  rates_and_fees: RatesAndFeesDto,
  policies: PoliciesDto,
  communications_templates: CommunicationsTemplatesDto,
  pos_hardware: PoliciesDto, // reuse lightweight validator
  imports: ImportsDto,
};

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly idempotency: IdempotencyService,
  ) { }

  async createInvite(dto: CreateOnboardingInviteDto, actor?: any) {
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + ((dto.expiresInHours ?? 72) * 60 * 60 * 1000));

    const invite = await this.prisma.onboardingInvite.create({
      data: {
        email: dto.email,
        organizationId: dto.organizationId ?? null,
        campgroundId: dto.campgroundId ?? null,
        invitedById: actor?.id ?? null,
        token,
        expiresAt,
        lastSentAt: new Date(),
      }
    });

    await this.sendInviteEmail(invite.token, invite.email, dto.campgroundName ?? "your campground", expiresAt);

    return { inviteId: invite.id, token, expiresAt };
  }

  async resendInvite(inviteId: string, actor?: any) {
    const existing = await this.prisma.onboardingInvite.findUnique({ where: { id: inviteId } });
    if (!existing) throw new UnauthorizedException("Invite not found");

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const invite = await this.prisma.onboardingInvite.update({
      where: { id: inviteId },
      data: {
        token,
        expiresAt,
        lastSentAt: new Date(),
        invitedById: actor?.id ?? existing.invitedById ?? null,
      }
    });

    await this.sendInviteEmail(token, invite.email, "your campground", expiresAt);
    return { inviteId: invite.id, token, expiresAt };
  }

  async startSession(input: StartOnboardingDto) {
    const invite = await this.requireInvite(input.token);

    const session = invite.session ?? await this.prisma.onboardingSession.create({
      data: {
        inviteId: invite.id,
        organizationId: invite.organizationId ?? null,
        campgroundId: invite.campgroundId ?? null,
        status: OnboardingStatus.in_progress,
        currentStep: OnboardingStep.account_profile,
        completedSteps: [],
        expiresAt: invite.expiresAt,
      },
    });

    if (!invite.redeemedAt) {
      await this.prisma.onboardingInvite.update({
        where: { id: invite.id },
        data: { redeemedAt: new Date() }
      }).catch(() => null);
    }

    const progress = this.buildProgress(session);
    return { session, progress };
  }

  async getSession(sessionId: string, token: string) {
    const session = await this.requireSession(sessionId, token);
    const progress = this.buildProgress(session);
    return { session, progress };
  }

  async saveStep(
    sessionId: string,
    token: string,
    step: OnboardingStep,
    payload: any,
    idempotencyKey?: string,
    sequence?: string | number | null,
  ) {
    const session = await this.requireSession(sessionId, token);
    const scope = { campgroundId: session.campgroundId ?? null, tenantId: session.organizationId ?? null };
    const existing = await this.guardIdempotency(idempotencyKey, { step, payload }, scope, `onboarding/${step}`, sequence);
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) {
      return existing.responseJson;
    }
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Onboarding step already in progress");
    }

    const sanitized = this.validatePayload(step, payload);
    const completed = new Set(session.completedSteps ?? []);
    completed.add(step);

    const progress = this.buildProgress({
      ...session,
      currentStep: step,
      completedSteps: Array.from(completed),
      data: { ...(session.data as any ?? {}), [step]: sanitized },
    });

    const nextStatus = progress.remainingSteps.length === 0 ? OnboardingStatus.completed : OnboardingStatus.in_progress;

    const updated = await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        currentStep: progress.nextStep ?? step,
        completedSteps: Array.from(completed),
        status: nextStatus,
        data: { ...(session.data as any ?? {}), [step]: sanitized },
        progress,
      }
    });

    const response = { session: updated, progress };
    if (idempotencyKey) await this.idempotency.complete(idempotencyKey, response);
    return response;
  }

  private buildProgress(session: any) {
    const completed = new Set<OnboardingStep>(session.completedSteps ?? []);
    const nextStep = ONBOARDING_STEP_ORDER.find((s) => !completed.has(s)) ?? null;
    const percentage = Math.round((completed.size / ONBOARDING_TOTAL_STEPS) * 100);

    return {
      currentStep: session.currentStep ?? OnboardingStep.account_profile,
      nextStep,
      completedSteps: Array.from(completed),
      remainingSteps: ONBOARDING_STEP_ORDER.filter((s) => !completed.has(s)),
      percentage,
    };
  }

  private validatePayload(step: OnboardingStep, payload: any): OnboardingPayload {
    const dtoClass = STEP_VALIDATORS[step];
    if (!dtoClass) return payload;

    const instance = plainToInstance(dtoClass, payload ?? {}, { enableImplicitConversion: true });
    const errors = validateSync(instance, { whitelist: true, forbidUnknownValues: true });
    if (errors.length > 0) {
      const detail = errors
        .flatMap((err) => Object.values(err.constraints ?? {}))
        .filter(Boolean)
        .join(", ");
      throw new BadRequestException(`Invalid payload for ${step}: ${detail || "validation failed"}`);
    }
    return instanceToPlain(instance) as OnboardingPayload;
  }

  private async requireInvite(token: string) {
    const invite = await this.prisma.onboardingInvite.findUnique({
      where: { token },
      include: { session: true },
    });
    if (!invite || invite.expiresAt < new Date()) {
      throw new UnauthorizedException("Onboarding invite is invalid or expired");
    }
    return invite;
  }

  private async requireSession(sessionId: string, token: string) {
    const invite = await this.requireInvite(token);
    const session = await this.prisma.onboardingSession.findUnique({ where: { id: sessionId } }) ?? invite.session;
    if (!session || session.inviteId !== invite.id) {
      throw new UnauthorizedException("Onboarding session not found for token");
    }
    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new UnauthorizedException("Onboarding session expired");
    }
    return session;
  }

  private async sendInviteEmail(token: string, email: string, campgroundName: string, expiresAt: Date) {
    const baseUrl = process.env.FRONTEND_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.campreserv.com";
    const url = `${baseUrl}/onboarding/${token}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #f8fafc;">
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
          <p style="color: #0f172a; font-weight: 600; font-size: 18px; margin: 0 0 12px 0;">Complete onboarding for ${campgroundName}</p>
          <p style="color: #475569; margin: 0 0 16px 0;">We saved your progress so you can finish anytime in the next few days.</p>
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">Start onboarding</a>
          <p style="color: #64748b; margin: 16px 0 0 0; font-size: 12px;">This link expires on ${inviteExpiryString(expiresAt)}. If it stops working, request a new invite from your Camp Everyday Host contact.</p>
        </div>
      </div>
    `;

    await this.email.sendEmail({
      to: email,
      subject: "Finish setting up your campground",
      html,
    });
  }

  private async guardIdempotency(
    key: string | undefined,
    body: any,
    scope: { campgroundId?: string | null; tenantId?: string | null },
    endpoint: string,
    sequence?: string | number | null
  ) {
    if (!key) return null;
    return this.idempotency.start(key, body ?? {}, scope.campgroundId ?? null, {
      tenantId: scope.tenantId ?? null,
      endpoint,
      sequence,
      rateAction: "apply"
    });
  }

  /**
   * Complete onboarding - creates campground, membership, and finalizes setup
   * Called when user finishes onboarding wizard
   */
  async completeOnboarding(sessionId: string, token: string, userId: string) {
    const session = await this.requireSession(sessionId, token);

    // Check minimum required steps (account_profile is mandatory)
    const completed = new Set(session.completedSteps ?? []);
    if (!completed.has("account_profile")) {
      throw new BadRequestException("Please complete the account profile step before finishing setup");
    }

    // Get session data
    const data = (session.data ?? {}) as Record<string, any>;
    const accountProfile = data.account_profile ?? {};

    // Get organization and check for early access enrollment
    const organization = session.organizationId
      ? await this.prisma.organization.findUnique({
          where: { id: session.organizationId },
          include: { earlyAccessEnrollment: true }
        })
      : null;

    // Generate slug from campground name
    const campgroundName = accountProfile.campgroundName || accountProfile.name || "My Campground";
    const baseSlug = campgroundName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Ensure unique slug
    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.campground.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create campground
    const campground = await this.prisma.campground.create({
      data: {
        organizationId: session.organizationId || organization?.id || "",
        name: campgroundName,
        slug,
        phone: accountProfile.phone,
        email: accountProfile.email,
        city: accountProfile.city,
        state: accountProfile.state,
        country: accountProfile.country || "US",
        address1: accountProfile.address1,
        postalCode: accountProfile.postalCode,
        timezone: accountProfile.timezone || "America/New_York",
        website: accountProfile.website,
        isBookable: true
      }
    });

    // Create membership for user
    await this.prisma.campgroundMembership.create({
      data: {
        userId,
        campgroundId: campground.id,
        role: "owner"
      }
    });

    // Update session with campground ID and mark completed
    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        campgroundId: campground.id,
        status: OnboardingStatus.completed
      }
    });

    // Get user for welcome email
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Send welcome email
    if (user?.email) {
      const baseUrl = process.env.FRONTEND_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.campreserv.com";
      const dashboardUrl = `${baseUrl}/dashboard`;

      await this.email.sendEmail({
        to: user.email,
        subject: `${campground.name} is live on Camp Everyday!`,
        html: this.generateGoLiveEmail({
          firstName: user.firstName || "there",
          campgroundName: campground.name,
          dashboardUrl,
          tierName: organization?.earlyAccessEnrollment
            ? this.getTierDisplayName(organization.earlyAccessEnrollment.tier)
            : null
        })
      });
    }

    return {
      success: true,
      campgroundId: campground.id,
      slug: campground.slug,
      redirectUrl: `/dashboard`
    };
  }

  private getTierDisplayName(tier: string): string {
    const names: Record<string, string> = {
      founders_circle: "Founder's Circle",
      pioneer: "Pioneer",
      trailblazer: "Trailblazer"
    };
    return names[tier] || tier;
  }

  private generateGoLiveEmail(params: {
    firstName: string;
    campgroundName: string;
    dashboardUrl: string;
    tierName: string | null;
  }): string {
    const tierBadge = params.tierName
      ? `<div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); display: inline-block; padding: 6px 16px; border-radius: 9999px; color: white; font-weight: 600; font-size: 14px; margin-bottom: 16px;">
          Early Access: ${params.tierName}
        </div>`
      : "";

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
          <h1 style="color: #0f172a; margin: 0 0 8px 0;">You're Live!</h1>
          ${tierBadge}
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px; color: white;">
          <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 16px;">Congratulations!</p>
          <h2 style="margin: 0; font-size: 24px;">${params.campgroundName}</h2>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">is now accepting reservations</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 16px 0; color: #334155;">Hey ${params.firstName}!</p>
          <p style="margin: 0 0 16px 0; color: #334155;">
            Your campground is now live and ready to accept bookings. Here's what you can do next:
          </p>
          <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #334155;">
            <li style="margin-bottom: 8px;">Add your sites and set rates</li>
            <li style="margin-bottom: 8px;">Connect Stripe to accept payments</li>
            <li style="margin-bottom: 8px;">Share your booking page with guests</li>
            <li style="margin-bottom: 8px;">Set up automated guest communications</li>
          </ul>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${params.dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 18px;">
            Go to Dashboard
          </a>
        </div>

        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">
            Need help? Reply to this email or check out our <a href="https://help.campeveryday.com" style="color: #10b981;">Help Center</a>
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Camp Everyday - Making campground management effortless
          </p>
        </div>
      </div>
    `;
  }
}

function inviteExpiryString(date: Date) {
  try {
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return date.toISOString();
  }
}
