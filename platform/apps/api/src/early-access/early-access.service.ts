import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { EarlyAccessTierType, EARLY_ACCESS_TIERS, EarlyAccessSignupDto } from "./dto/enroll-early-access.dto";
import { randomBytes } from "crypto";

// Local interface for EarlyAccessSpot (avoids Prisma client dependency)
interface EarlyAccessSpotRecord {
  tier: string;
  totalSpots: number;
  remainingSpots: number;
  updatedAt: Date;
}

// Tier configuration - locked pricing for each tier
const TIER_CONFIG: Record<
  EarlyAccessTierType,
  {
    totalSpots: number;
    bookingFeeCents: number; // Locked forever
    monthlyFeeCents: number; // During promo period
    monthlyDurationMonths: number | null; // null = forever free
    postPromoMonthlyFeeCents: number; // After promo ends
  }
> = {
  founders_circle: {
    totalSpots: 5,
    bookingFeeCents: 75, // $0.75
    monthlyFeeCents: 0,
    monthlyDurationMonths: null, // Forever free
    postPromoMonthlyFeeCents: 0
  },
  pioneer: {
    totalSpots: 15,
    bookingFeeCents: 100, // $1.00
    monthlyFeeCents: 0,
    monthlyDurationMonths: 12, // 12 months free
    postPromoMonthlyFeeCents: 2900 // $29 after
  },
  trailblazer: {
    totalSpots: 25,
    bookingFeeCents: 125, // $1.25
    monthlyFeeCents: 1450, // $14.50 for 6 months
    monthlyDurationMonths: 6,
    postPromoMonthlyFeeCents: 2900 // $29 after
  }
};

@Injectable()
export class EarlyAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Initialize early access spots if they don't exist
   * Should be called on app startup
   */
  async initializeSpots() {
    const tiers = EARLY_ACCESS_TIERS;

    for (const tier of tiers) {
      const config = TIER_CONFIG[tier];
      await this.prisma.earlyAccessSpot.upsert({
        where: { tier },
        create: {
          tier,
          totalSpots: config.totalSpots,
          remainingSpots: config.totalSpots
        },
        update: {} // Don't update if exists
      });
    }
  }

  /**
   * Get availability for all tiers
   */
  async getAvailability() {
    const spots = await this.prisma.earlyAccessSpot.findMany({
      orderBy: { tier: "asc" }
    });

    return spots.map((spot: EarlyAccessSpotRecord) => {
      const config = TIER_CONFIG[spot.tier as EarlyAccessTierType];
      return {
        tier: spot.tier,
        totalSpots: spot.totalSpots,
        remainingSpots: spot.remainingSpots,
        isSoldOut: spot.remainingSpots <= 0,
        pricing: {
          bookingFeeCents: config.bookingFeeCents,
          monthlyFeeCents: config.monthlyFeeCents,
          monthlyDurationMonths: config.monthlyDurationMonths,
          postPromoMonthlyFeeCents: config.postPromoMonthlyFeeCents
        }
      };
    });
  }

  /**
   * Get availability for a specific tier
   */
  async getTierAvailability(tier: EarlyAccessTierType) {
    const spot = await this.prisma.earlyAccessSpot.findUnique({
      where: { tier }
    });

    if (!spot) {
      throw new NotFoundException(`Tier ${tier} not found`);
    }

    const config = TIER_CONFIG[tier];
    return {
      tier: spot.tier,
      totalSpots: spot.totalSpots,
      remainingSpots: spot.remainingSpots,
      isSoldOut: spot.remainingSpots <= 0,
      pricing: {
        bookingFeeCents: config.bookingFeeCents,
        monthlyFeeCents: config.monthlyFeeCents,
        monthlyDurationMonths: config.monthlyDurationMonths,
        postPromoMonthlyFeeCents: config.postPromoMonthlyFeeCents
      }
    };
  }

  /**
   * Enroll an organization in early access
   * Called during signup flow after organization is created
   */
  async enrollOrganization(organizationId: string, tier: EarlyAccessTierType) {
    const config = TIER_CONFIG[tier];

    // Check if already enrolled
    const existing = await this.prisma.earlyAccessEnrollment.findUnique({
      where: { organizationId }
    });

    if (existing) {
      throw new ConflictException("Organization already enrolled in early access");
    }

    // Atomically decrement spot and create enrollment
    const result = await this.prisma.$transaction(async (tx: typeof this.prisma) => {
      // Try to decrement the spot count
      const spot = await tx.earlyAccessSpot.update({
        where: {
          tier,
          remainingSpots: { gt: 0 } // Only if spots available
        },
        data: {
          remainingSpots: { decrement: 1 }
        }
      }).catch(() => null);

      if (!spot) {
        throw new BadRequestException(
          `No spots remaining in ${tier} tier. Please select a different tier.`
        );
      }

      // Calculate when monthly fee promo ends
      let monthlyFeeEndsAt: Date | null = null;
      if (config.monthlyDurationMonths !== null) {
        monthlyFeeEndsAt = new Date();
        monthlyFeeEndsAt.setMonth(
          monthlyFeeEndsAt.getMonth() + config.monthlyDurationMonths
        );
      }

      // Create enrollment
      const enrollment = await tx.earlyAccessEnrollment.create({
        data: {
          organizationId,
          tier,
          lockedBookingFee: config.bookingFeeCents,
          monthlyFeeEndsAt,
          lockedMonthlyFee: config.postPromoMonthlyFeeCents || null
        }
      });

      return enrollment;
    });

    return result;
  }

  /**
   * Get enrollment details for an organization
   */
  async getEnrollment(organizationId: string) {
    const enrollment = await this.prisma.earlyAccessEnrollment.findUnique({
      where: { organizationId }
    });

    if (!enrollment) {
      return null;
    }

    const config = TIER_CONFIG[enrollment.tier as EarlyAccessTierType];

    return {
      ...enrollment,
      tierConfig: config,
      isInPromoperiod:
        !enrollment.monthlyFeeEndsAt ||
        enrollment.monthlyFeeEndsAt > new Date()
    };
  }

  /**
   * Check if early access program is still active (has spots)
   */
  async isProgramActive(): Promise<boolean> {
    const spots = await this.prisma.earlyAccessSpot.findMany();
    return spots.some((s: EarlyAccessSpotRecord) => s.remainingSpots > 0);
  }

  /**
   * Get total enrolled count across all tiers
   */
  async getEnrolledCount(): Promise<number> {
    return this.prisma.earlyAccessEnrollment.count();
  }

  /**
   * Admin: Manually adjust spot count (for corrections)
   */
  async adminAdjustSpots(tier: EarlyAccessTierType, adjustment: number) {
    return this.prisma.earlyAccessSpot.update({
      where: { tier },
      data: {
        remainingSpots: { increment: adjustment }
      }
    });
  }

  /**
   * Self-service signup flow
   * Creates organization, reserves spot, creates onboarding session, sends welcome email
   */
  async signup(dto: EarlyAccessSignupDto) {
    const config = TIER_CONFIG[dto.tier];

    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check if user already has an organization/enrollment
    const existingEnrollment = await this.prisma.earlyAccessEnrollment.findFirst({
      where: {
        organization: {
          campgrounds: {
            some: {
              memberships: {
                some: { userId: dto.userId }
              }
            }
          }
        }
      }
    });

    if (existingEnrollment) {
      throw new ConflictException("You already have an active early access enrollment");
    }

    // Generate onboarding token
    const onboardingToken = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to complete onboarding

    // Atomically: reserve spot, create org, create enrollment, create onboarding invite
    const result = await this.prisma.$transaction(async (tx: typeof this.prisma) => {
      // Try to decrement the spot count
      const spot = await tx.earlyAccessSpot.update({
        where: {
          tier: dto.tier,
          remainingSpots: { gt: 0 }
        },
        data: {
          remainingSpots: { decrement: 1 }
        }
      }).catch(() => null);

      if (!spot) {
        throw new BadRequestException(
          `No spots remaining in ${dto.tier} tier. Please select a different tier.`
        );
      }

      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: dto.campgroundName
        }
      });

      // Calculate when monthly fee promo ends
      let monthlyFeeEndsAt: Date | null = null;
      if (config.monthlyDurationMonths !== null) {
        monthlyFeeEndsAt = new Date();
        monthlyFeeEndsAt.setMonth(
          monthlyFeeEndsAt.getMonth() + config.monthlyDurationMonths
        );
      }

      // Create early access enrollment
      const enrollment = await tx.earlyAccessEnrollment.create({
        data: {
          organizationId: organization.id,
          tier: dto.tier,
          lockedBookingFee: config.bookingFeeCents,
          monthlyFeeEndsAt,
          lockedMonthlyFee: config.postPromoMonthlyFeeCents || null
        }
      });

      // Create onboarding invite
      const invite = await tx.onboardingInvite.create({
        data: {
          token: onboardingToken,
          email: user.email,
          organizationId: organization.id,
          expiresAt
        }
      });

      // Create onboarding session
      await tx.onboardingSession.create({
        data: {
          inviteId: invite.id,
          organizationId: organization.id,
          status: "pending",
          currentStep: "account_profile",
          data: {
            campgroundName: dto.campgroundName,
            phone: dto.phone,
            userId: dto.userId,
            tier: dto.tier,
            referralCode: dto.referralCode
          }
        }
      });

      return { organization, enrollment, invite };
    });

    // Send welcome email with onboarding link
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const onboardingUrl = `${frontendUrl}/onboarding/${onboardingToken}`;

    await this.emailService.sendEmail({
      to: user.email,
      subject: `Welcome to Camp Everyday - Let's Set Up ${dto.campgroundName}!`,
      html: this.generateWelcomeEmail({
        firstName: user.firstName || "there",
        campgroundName: dto.campgroundName,
        tier: dto.tier,
        tierName: this.getTierDisplayName(dto.tier),
        onboardingUrl,
        bookingFee: `$${(config.bookingFeeCents / 100).toFixed(2)}`
      })
    });

    return {
      success: true,
      organizationId: result.organization.id,
      enrollmentId: result.enrollment.id,
      onboardingUrl
    };
  }

  private getTierDisplayName(tier: EarlyAccessTierType): string {
    const names: Record<EarlyAccessTierType, string> = {
      founders_circle: "Founder's Circle",
      pioneer: "Pioneer",
      trailblazer: "Trailblazer"
    };
    return names[tier];
  }

  private generateWelcomeEmail(params: {
    firstName: string;
    campgroundName: string;
    tier: string;
    tierName: string;
    onboardingUrl: string;
    bookingFee: string;
  }): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 80px; height: 80px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m4 20 8-14 8 14" />
              <path d="M2 20h20" />
            </svg>
          </div>
          <h1 style="color: #0f172a; margin: 0;">Welcome to Camp Everyday!</h1>
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px; color: white;">
          <p style="margin: 0 0 8px 0; opacity: 0.9;">You've secured your spot as a</p>
          <h2 style="margin: 0; font-size: 28px;">${params.tierName}</h2>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">
            Your booking fee: <strong>${params.bookingFee}</strong> (locked forever!)
          </p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 16px 0; color: #334155;">
            Hey ${params.firstName}!
          </p>
          <p style="margin: 0 0 16px 0; color: #334155;">
            Congratulations on joining Camp Everyday's Early Access Program! You've made a great choice for <strong>${params.campgroundName}</strong>.
          </p>
          <p style="margin: 0; color: #334155;">
            Let's get your campground set up. Click the button below to continue with your setup - it only takes about 10 minutes.
          </p>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${params.onboardingUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 18px;">
            Complete Your Setup
          </a>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Important:</strong> This link expires in 7 days. Complete your setup soon to secure your early access pricing!
          </p>
        </div>

        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">
            Questions? Reply to this email or text us at (555) 123-4567
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Camp Everyday - Making campground management effortless
          </p>
        </div>
      </div>
    `;
  }
}
