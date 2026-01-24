import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import {
  IdempotencyStatus,
  OnboardingStatus,
  OnboardingStep,
  Prisma,
  SiteType,
  UserRole,
} from "@prisma/client";
import { instanceToPlain, plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { randomBytes, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { IdempotencyService } from "../payments/idempotency.service";
import {
  ONBOARDING_STEP_ORDER,
  ONBOARDING_TOTAL_STEPS,
  OnboardingStepKey,
} from "./onboarding.constants";
import { AccountProfileDto, CreateOnboardingInviteDto, StartOnboardingDto } from "./dto";

type OnboardingPayload = Record<string, unknown>;

type StepValidator = new () => object;

type OnboardingActor = { id?: string | null } | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const toRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toString = (value: unknown): string | undefined => (isString(value) ? value : undefined);

const toNumber = (value: unknown): number | undefined => {
  if (isNumber(value)) return value;
  if (isString(value) && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

const toBoolean = (value: unknown): boolean | undefined => {
  if (isBoolean(value)) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return toJsonValue(value) ?? Prisma.JsonNull;
};

const isSiteType = (value: string): value is SiteType =>
  Object.values(SiteType).some((type) => type === value);

const isUserRole = (value: string): value is UserRole =>
  Object.values(UserRole).some((role) => role === value);

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isString);
};

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  const result: number[] = [];
  for (const entry of value) {
    const parsed = toNumber(entry);
    if (typeof parsed === "number") {
      result.push(parsed);
    }
  }
  return result;
};

const STEP_VALIDATORS: Partial<Record<OnboardingStep, StepValidator | null>> = {
  account_profile: AccountProfileDto,
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
  menu_setup: null,
  feature_discovery: null,
  smart_quiz: null,
  feature_triage: null,
  guided_setup: null,
  review_launch: null,
};

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async createInvite(dto: CreateOnboardingInviteDto, actor?: OnboardingActor) {
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + (dto.expiresInHours ?? 72) * 60 * 60 * 1000);

    const invite = await this.prisma.onboardingInvite.create({
      data: {
        id: randomUUID(),
        email: dto.email,
        organizationId: dto.organizationId ?? null,
        campgroundId: dto.campgroundId ?? null,
        invitedById: actor?.id ?? null,
        token,
        expiresAt,
        lastSentAt: new Date(),
      },
    });

    await this.sendInviteEmail(
      invite.token,
      invite.email,
      dto.campgroundName ?? "your campground",
      expiresAt,
    );

    return { inviteId: invite.id, token, expiresAt };
  }

  async resendInvite(inviteId: string, actor?: OnboardingActor) {
    const existing = await this.prisma.onboardingInvite.findUnique({ where: { id: inviteId } });
    if (!existing) throw new UnauthorizedException("Invite not found");

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const invite = await this.prisma.onboardingInvite.update({
      where: { id: inviteId },
      data: {
        token,
        expiresAt,
        lastSentAt: new Date(),
        invitedById: actor?.id ?? existing.invitedById ?? null,
      },
    });

    await this.sendInviteEmail(token, invite.email, "your campground", expiresAt);
    return { inviteId: invite.id, token, expiresAt };
  }

  async startSession(input: StartOnboardingDto) {
    const invite = await this.requireInvite(input.token);

    const session =
      invite.OnboardingSession ??
      (await this.prisma.onboardingSession.create({
        data: {
          id: randomUUID(),
          inviteId: invite.id,
          organizationId: invite.organizationId ?? null,
          campgroundId: invite.campgroundId ?? null,
          status: OnboardingStatus.in_progress,
          currentStep: OnboardingStep.account_profile,
          completedSteps: [],
          expiresAt: invite.expiresAt,
          updatedAt: new Date(),
        },
      }));

    if (!invite.redeemedAt) {
      await this.prisma.onboardingInvite
        .update({
          where: { id: invite.id },
          data: { redeemedAt: new Date() },
        })
        .catch(() => null);
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
    payload: unknown,
    idempotencyKey?: string,
    sequence?: string | number | null,
  ) {
    const session = await this.requireSession(sessionId, token);
    const scope = {
      campgroundId: session.campgroundId ?? null,
      tenantId: session.organizationId ?? null,
    };
    const existing = await this.guardIdempotency(
      idempotencyKey,
      { step, payload },
      scope,
      `onboarding/${step}`,
      sequence,
    );
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
      let sanitizedRecord = toRecord(sanitized);
      const completed = new Set<OnboardingStep>(session.completedSteps ?? []);
      completed.add(step);

      // Create campground when park_profile is saved (needed for Stripe connect)
      let campgroundId = session.campgroundId;
      let campgroundSlug: string | null = null;
      if (
        (step === OnboardingStep.park_profile || step === OnboardingStep.account_profile) &&
        !campgroundId
      ) {
        const profileData = sanitizedRecord;
        const campgroundData = isRecord(profileData.campground)
          ? profileData.campground
          : profileData;
        const campgroundName =
          toString(campgroundData.name) ??
          toString(campgroundData.campgroundName) ??
          "My Campground";

        // Generate unique slug
        const baseSlug = campgroundName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        let slug = baseSlug;
        let counter = 1;
        while (await this.prisma.campground.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        const organizationId = session.organizationId;
        if (!organizationId) {
          throw new BadRequestException("Organization is required to create a campground");
        }

        const campground = await this.prisma.campground.create({
          data: {
            id: randomUUID(),
            Organization: { connect: { id: organizationId } },
            name: campgroundName,
            slug,
            phone: toString(campgroundData.phone) ?? null,
            email: toString(campgroundData.email) ?? null,
            city: toString(campgroundData.city) ?? null,
            state: toString(campgroundData.state) ?? null,
            country: toString(campgroundData.country) ?? "US",
            address1: toString(campgroundData.address1) ?? null,
            postalCode: toString(campgroundData.postalCode) ?? null,
            timezone: toString(campgroundData.timezone) ?? "America/New_York",
            website: toString(campgroundData.website) ?? null,
            isBookable: false, // Not bookable until onboarding complete
          },
        });
        campgroundId = campground.id;
        campgroundSlug = campground.slug;
        this.logger.log(
          `Created campground ${campground.id} (${campground.name}) during onboarding`,
        );

        // Add slug to the sanitized data so it's stored with the session
        sanitizedRecord = {
          ...sanitizedRecord,
          campground: {
            ...(isRecord(sanitizedRecord.campground) ? sanitizedRecord.campground : campgroundData),
            slug: campground.slug,
            id: campground.id,
          },
        };
      }

      // Create SiteClass records when site_classes step is saved
      if (step === OnboardingStep.site_classes && campgroundId) {
        const siteClassesData = toArray(sanitizedRecord.siteClasses);
        const createdIds: string[] = [];

        // Delete existing site classes for this campground (idempotent re-save)
        await this.prisma.siteClass.deleteMany({ where: { campgroundId } });

        for (const entry of siteClassesData) {
          const sc = toRecord(entry);
          const defaultRate = toNumber(sc.defaultRate) ?? 0;
          const maxOccupancy = toNumber(sc.maxOccupancy) ?? 6;
          const rigMaxLength = toNumber(sc.rigMaxLength);
          const electricAmps = toNumberArray(sc.electricAmps);
          const hookupsPower = toBoolean(sc.hookupsPower);
          const hookupsWater = toBoolean(sc.hookupsWater) ?? false;
          const hookupsSewer = toBoolean(sc.hookupsSewer) ?? false;
          const extraAdultFee = toNumber(sc.extraAdultFee);
          const extraChildFee = toNumber(sc.extraChildFee);
          const weeklyRate = toNumber(sc.weeklyRate);
          const monthlyRate = toNumber(sc.monthlyRate);
          const petFee = toNumber(sc.petFee);
          const bookingFee = toNumber(sc.bookingFee);
          const siteLockFee = toNumber(sc.siteLockFee);
          const siteTypeRaw = toString(sc.siteType);
          const siteType = siteTypeRaw && isSiteType(siteTypeRaw) ? siteTypeRaw : SiteType.rv;
          const slideOutsRaw = toString(sc.slideOutsAccepted);
          const slideOutsFlag = toBoolean(sc.slideOutsAccepted);
          const slideOutsAccepted =
            slideOutsRaw ?? (slideOutsFlag !== undefined ? String(slideOutsFlag) : null);

          const created = await this.prisma.siteClass.create({
            data: {
              id: randomUUID(),
              campgroundId,
              name: toString(sc.name) ?? "Site Class",
              siteType,
              description: toString(sc.description) ?? null,
              defaultRate: Math.round(defaultRate * 100), // Convert to cents
              maxOccupancy,
              rigMaxLength: typeof rigMaxLength === "number" ? rigMaxLength : null,
              hookupsPower: hookupsPower ?? electricAmps.length > 0,
              hookupsWater,
              hookupsSewer,
              electricAmps,
              rvOrientation: toString(sc.rvOrientation) ?? null,
              petFriendly: toBoolean(sc.petFriendly) ?? true,
              accessible: toBoolean(sc.accessible) ?? false,
              photos: toStringArray(sc.photos),
              tags: toStringArray(sc.amenityTags),
              // New enhanced onboarding fields
              rentalType: toString(sc.rentalType) ?? "transient",
              equipmentTypes: toStringArray(sc.equipmentTypes),
              slideOutsAccepted,
              occupantsIncluded: toNumber(sc.occupantsIncluded) ?? 2,
              extraAdultFeeCents:
                typeof extraAdultFee === "number" ? Math.round(extraAdultFee * 100) : null,
              extraChildFeeCents:
                typeof extraChildFee === "number" ? Math.round(extraChildFee * 100) : null,
              weeklyRateCents: typeof weeklyRate === "number" ? Math.round(weeklyRate * 100) : null,
              monthlyRateCents:
                typeof monthlyRate === "number" ? Math.round(monthlyRate * 100) : null,
              petFeeEnabled: toBoolean(sc.petFeeEnabled) ?? false,
              petFeeCents: typeof petFee === "number" ? Math.round(petFee * 100) : null,
              bookingFeeCents: typeof bookingFee === "number" ? Math.round(bookingFee * 100) : null,
              siteLockFeeCents:
                typeof siteLockFee === "number" ? Math.round(siteLockFee * 100) : null,
            },
          });
          createdIds.push(created.id);
          this.logger.log(
            `Created SiteClass ${created.id} (${created.name}) for campground ${campgroundId}`,
          );
        }

        // Store the created IDs in sanitized data
        sanitizedRecord = { ...sanitizedRecord, siteClassIds: createdIds };
      }

      // Create Site records when sites_builder step is saved
      if (step === OnboardingStep.sites_builder && campgroundId) {
        const sitesData = toArray(sanitizedRecord.sites);
        const sessionData = toRecord(session.data);
        const siteClassesStep = toRecord(sessionData.site_classes);
        const siteClassIds = toStringArray(siteClassesStep.siteClassIds);
        const siteClassesData = toArray(siteClassesStep.siteClasses);

        // Delete existing sites for this campground (idempotent re-save)
        await this.prisma.site.deleteMany({ where: { campgroundId } });

        for (const entry of sitesData) {
          const site = toRecord(entry);
          // Map the temp siteClassId to actual database ID
          const rawSiteClassId = toString(site.siteClassId);
          const siteClassIndex =
            rawSiteClassId && rawSiteClassId.startsWith("temp-")
              ? Number(rawSiteClassId.replace("temp-", ""))
              : null;
          const actualSiteClassId = rawSiteClassId
            ? rawSiteClassId.startsWith("temp-")
              ? typeof siteClassIndex === "number" && Number.isFinite(siteClassIndex)
                ? siteClassIds[siteClassIndex]
                : undefined
              : rawSiteClassId
            : undefined;
          const siteClassInfo =
            typeof siteClassIndex === "number" && Number.isFinite(siteClassIndex)
              ? toRecord(siteClassesData[siteClassIndex])
              : {};

          if (actualSiteClassId) {
            // Get siteType from siteClass, default to 'rv'
            const siteTypeRaw = toString(siteClassInfo.siteType);
            const siteType = siteTypeRaw && isSiteType(siteTypeRaw) ? siteTypeRaw : SiteType.rv;
            const maxOccupancy = toNumber(siteClassInfo.maxOccupancy) ?? 6;
            const siteNumber =
              toString(site.siteNumber) ??
              (typeof site.siteNumber === "number" ? site.siteNumber.toString() : "");
            const rigMaxLength = toNumber(site.rigMaxLength);
            const powerAmps = Array.isArray(site.powerAmps)
              ? toNumberArray(site.powerAmps)
              : toNumberArray(
                  site.powerAmps === undefined || site.powerAmps === null ? [] : [site.powerAmps],
                );

            await this.prisma.site.create({
              data: {
                id: randomUUID(),
                campgroundId,
                siteClassId: actualSiteClassId,
                name: toString(site.name) ?? (siteNumber ? `Site ${siteNumber}` : "Site"),
                siteNumber,
                siteType,
                maxOccupancy,
                rigMaxLength: typeof rigMaxLength === "number" ? rigMaxLength : null,
                powerAmps,
                status: "available",
              },
            });
            this.logger.log(`Created Site ${siteNumber} for campground ${campgroundId}`);
          }
        }
      }

      // Update SiteClass rates when rates_setup step is saved
      if (step === OnboardingStep.rates_setup && campgroundId) {
        const ratesData = toArray(sanitizedRecord.rates);
        const sessionData = toRecord(session.data);
        const siteClassesStep = toRecord(sessionData.site_classes);
        const siteClassIds = toStringArray(siteClassesStep.siteClassIds);

        for (const entry of ratesData) {
          const rate = toRecord(entry);
          // Map temp IDs to actual database IDs
          const rawSiteClassId = toString(rate.siteClassId);
          let actualSiteClassId = rawSiteClassId;
          if (rawSiteClassId && rawSiteClassId.startsWith("temp-")) {
            const index = Number(rawSiteClassId.replace("temp-", ""));
            if (Number.isFinite(index)) {
              actualSiteClassId = siteClassIds[index];
            }
          }

          const nightlyRate = toNumber(rate.nightlyRate);
          if (actualSiteClassId && typeof nightlyRate === "number") {
            await this.prisma.siteClass.update({
              where: { id: actualSiteClassId },
              data: {
                defaultRate: Math.round(nightlyRate * 100), // Convert to cents
              },
            });
            this.logger.log(`Updated SiteClass ${actualSiteClassId} with rate $${nightlyRate}`);
          }
        }
      }

      // Create team members when team_setup step is saved
      if (step === OnboardingStep.team_setup && campgroundId) {
        const teamMembers = toArray(sanitizedRecord.teamMembers);
        const baseUrl = process.env.FRONTEND_URL || "https://app.campreserv.com";

        for (const entry of teamMembers) {
          const member = toRecord(entry);
          const emailRaw = toString(member.email);
          if (!emailRaw) continue;
          const email = emailRaw.toLowerCase();
          const firstName = toString(member.firstName) ?? "";
          const lastName = toString(member.lastName) ?? "";
          const roleRaw = toString(member.role);
          const role = roleRaw && isUserRole(roleRaw) ? roleRaw : UserRole.front_desk;

          // Check if user already exists
          let user = await this.prisma.user.findUnique({
            where: { email },
          });

          // Create user if doesn't exist
          if (!user) {
            const bcrypt = await import("bcryptjs");
            const tempPassword = Math.random().toString(36).slice(-12);
            const passwordHash = await bcrypt.hash(tempPassword, 10);

            user = await this.prisma.user.create({
              data: {
                id: randomUUID(),
                email,
                firstName,
                lastName,
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
                id: randomUUID(),
                userId: user.id,
                campgroundId,
                role,
              },
            });
            this.logger.log(`Created membership for ${user.email} with role ${role}`);

            // Create invite token
            const inviteToken = Math.random().toString(36).slice(-20) + Date.now().toString(36);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await this.prisma.inviteToken.create({
              data: {
                id: randomUUID(),
                token: inviteToken,
                userId: user.id,
                campgroundId,
                expiresAt,
              },
            });

            // Send invite email (fire-and-forget)
            const inviteUrl = `${baseUrl}/invite?token=${inviteToken}`;
            const name =
              [firstName, lastName].filter((value) => value.length > 0).join(" ") || "there";
            const roleLabel = role.replace("_", " ");

            this.email
              .sendEmail({
                to: email,
                subject: `You've been invited to join a campground team`,
                html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #0f172a; margin-bottom: 12px;">Welcome, ${name}!</h2>
                  <p style="color: #475569; line-height: 1.5;">
                    You've been invited as <strong>${roleLabel}</strong> to manage a campground in Keepr Host.
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
              })
              .catch((err) => {
                this.logger.warn(`Failed to send invite email to ${member.email}: ${err.message}`);
              });
          }
        }
      }

      // Update campground with operational hours when operational_hours step is saved
      if (step === OnboardingStep.operational_hours && campgroundId) {
        const hoursData = isRecord(sanitizedRecord.operationalHours)
          ? sanitizedRecord.operationalHours
          : sanitizedRecord;
        const checkInTime = toString(hoursData.checkInTime) ?? "15:00";
        const checkOutTime = toString(hoursData.checkOutTime) ?? "11:00";
        const quietHoursEnabled = toBoolean(hoursData.quietHoursEnabled) ?? false;
        const quietHoursStart = toString(hoursData.quietHoursStart);
        const quietHoursEnd = toString(hoursData.quietHoursEnd);
        await this.prisma.campground.update({
          where: { id: campgroundId },
          data: {
            checkInTime,
            checkOutTime,
            quietHoursStart: quietHoursEnabled ? (quietHoursStart ?? null) : null,
            quietHoursEnd: quietHoursEnabled ? (quietHoursEnd ?? null) : null,
          },
        });
        this.logger.log(`Updated operational hours for campground ${campgroundId}`);
      }

      // Update campground with booking rules when booking_rules step is saved
      if (step === OnboardingStep.booking_rules && campgroundId) {
        const rulesData = isRecord(sanitizedRecord.bookingRules)
          ? sanitizedRecord.bookingRules
          : sanitizedRecord;
        const longTermEnabled = toBoolean(rulesData.longTermEnabled) ?? false;
        const longTermMinNights = toNumber(rulesData.longTermMinNights) ?? 28;
        const longTermAutoApply = toBoolean(rulesData.longTermAutoApply) ?? true;
        const officeClosesAt = toString(rulesData.officeClosesAt) ?? "17:00";
        const sameDayCutoffEnabled = toBoolean(rulesData.sameDayCutoffEnabled);
        await this.prisma.campground.update({
          where: { id: campgroundId },
          data: {
            longTermEnabled,
            longTermMinNights,
            longTermAutoApply,
            officeClosesAt,
          },
        });

        // If same-day cutoff is disabled, set all site classes to have no cutoff
        if (sameDayCutoffEnabled === false) {
          await this.prisma.siteClass.updateMany({
            where: { campgroundId },
            data: { sameDayBookingCutoffMinutes: 0 },
          });
          this.logger.log(
            `Disabled same-day booking cutoffs for all site classes in campground ${campgroundId}`,
          );
        }
        // If enabled, leave as null so defaults apply (RV=0, cabin=60)

        this.logger.log(`Updated booking rules for campground ${campgroundId}`);
      }

      // Create waiver template when waivers_documents step is saved
      if (step === OnboardingStep.waivers_documents && campgroundId) {
        const waiverData = isRecord(sanitizedRecord.waiversDocuments)
          ? sanitizedRecord.waiversDocuments
          : sanitizedRecord;
        const requireWaiver = toBoolean(waiverData.requireWaiver) ?? false;
        const waiverContent = toString(waiverData.waiverContent);
        const useDefaultWaiver = toBoolean(waiverData.useDefaultWaiver) ?? false;
        if (requireWaiver && (waiverContent || useDefaultWaiver)) {
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
              id: randomUUID(),
              campgroundId,
              name: "Standard Liability Waiver",
              content: useDefaultWaiver
                ? defaultWaiverContent
                : (waiverContent ?? defaultWaiverContent),
              isActive: true,
              updatedAt: new Date(),
            },
          });
          this.logger.log(`Created waiver template for campground ${campgroundId}`);
        }
      }

      // Update campground with communication settings when communication_setup step is saved
      if (step === OnboardingStep.communication_setup && campgroundId) {
        const commData = isRecord(sanitizedRecord.communicationSetup)
          ? sanitizedRecord.communicationSetup
          : sanitizedRecord;
        const enableNpsSurvey = toBoolean(commData.enableNpsSurvey) ?? false;
        const npsSendHour = toNumber(commData.npsSendHour) ?? 9;
        const useCustomDomain = toBoolean(commData.useCustomDomain) ?? false;
        const customDomain = toString(commData.customDomain);
        await this.prisma.campground.update({
          where: { id: campgroundId },
          data: {
            npsAutoSendEnabled: enableNpsSurvey,
            npsSendHour,
            senderDomain: useCustomDomain ? (customDomain ?? null) : null,
          },
        });
        this.logger.log(`Updated communication settings for campground ${campgroundId}`);
      }

      // Save quiz response when smart_quiz step is saved
      if (step === OnboardingStep.smart_quiz) {
        const quizData = sanitizedRecord;
        const answers = toRecord(quizData.answers);
        const recommendations = toRecord(quizData.recommendations);
        // Create or update quiz response
        await this.prisma.onboardingQuizResponse.upsert({
          where: { onboardingSessionId: sessionId },
          create: {
            id: randomUUID(),
            onboardingSessionId: sessionId,
            parkType: toString(answers.parkType) ?? null,
            operations: toStringArray(answers.operations),
            teamSize: toString(answers.teamSize) ?? null,
            amenities: toStringArray(answers.amenities),
            techLevel: toString(answers.techLevel) ?? null,
            recommendedNow: toStringArray(recommendations.setupNow),
            recommendedLater: toStringArray(recommendations.setupLater),
            updatedAt: new Date(),
          },
          update: {
            parkType: toString(answers.parkType) ?? null,
            operations: toStringArray(answers.operations),
            teamSize: toString(answers.teamSize) ?? null,
            amenities: toStringArray(answers.amenities),
            techLevel: toString(answers.techLevel) ?? null,
            recommendedNow: toStringArray(recommendations.setupNow),
            recommendedLater: toStringArray(recommendations.setupLater),
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Saved quiz response for session ${sessionId}`);
      }

      // Create feature setup queue when feature_triage step is saved
      if (step === OnboardingStep.feature_triage && campgroundId) {
        const triageData = sanitizedRecord;
        const selections = toRecord(triageData.selections);

        // Delete existing queue items for this campground (idempotent re-save)
        await this.prisma.featureSetupQueue.deleteMany({ where: { campgroundId } });

        // Create queue items for each feature based on triage selection
        const queueItems: Array<{
          id: string;
          campgroundId: string;
          featureKey: string;
          status: "setup_now" | "setup_later" | "skipped" | "completed";
          priority: number;
          updatedAt: Date;
        }> = [];

        let priority = 0;
        for (const [featureKey, statusValue] of Object.entries(selections)) {
          const status = toString(statusValue);
          if (status === "setup_now" || status === "setup_later") {
            queueItems.push({
              id: randomUUID(),
              campgroundId,
              featureKey,
              status,
              priority: status === "setup_now" ? priority++ : priority + 1000, // setup_now items come first
              updatedAt: new Date(),
            });
          } else if (status === "skip") {
            queueItems.push({
              id: randomUUID(),
              campgroundId,
              featureKey,
              status: "skipped",
              priority: 9999,
              updatedAt: new Date(),
            });
          }
        }

        if (queueItems.length > 0) {
          await this.prisma.featureSetupQueue.createMany({
            data: queueItems,
            skipDuplicates: true,
          });
          this.logger.log(
            `Created ${queueItems.length} feature queue items for campground ${campgroundId}`,
          );
        }
      }

      if (step === OnboardingStep.review_launch && campgroundId) {
        await this.finalizeLaunch(session, campgroundId);
      }

      const sessionDataForSave = toRecord(session.data);
      const updatedData = { ...sessionDataForSave, [step]: sanitizedRecord };
      const completedSteps = Array.from(completed);
      const progress = this.buildProgress({
        ...session,
        currentStep: step,
        completedSteps,
        data: updatedData,
      });

      const nextStatus =
        progress.remainingSteps.length === 0
          ? OnboardingStatus.completed
          : OnboardingStatus.in_progress;

      const updated = await this.prisma.onboardingSession.update({
        where: { id: sessionId },
        data: {
          campgroundId, // Update with new campground if created
          currentStep: progress.nextStep ?? step,
          completedSteps,
          status: nextStatus,
          data: toNullableJsonInput(updatedData),
          progress: toNullableJsonInput(progress),
        },
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

  async saveDraft(sessionId: string, token: string, step: OnboardingStep, payload: unknown) {
    if (step !== OnboardingStep.data_import) {
      throw new BadRequestException("Draft updates are only supported for data_import");
    }

    const session = await this.requireSession(sessionId, token);
    const sanitized = this.validatePayload(step, payload);
    const sanitizedRecord = toRecord(sanitized);
    const sessionDataForSave = toRecord(session.data);
    const existingStepData = toRecord(sessionDataForSave[step]);
    const mergedStepData = { ...existingStepData, ...sanitizedRecord };
    const updatedData = { ...sessionDataForSave, [step]: mergedStepData };

    const updated = await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        data: toNullableJsonInput(updatedData),
      },
    });

    const progress = this.buildProgress(updated);
    return { session: updated, progress };
  }

  private buildProgress(session: {
    currentStep?: OnboardingStep | null;
    completedSteps?: OnboardingStep[] | null;
    data?: unknown;
  }) {
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

  private validatePayload(step: OnboardingStep, payload: unknown): OnboardingPayload {
    const dtoClass = STEP_VALIDATORS[step];
    if (!dtoClass) {
      return isRecord(payload) ? payload : {};
    }

    const plainPayload = isRecord(payload) ? payload : {};
    const instance = plainToInstance(dtoClass, plainPayload, { enableImplicitConversion: true });
    const errors = validateSync(instance, { whitelist: true, forbidUnknownValues: true });
    if (errors.length > 0) {
      const detail = errors
        .flatMap((err) => Object.values(err.constraints ?? {}))
        .filter(Boolean)
        .join(", ");
      throw new BadRequestException(
        `Invalid payload for ${step}: ${detail || "validation failed"}`,
      );
    }
    const plain = instanceToPlain(instance);
    return isRecord(plain) ? plain : {};
  }

  private async requireInvite(token: string) {
    const invite = await this.prisma.onboardingInvite.findUnique({
      where: { token },
      include: { OnboardingSession: true },
    });
    if (!invite || invite.expiresAt < new Date()) {
      throw new UnauthorizedException("Onboarding invite is invalid or expired");
    }
    return invite;
  }

  private async requireSession(sessionId: string, token: string) {
    const invite = await this.requireInvite(token);
    const session =
      (await this.prisma.onboardingSession.findUnique({ where: { id: sessionId } })) ??
      invite.OnboardingSession;
    if (!session || session.inviteId !== invite.id) {
      throw new UnauthorizedException("Onboarding session not found for token");
    }
    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new UnauthorizedException("Onboarding session expired");
    }
    return session;
  }

  private async sendInviteEmail(
    token: string,
    email: string,
    campgroundName: string,
    expiresAt: Date,
  ) {
    const baseUrl =
      process.env.FRONTEND_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://app.campreserv.com";
    const url = `${baseUrl}/onboarding/${token}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #f8fafc;">
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
          <p style="color: #0f172a; font-weight: 600; font-size: 18px; margin: 0 0 12px 0;">Complete onboarding for ${campgroundName}</p>
          <p style="color: #475569; margin: 0 0 16px 0;">We saved your progress so you can finish anytime in the next few days.</p>
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;">Start onboarding</a>
          <p style="color: #64748b; margin: 16px 0 0 0; font-size: 12px;">This link expires on ${inviteExpiryString(expiresAt)}. If it stops working, request a new invite from your Keepr Host contact.</p>
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
    body: unknown,
    scope: { campgroundId?: string | null; tenantId?: string | null },
    endpoint: string,
    sequence?: string | number | null,
  ) {
    if (!key) return null;
    return this.idempotency.start(key, body ?? {}, scope.campgroundId ?? null, {
      tenantId: scope.tenantId ?? null,
      endpoint,
      sequence,
      rateAction: "apply",
    });
  }

  private async finalizeLaunch(
    session: { inviteId: string; data?: unknown },
    campgroundId: string,
  ) {
    await this.prisma.campground.update({
      where: { id: campgroundId },
      data: { isBookable: true },
    });

    const sessionData = toRecord(session.data);
    let ownerUserId = toString(sessionData.userId);

    if (!ownerUserId) {
      const invite = await this.prisma.onboardingInvite.findUnique({
        where: { id: session.inviteId },
        select: { email: true },
      });
      const inviteEmail = invite?.email?.toLowerCase();
      if (inviteEmail) {
        const user = await this.prisma.user.findUnique({
          where: { email: inviteEmail },
          select: { id: true },
        });
        ownerUserId = user?.id;
      }
    }

    if (!ownerUserId) {
      this.logger.warn(`Onboarding launch missing owner user for campground ${campgroundId}`);
      return;
    }

    const existingMembership = await this.prisma.campgroundMembership.findFirst({
      where: { userId: ownerUserId, campgroundId },
    });

    if (existingMembership) {
      if (existingMembership.role !== UserRole.owner) {
        await this.prisma.campgroundMembership.update({
          where: { id: existingMembership.id },
          data: { role: UserRole.owner },
        });
      }
      return;
    }

    await this.prisma.campgroundMembership.create({
      data: {
        id: randomUUID(),
        userId: ownerUserId,
        campgroundId,
        role: UserRole.owner,
      },
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
      throw new BadRequestException(
        "Please complete the account profile step before finishing setup",
      );
    }

    // Get session data
    const data = isRecord(session.data) ? session.data : {};
    const accountProfile = toRecord(data.account_profile);

    // Get organization and check for early access enrollment
    const organization = session.organizationId
      ? await this.prisma.organization.findUnique({
          where: { id: session.organizationId },
          include: { EarlyAccessEnrollment: true },
        })
      : null;

    // Generate slug from campground name
    const campgroundName =
      toString(accountProfile.campgroundName) ?? toString(accountProfile.name) ?? "My Campground";
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
    const organizationId = session.organizationId ?? organization?.id;
    if (!organizationId) {
      throw new BadRequestException("Organization is required to create a campground");
    }

    const campground = await this.prisma.campground.create({
      data: {
        id: randomUUID(),
        Organization: { connect: { id: organizationId } },
        name: campgroundName,
        slug,
        phone: toString(accountProfile.phone) ?? null,
        email: toString(accountProfile.email) ?? null,
        city: toString(accountProfile.city) ?? null,
        state: toString(accountProfile.state) ?? null,
        country: toString(accountProfile.country) ?? "US",
        address1: toString(accountProfile.address1) ?? null,
        postalCode: toString(accountProfile.postalCode) ?? null,
        timezone: toString(accountProfile.timezone) ?? "America/New_York",
        website: toString(accountProfile.website) ?? null,
        isBookable: true,
      },
    });

    // Create membership for user
    await this.prisma.campgroundMembership.create({
      data: {
        id: randomUUID(),
        userId,
        campgroundId: campground.id,
        role: UserRole.owner,
      },
    });

    // Update session with campground ID and mark completed
    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        campgroundId: campground.id,
        status: OnboardingStatus.completed,
      },
    });

    // Get user for welcome email
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Send welcome email
    if (user?.email) {
      const baseUrl =
        process.env.FRONTEND_BASE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://app.campreserv.com";
      const dashboardUrl = `${baseUrl}/dashboard`;

      await this.email.sendEmail({
        to: user.email,
        subject: `${campground.name} is live on Keepr!`,
        html: this.generateGoLiveEmail({
          firstName: user.firstName || "there",
          campgroundName: campground.name,
          dashboardUrl,
          tierName: organization?.EarlyAccessEnrollment
            ? this.getTierDisplayName(organization.EarlyAccessEnrollment.tier)
            : null,
        }),
      });
    }

    return {
      success: true,
      campgroundId: campground.id,
      slug: campground.slug,
      redirectUrl: `/dashboard`,
    };
  }

  private getTierDisplayName(tier: string): string {
    const names: Record<string, string> = {
      founders_circle: "Founder's Circle",
      pioneer: "Pioneer",
      trailblazer: "Trailblazer",
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
            Need help? Reply to this email or check out our <a href="https://help.keeprstay.com" style="color: #10b981;">Help Center</a>
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Keepr - Making campground management effortless
          </p>
        </div>
      </div>
    `;
  }
}

function inviteExpiryString(date: Date) {
  try {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date.toISOString();
  }
}
