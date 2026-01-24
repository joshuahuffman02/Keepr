import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { OrgReferralStatus } from "@prisma/client";

const CREDIT_AMOUNT_CENTS = 5000; // $50

@Injectable()
export class OrgReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create a referral code for an organization
   */
  async getOrCreateReferralCode(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { referralCode: true, name: true },
    });

    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    if (org.referralCode) {
      return org.referralCode;
    }

    // Generate a unique code based on org name
    const baseCode = this.generateCode(org.name);
    let code = baseCode;
    let attempt = 0;

    // Ensure uniqueness
    while (await this.prisma.organization.findFirst({ where: { referralCode: code } })) {
      attempt++;
      code = `${baseCode}${attempt}`;
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { referralCode: code },
    });

    return code;
  }

  /**
   * Get referral stats for an organization
   */
  async getReferralStats(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { referralCode: true, referralCredits: true },
    });

    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    // Ensure org has a referral code
    const referralCode = org.referralCode || (await this.getOrCreateReferralCode(organizationId));

    // Get referral counts by status
    const referrals = await this.prisma.orgReferral.groupBy({
      by: ["status"],
      where: { referrerOrgId: organizationId },
      _count: { status: true },
    });

    const counts: Record<OrgReferralStatus, number> = {
      clicked: 0,
      signed_up: 0,
      converted: 0,
      credited: 0,
    };

    for (const r of referrals) {
      counts[r.status] = r._count.status;
    }

    // Calculate pending credits (converted but not yet credited)
    const pendingReferrals = await this.prisma.orgReferral.count({
      where: {
        referrerOrgId: organizationId,
        status: OrgReferralStatus.converted,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.keeprstay.com";

    return {
      referralCode,
      referralLink: `${appUrl}/signup?ref=${referralCode}`,
      stats: {
        totalClicks: counts.clicked + counts.signed_up + counts.converted + counts.credited,
        totalSignups: counts.signed_up + counts.converted + counts.credited,
        totalConversions: counts.converted + counts.credited,
        pendingCredits: pendingReferrals * (CREDIT_AMOUNT_CENTS / 100),
        earnedCredits: org.referralCredits / 100,
      },
    };
  }

  /**
   * Get referral history for an organization
   */
  async getReferralHistory(organizationId: string) {
    const referrals = await this.prisma.orgReferral.findMany({
      where: { referrerOrgId: organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        referredEmail: true,
        status: true,
        creditAmountCents: true,
        clickedAt: true,
        signedUpAt: true,
        convertedAt: true,
        creditedAt: true,
        createdAt: true,
        Organization_OrgReferral_referredOrgIdToOrganization: {
          select: { name: true },
        },
      },
    });

    return referrals.map((r) => ({
      id: r.id,
      referredEmail: r.referredEmail,
      referredOrgName: r.Organization_OrgReferral_referredOrgIdToOrganization?.name,
      status: r.status,
      creditAmount: r.creditAmountCents / 100,
      createdAt: r.clickedAt.toISOString(),
      convertedAt: r.convertedAt?.toISOString(),
    }));
  }

  /**
   * Track a referral link click
   */
  async trackClick(
    referralCode: string,
    metadata?: {
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    const referrerOrg = await this.prisma.organization.findFirst({
      where: { referralCode },
    });

    if (!referrerOrg) {
      throw new NotFoundException("Invalid referral code");
    }

    // Create click record
    const referral = await this.prisma.orgReferral.create({
      data: {
        id: randomUUID(),
        referrerOrgId: referrerOrg.id,
        referralCode,
        status: OrgReferralStatus.clicked,
        ...metadata,
        updatedAt: new Date(),
      },
    });

    return { id: referral.id, referralCode };
  }

  /**
   * Update referral when user signs up
   */
  async trackSignup(referralCode: string, email: string, newOrgId?: string) {
    // Find the most recent click with this code that hasn't been used
    const referral = await this.prisma.orgReferral.findFirst({
      where: {
        referralCode,
        status: OrgReferralStatus.clicked,
      },
      orderBy: { clickedAt: "desc" },
    });

    if (!referral) {
      // Create a new referral entry if no click was tracked
      const referrerOrg = await this.prisma.organization.findFirst({
        where: { referralCode },
      });

      if (!referrerOrg) {
        throw new NotFoundException("Invalid referral code");
      }

      await this.prisma.orgReferral.create({
        data: {
          id: randomUUID(),
          referrerOrgId: referrerOrg.id,
          referredOrgId: newOrgId,
          referredEmail: email,
          referralCode,
          status: OrgReferralStatus.signed_up,
          signedUpAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      // Update existing click record
      await this.prisma.orgReferral.update({
        where: { id: referral.id },
        data: {
          referredOrgId: newOrgId,
          referredEmail: email,
          status: OrgReferralStatus.signed_up,
          signedUpAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return { success: true };
  }

  /**
   * Convert a referral when the referred org gets their first booking
   */
  async convertReferral(referredOrgId: string) {
    const referral = await this.prisma.orgReferral.findFirst({
      where: {
        referredOrgId,
        status: OrgReferralStatus.signed_up,
      },
    });

    if (!referral) {
      return { converted: false };
    }

    // Update referral status
    await this.prisma.orgReferral.update({
      where: { id: referral.id },
      data: {
        status: OrgReferralStatus.converted,
        convertedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { converted: true, referralId: referral.id };
  }

  /**
   * Apply credits for converted referrals
   */
  async applyCredits(referralId: string) {
    const referral = await this.prisma.orgReferral.findUnique({
      where: { id: referralId },
      select: {
        status: true,
        referrerOrgId: true,
        referredOrgId: true,
        creditAmountCents: true,
      },
    });

    if (!referral || referral.status !== OrgReferralStatus.converted) {
      throw new BadRequestException("Referral is not eligible for credits");
    }

    // Apply credits to both orgs
    await this.prisma.$transaction([
      // Credit to referrer
      this.prisma.organization.update({
        where: { id: referral.referrerOrgId },
        data: {
          referralCredits: { increment: referral.creditAmountCents },
        },
      }),
      // Credit to referred (if exists)
      ...(referral.referredOrgId
        ? [
            this.prisma.organization.update({
              where: { id: referral.referredOrgId },
              data: {
                referralCredits: { increment: referral.creditAmountCents },
              },
            }),
          ]
        : []),
      // Mark referral as credited
      this.prisma.orgReferral.update({
        where: { id: referralId },
        data: {
          status: OrgReferralStatus.credited,
          creditedAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ]);

    return { success: true, creditAmount: referral.creditAmountCents / 100 };
  }

  /**
   * Generate a referral code from org name
   */
  private generateCode(name: string): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const prefix = name
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4)
      .padEnd(4, "X");

    let suffix = "";
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `${prefix}-${suffix}`;
  }
}
