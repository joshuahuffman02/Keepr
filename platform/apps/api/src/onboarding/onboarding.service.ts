import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { IdempotencyStatus, OnboardingStatus } from "@prisma/client";
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
  ) {}

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
          <p style="color: #64748b; margin: 16px 0 0 0; font-size: 12px;">This link expires on ${inviteExpiryString(expiresAt)}. If it stops working, request a new invite from your Campreserv contact.</p>
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
}

function inviteExpiryString(date: Date) {
  try {
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return date.toISOString();
  }
}
