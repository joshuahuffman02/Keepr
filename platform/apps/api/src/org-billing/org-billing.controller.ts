import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import { OrgBillingService } from "./org-billing.service";
import { SubscriptionService } from "./subscription.service";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { UserRole, PlatformRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Controller("organizations/:organizationId/billing")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.owner, UserRole.manager, UserRole.finance, PlatformRole.platform_admin)
export class OrgBillingController {
  constructor(
    private billingService: OrgBillingService,
    private subscriptionService: SubscriptionService,
    private prisma: PrismaService
  ) {}

  /**
   * Validates that the user has access to the organization via campground membership.
   * Platform admins bypass this check.
   */
  private async validateOrgAccess(organizationId: string, user: any): Promise<void> {
    // Platform admins can access any organization
    if (user.platformRole === "platform_admin" || user.platformRole === "platform_superadmin") {
      return;
    }

    // Check if user has membership to any campground in this organization
    const userCampgroundIds = (user.memberships || []).map((m: any) => m.campgroundId);
    if (userCampgroundIds.length === 0) {
      throw new ForbiddenException("You do not have access to this organization");
    }

    const campgroundInOrg = await this.prisma.campground.findFirst({
      where: {
        organizationId,
        id: { in: userCampgroundIds },
      },
      select: { id: true },
    });

    if (!campgroundInOrg) {
      throw new ForbiddenException("You do not have access to this organization");
    }
  }

  /**
   * Validates that a billing period belongs to the specified organization.
   * This prevents cross-organization billing manipulation.
   */
  private async validatePeriodOwnership(periodId: string, organizationId: string): Promise<void> {
    const period = await this.prisma.organizationBillingPeriod.findUnique({
      where: { id: periodId },
      select: { organizationId: true },
    });

    if (!period) {
      throw new ForbiddenException("Billing period not found");
    }

    if (period.organizationId !== organizationId) {
      throw new ForbiddenException(
        "Billing period does not belong to the specified organization"
      );
    }
  }

  /**
   * Get billing summary for current period
   */
  @Get("summary")
  async getBillingSummary(@Param("organizationId") organizationId: string, @Req() req: any) {
    await this.validateOrgAccess(organizationId, req.user);
    return this.billingService.getBillingSummary(organizationId);
  }

  /**
   * Get current billing period
   */
  @Get("current-period")
  async getCurrentPeriod(@Param("organizationId") organizationId: string, @Req() req: any) {
    await this.validateOrgAccess(organizationId, req.user);
    return this.billingService.getCurrentPeriod(organizationId);
  }

  /**
   * Get billing history
   */
  @Get("history")
  async getBillingHistory(
    @Param("organizationId") organizationId: string,
    @Query("limit") limit?: string,
    @Req() req?: any
  ) {
    await this.validateOrgAccess(organizationId, req?.user);
    return this.billingService.getBillingHistory(
      organizationId,
      limit ? parseInt(limit, 10) : 12
    );
  }

  /**
   * Get usage details
   */
  @Get("usage")
  async getUsageDetails(
    @Param("organizationId") organizationId: string,
    @Query("eventType") eventType?: string,
    @Query("periodStart") periodStartStr?: string,
    @Query("periodEnd") periodEndStr?: string,
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string,
    @Req() req?: any
  ) {
    await this.validateOrgAccess(organizationId, req?.user);
    const periodStart = periodStartStr ? new Date(periodStartStr) : undefined;
    const periodEnd = periodEndStr ? new Date(periodEndStr) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    return this.billingService.getUsageDetails(
      organizationId,
      eventType,
      periodStart,
      periodEnd,
      limit,
      offset
    );
  }

  /**
   * Record a usage event (internal use / testing)
   */
  @Post("usage")
  async recordUsageEvent(
    @Param("organizationId") organizationId: string,
    @Body()
    body: {
      campgroundId?: string;
      eventType: string;
      quantity?: number;
      referenceType?: string;
      referenceId?: string;
      metadata?: Record<string, unknown>;
    },
    @Req() req?: any
  ) {
    await this.validateOrgAccess(organizationId, req?.user);
    return this.billingService.recordUsageEvent({
      organizationId,
      ...body,
    });
  }

  /**
   * Finalize a billing period (admin only)
   * SECURITY: Validates that the period belongs to the organization in the URL
   */
  @Post("periods/:periodId/finalize")
  @Roles(PlatformRole.platform_admin)
  async finalizePeriod(
    @Param("organizationId") organizationId: string,
    @Param("periodId") periodId: string,
    @Req() req: any
  ) {
    // Validate period ownership to prevent cross-org manipulation
    await this.validatePeriodOwnership(periodId, organizationId);
    
    // Even for platform admins, validate org access for audit trail
    await this.validateOrgAccess(organizationId, req.user);
    
    return this.billingService.finalizePeriod(periodId);
  }

  /**
   * Mark period as paid (webhook / admin)
   * SECURITY: Validates that the period belongs to the organization in the URL
   */
  @Post("periods/:periodId/paid")
  @Roles(PlatformRole.platform_admin)
  async markPeriodPaid(
    @Param("organizationId") organizationId: string,
    @Param("periodId") periodId: string,
    @Body() body: { stripePaymentIntentId?: string },
    @Req() req: any
  ) {
    // Validate period ownership to prevent cross-org manipulation
    await this.validatePeriodOwnership(periodId, organizationId);
    
    // Even for platform admins, validate org access for audit trail
    await this.validateOrgAccess(organizationId, req.user);
    
    return this.billingService.markPeriodPaid(periodId, body.stripePaymentIntentId);
  }

  // ==========================================================================
  // Stripe Subscription Endpoints
  // ==========================================================================

  /**
   * Get Stripe subscription details
   */
  @Get("subscription")
  async getSubscription(@Param("organizationId") organizationId: string, @Req() req: any) {
    await this.validateOrgAccess(organizationId, req.user);
    const subscription = await this.subscriptionService.getSubscription(organizationId);
    if (!subscription) {
      return { hasSubscription: false };
    }
    return {
      hasSubscription: true,
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      items: subscription.items.data.map((item: any) => ({
        id: item.id,
        priceId: item.price.id,
        nickname: item.price.nickname,
        unitAmount: item.price.unit_amount,
        recurring: item.price.recurring,
      })),
    };
  }

  /**
   * Create a subscription for the organization
   */
  @Post("subscription")
  async createSubscription(
    @Param("organizationId") organizationId: string,
    @Body() body: { tier?: string },
    @Req() req: any
  ) {
    await this.validateOrgAccess(organizationId, req.user);
    return this.subscriptionService.createSubscription(
      organizationId,
      body.tier || "standard"
    );
  }

  /**
   * Cancel subscription
   */
  @Delete("subscription")
  async cancelSubscription(
    @Param("organizationId") organizationId: string,
    @Query("immediately") immediately?: string,
    @Req() req?: any
  ) {
    await this.validateOrgAccess(organizationId, req?.user);
    return this.subscriptionService.cancelSubscription(
      organizationId,
      immediately === "true"
    );
  }

  /**
   * Get billing portal URL for self-service
   */
  @Post("portal")
  async getBillingPortal(
    @Param("organizationId") organizationId: string,
    @Body() body: { returnUrl: string },
    @Req() req: any
  ) {
    await this.validateOrgAccess(organizationId, req.user);
    const url = await this.subscriptionService.getBillingPortalUrl(
      organizationId,
      body.returnUrl
    );
    return { url };
  }

  /**
   * Get current Stripe usage (metered billing)
   */
  @Get("stripe-usage")
  async getStripeUsage(@Param("organizationId") organizationId: string, @Req() req: any) {
    await this.validateOrgAccess(organizationId, req.user);
    return this.subscriptionService.getCurrentUsage(organizationId);
  }

  /**
   * Change subscription tier
   */
  @Post("subscription/change-tier")
  async changeTier(
    @Param("organizationId") organizationId: string,
    @Body() body: { tier: string },
    @Req() req: any
  ) {
    await this.validateOrgAccess(organizationId, req.user);
    return this.subscriptionService.changeTier(organizationId, body.tier);
  }
}
