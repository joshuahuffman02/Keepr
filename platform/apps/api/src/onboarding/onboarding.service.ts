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

const STEP_VALIDATORS: Partial<Record<OnboardingStepKey, any>> = {
  // All steps use lenient validation - service handles data transformation
  park_profile: null,
  operational_hours: null,
  stripe_connect: null,
  tax_rules: null,
  booking_rules: null,
  inventory_choice: null,
  rates_setup: null,
  deposit_policy: null,
  cancellation_rules: null,
  waivers_documents: null,
  park_rules: null,
  data_import: null,
  site_classes: null,
  sites_builder: null,
  rate_periods: null,
  fees_and_addons: null,
  team_setup: null,
  communication_setup: null,
  integrations: null,
  review_launch: null,
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

    // Include campground slug if available
    let campgroundSlug: string | null = null;
    if (session.campgroundId) {
      const campground = await this.prisma.campground.findUnique({
        where: { id: session.campgroundId },
        select: { slug: true },
      });
      campgroundSlug = campground?.slug ?? null;
    }

    return { session: { ...session, campgroundSlug }, progress };
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
    // Only block if there's a genuinely concurrent request (1-5 seconds old)
    // Records < 1 second might be our own just-created record
    // Records > 5 seconds are likely stale from failed requests
    const ageMs = existing?.createdAt ? Date.now() - new Date(existing.createdAt).getTime() : 0;
    if (existing?.status === IdempotencyStatus.inflight && ageMs > 1000 && ageMs < 5000) {
      throw new ConflictException("Onboarding step already in progress");
    }
    // Mark stale inflight records (> 5 seconds) as failed so we can proceed
    if (existing?.status === IdempotencyStatus.inflight && ageMs >= 5000 && idempotencyKey) {
      await this.idempotency.fail(idempotencyKey).catch(() => null);
    }

    try {
      const sanitized = this.validatePayload(step, payload);
      const completed = new Set(session.completedSteps ?? []);
      completed.add(step);

      // Create campground when park_profile is saved (needed for Stripe connect)
      let campgroundId = session.campgroundId;
      let campgroundSlug: string | null = null;
      if ((step === OnboardingStep.park_profile || step === OnboardingStep.account_profile) && !campgroundId) {
        const profileData = sanitized as any;
        const campgroundData = profileData.campground || profileData;
        const campgroundName = campgroundData.name || campgroundData.campgroundName || "My Campground";

        // Generate unique slug
        const baseSlug = campgroundName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        let slug = baseSlug;
        let counter = 1;
        while (await this.prisma.campground.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        const campground = await this.prisma.campground.create({
          data: {
            organizationId: session.organizationId || "",
            name: campgroundName,
            slug,
            phone: campgroundData.phone,
            email: campgroundData.email,
            city: campgroundData.city,
            state: campgroundData.state,
            country: campgroundData.country || "US",
            address1: campgroundData.address1,
            postalCode: campgroundData.postalCode,
            timezone: campgroundData.timezone || "America/New_York",
            website: campgroundData.website,
            isBookable: false, // Not bookable until onboarding complete
          }
        });
        campgroundId = campground.id;
        campgroundSlug = campground.slug;
        this.logger.log(`Created campground ${campground.id} (${campground.name}) during onboarding`);

        // Add slug to the sanitized data so it's stored with the session
        (sanitized as any).campground = {
          ...(sanitized as any).campground || campgroundData,
          slug: campground.slug,
          id: campground.id,
        };
      }

      // Create SiteClass records when site_classes step is saved
      if (step === OnboardingStep.site_classes && campgroundId) {
        const siteClassesData = (sanitized as any).siteClasses || [];
        const createdIds: string[] = [];

        // Delete existing site classes for this campground (idempotent re-save)
        await this.prisma.siteClass.deleteMany({ where: { campgroundId } });

        for (const sc of siteClassesData) {
          const created = await this.prisma.siteClass.create({
            data: {
              campgroundId,
              name: sc.name,
              siteType: sc.siteType || "rv",
              description: sc.description || null,
              defaultRate: Math.round((sc.defaultRate || 0) * 100), // Convert to cents
              maxOccupancy: sc.maxOccupancy || 6,
              rigMaxLength: sc.rigMaxLength || null,
              hookupsPower: sc.hookupsPower ?? (sc.electricAmps?.length > 0),
              hookupsWater: sc.hookupsWater ?? false,
              hookupsSewer: sc.hookupsSewer ?? false,
              electricAmps: sc.electricAmps || [],
              rvOrientation: sc.rvOrientation || null,
              petFriendly: sc.petFriendly ?? true,
              accessible: sc.accessible ?? false,
              photos: sc.photos || [],
              tags: sc.amenityTags || [],
              // New enhanced onboarding fields
              rentalType: sc.rentalType || "transient",
              equipmentTypes: sc.equipmentTypes || [],
              slideOutsAccepted: sc.slideOutsAccepted ?? null,
              occupantsIncluded: sc.occupantsIncluded ?? 2,
              extraAdultFeeCents: sc.extraAdultFee ? Math.round(sc.extraAdultFee * 100) : null,
              extraChildFeeCents: sc.extraChildFee ? Math.round(sc.extraChildFee * 100) : null,
              weeklyRateCents: sc.weeklyRate ? Math.round(sc.weeklyRate * 100) : null,
              monthlyRateCents: sc.monthlyRate ? Math.round(sc.monthlyRate * 100) : null,
              petFeeEnabled: sc.petFeeEnabled ?? false,
              petFeeCents: sc.petFee ? Math.round(sc.petFee * 100) : null,
              bookingFeeCents: sc.bookingFee ? Math.round(sc.bookingFee * 100) : null,
              siteLockFeeCents: sc.siteLockFee ? Math.round(sc.siteLockFee * 100) : null,
            },
          });
          createdIds.push(created.id);
          this.logger.log(`Created SiteClass ${created.id} (${created.name}) for campground ${campgroundId}`);
        }

        // Store the created IDs in sanitized data
        (sanitized as any).siteClassIds = createdIds;
      }

      // Create Site records when sites_builder step is saved
      if (step === OnboardingStep.sites_builder && campgroundId) {
        const sitesData = (sanitized as any).sites || [];
        const sessionData = session.data as any;
        const siteClassIds = sessionData?.site_classes?.siteClassIds || [];
        const siteClassesData = sessionData?.site_classes?.siteClasses || [];

        // Delete existing sites for this campground (idempotent re-save)
        await this.prisma.site.deleteMany({ where: { campgroundId } });

        for (const site of sitesData) {
          // Map the temp siteClassId to actual database ID
          const siteClassIndex = parseInt(site.siteClassId?.replace('temp-', '') || '0');
          const actualSiteClassId = siteClassIds[siteClassIndex];
          const siteClassInfo = siteClassesData[siteClassIndex] || {};

          if (actualSiteClassId) {
            // Get siteType from siteClass, default to 'rv'
            const siteType = siteClassInfo.siteType || 'rv';
            const maxOccupancy = siteClassInfo.maxOccupancy || 6;

            await this.prisma.site.create({
              data: {
                campgroundId,
                siteClassId: actualSiteClassId,
                name: site.name || `Site ${site.siteNumber}`,
                siteNumber: site.siteNumber,
                siteType,
                maxOccupancy,
                rigMaxLength: site.rigMaxLength || null,
                powerAmps: site.powerAmps || null,
                status: "available",
              },
            });
            this.logger.log(`Created Site ${site.siteNumber} for campground ${campgroundId}`);
          }
        }
      }

      // Update SiteClass rates when rates_setup step is saved
      if (step === OnboardingStep.rates_setup && campgroundId) {
        const ratesData = (sanitized as any).rates || [];
        const sessionData = session.data as any;
        const siteClassIds = sessionData?.site_classes?.siteClassIds || [];

        for (const rate of ratesData) {
          // Map temp IDs to actual database IDs
          let actualSiteClassId = rate.siteClassId;
          if (rate.siteClassId?.startsWith('temp-')) {
            const index = parseInt(rate.siteClassId.replace('temp-', '') || '0');
            actualSiteClassId = siteClassIds[index];
          }

          if (actualSiteClassId && rate.nightlyRate) {
            await this.prisma.siteClass.update({
              where: { id: actualSiteClassId },
              data: {
                defaultRate: Math.round(rate.nightlyRate * 100), // Convert to cents
              },
            });
            this.logger.log(`Updated SiteClass ${actualSiteClassId} with rate $${rate.nightlyRate}`);
          }
        }
      }

      // Create team members when team_setup step is saved
      if (step === OnboardingStep.team_setup && campgroundId) {
        const teamMembers = (sanitized as any).teamMembers || [];
        const baseUrl = process.env.FRONTEND_URL || "https://app.campreserv.com";

        for (const member of teamMembers) {
          if (!member.email) continue;

          // Check if user already exists
          let user = await this.prisma.user.findUnique({
            where: { email: member.email.toLowerCase() },
          });

          // Create user if doesn't exist
          if (!user) {
            const bcrypt = await import('bcryptjs');
            const tempPassword = Math.random().toString(36).slice(-12);
            const passwordHash = await bcrypt.hash(tempPassword, 10);

            user = await this.prisma.user.create({
              data: {
                email: member.email.toLowerCase(),
                firstName: member.firstName || '',
                lastName: member.lastName || '',
                passwordHash,
                isActive: false, // Requires invite acceptance
              },
            });
            this.logger.log(`Created user ${user.id} (${user.email}) during onboarding`);
          }

          // Check if membership already exists
          const existingMembership = await this.prisma.campgroundMembership.findFirst({
            where: { userId: user.id, campgroundId },
          });

          if (!existingMembership) {
            // Create campground membership
            await this.prisma.campgroundMembership.create({
              data: {
                userId: user.id,
                campgroundId,
                role: member.role || 'front_desk',
              },
            });
            this.logger.log(`Created membership for ${user.email} with role ${member.role}`);

            // Create invite token
            const inviteToken = Math.random().toString(36).slice(-20) + Date.now().toString(36);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await (this.prisma as any).inviteToken.create({
              data: {
                token: inviteToken,
                userId: user.id,
                campgroundId,
                expiresAt,
              },
            });

            // Send invite email (fire-and-forget)
            const inviteUrl = `${baseUrl}/invite?token=${inviteToken}`;
            const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || 'there';
            const roleLabel = (member.role || 'front_desk').replace('_', ' ');

            this.email.sendEmail({
              to: member.email,
              subject: `You've been invited to join a campground team`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #0f172a; margin-bottom: 12px;">Welcome, ${name}!</h2>
                  <p style="color: #475569; line-height: 1.5;">
                    You've been invited as <strong>${roleLabel}</strong> to manage a campground in Camp Everyday Host.
                  </p>
                  <p style="color: #475569; line-height: 1.5;">
                    Click the button below to set your password and get started.
                  </p>
                  <div style="margin: 24px 0;">
                    <a href="${inviteUrl}" style="display: inline-block; padding: 12px 18px; background: #10b981; color: white; border-radius: 10px; text-decoration: none; font-weight: 600;">
                      Accept Invite
                    </a>
                  </div>
                  <p style="color: #94a3b8; font-size: 12px;">
                    This invite expires in 7 days.
                  </p>
                </div>
              `,
            }).catch((err) => {
              this.logger.warn(`Failed to send invite email to ${member.email}: ${err.message}`);
            });
          }
        }
      }

      // Update campground with operational hours when operational_hours step is saved
      if (step === OnboardingStep.operational_hours && campgroundId) {
        const hoursData = sanitized as any;
        await this.prisma.campground.update({
          where: { id: campgroundId },
          data: {
            checkInTime: hoursData.checkInTime || "15:00",
            checkOutTime: hoursData.checkOutTime || "11:00",
            quietHoursStart: hoursData.quietHoursEnabled ? hoursData.quietHoursStart : null,
            quietHoursEnd: hoursData.quietHoursEnabled ? hoursData.quietHoursEnd : null,
          },
        });
        this.logger.log(`Updated operational hours for campground ${campgroundId}`);
      }

      // Update campground with booking rules when booking_rules step is saved
      if (step === OnboardingStep.booking_rules && campgroundId) {
        const rulesData = sanitized as any;
        await this.prisma.campground.update({
          where: { id: campgroundId },
          data: {
            longTermEnabled: rulesData.longTermEnabled ?? false,
            longTermMinNights: rulesData.longTermMinNights || 28,
            longTermAutoApply: rulesData.longTermAutoApply ?? true,
          },
        });
        this.logger.log(`Updated booking rules for campground ${campgroundId}`);
      }

      // Create waiver template when waivers_documents step is saved
      if (step === OnboardingStep.waivers_documents && campgroundId) {
        const waiverData = sanitized as any;
        if (waiverData.requireWaiver && (waiverData.waiverContent || waiverData.useDefaultWaiver)) {
          const defaultWaiverContent = `RELEASE AND WAIVER OF LIABILITY

By signing this waiver, I acknowledge and agree to the following:

1. I understand that camping and outdoor activities involve inherent risks.
2. I assume all responsibility for myself and any minors in my care.
3. I release the campground from liability for any injuries or damages.
4. I agree to follow all posted rules and regulations.
5. I am responsible for any damages caused by myself or my guests.

I have read and understand this waiver and agree to its terms.`;

          await this.prisma.waiverTemplate.create({
            data: {
              campgroundId,
              name: "Standard Liability Waiver",
              content: waiverData.useDefaultWaiver ? defaultWaiverContent : waiverData.waiverContent,
              isActive: true,
              requiresSignature: true,
            },
          });
          this.logger.log(`Created waiver template for campground ${campgroundId}`);
        }
      }

      // Update campground with communication settings when communication_setup step is saved
      if (step === OnboardingStep.communication_setup && campgroundId) {
        const commData = sanitized as any;
        await this.prisma.campground.update({
          where: { id: campgroundId },
          data: {
            npsAutoSendEnabled: commData.enableNpsSurvey ?? false,
            npsSendHour: commData.npsSendHour || 9,
            senderDomain: commData.useCustomDomain ? commData.customDomain : null,
          },
        });
        this.logger.log(`Updated communication settings for campground ${campgroundId}`);
      }

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
          campgroundId, // Update with new campground if created
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
    } catch (error) {
      // Mark idempotency as failed so retries work
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey).catch(() => null);
      throw error;
    }
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
