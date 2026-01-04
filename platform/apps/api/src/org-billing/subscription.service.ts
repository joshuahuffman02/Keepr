import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../payments/stripe.service";
import { EmailService } from "../email/email.service";

/**
 * Maps our internal tier names to Stripe price configuration
 * These will be populated after running setup-stripe-billing.ts
 */
interface TierPriceConfig {
  monthlyPriceId: string | null; // null for $0 tiers
  bookingFeePriceId: string;
  couponId?: string;
  trialDays?: number;
}

// These IDs should be set from environment variables after running setup script
const STRIPE_PRICE_IDS: Record<string, TierPriceConfig> = {
  founders_circle: {
    monthlyPriceId: process.env.STRIPE_PRICE_FOUNDERS_MONTHLY || null,
    bookingFeePriceId: process.env.STRIPE_PRICE_FOUNDERS_BOOKING_FEE || "",
    couponId: process.env.STRIPE_COUPON_FOUNDERS,
  },
  pioneer: {
    monthlyPriceId: process.env.STRIPE_PRICE_PIONEER_MONTHLY || null,
    bookingFeePriceId: process.env.STRIPE_PRICE_PIONEER_BOOKING_FEE || "",
    couponId: process.env.STRIPE_COUPON_PIONEER,
    trialDays: 365, // 12 months free
  },
  trailblazer: {
    monthlyPriceId: process.env.STRIPE_PRICE_TRAILBLAZER_MONTHLY || null,
    bookingFeePriceId: process.env.STRIPE_PRICE_TRAILBLAZER_BOOKING_FEE || "",
    couponId: process.env.STRIPE_COUPON_TRAILBLAZER,
  },
  standard: {
    monthlyPriceId: process.env.STRIPE_PRICE_STANDARD_MONTHLY || "",
    bookingFeePriceId: process.env.STRIPE_PRICE_STANDARD_BOOKING_FEE || "",
  },
};

const STRIPE_SMS_PRICE_IDS = {
  outbound: process.env.STRIPE_PRICE_SMS_OUTBOUND || "",
  inbound: process.env.STRIPE_PRICE_SMS_INBOUND || "",
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Create or get a Stripe customer for an organization
   */
  async ensureStripeCustomer(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: {
        campgrounds: {
          take: 1,
          include: {
            memberships: {
              where: { role: "owner" },
              include: { user: true },
              take: 1,
            },
          },
        },
      },
    });

    // If org already has a Stripe customer, return it
    if (org.stripeCustomerId) {
      return org.stripeCustomerId;
    }

    // Get billing email - prefer billingEmail, then owner email from first campground
    const ownerEmail =
      org.billingEmail ||
      org.campgrounds[0]?.memberships[0]?.user?.email ||
      `org-${org.id}@keeprstay.com`;

    // Create new Stripe customer
    const customer = await this.stripe.createOrGetCustomer(
      organizationId,
      ownerEmail,
      org.billingName || org.name,
      {
        organizationId,
        tier: org.billingTier || "standard",
      }
    );

    // Store customer ID on organization
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customer.id },
    });

    this.logger.log(`Created Stripe customer ${customer.id} for org ${organizationId}`);
    return customer.id;
  }

  /**
   * Create a subscription for an organization based on their tier
   */
  async createSubscription(
    organizationId: string,
    tier: string = "standard"
  ): Promise<{
    subscriptionId: string;
    status: string;
  }> {
    const customerId = await this.ensureStripeCustomer(organizationId);
    const tierConfig = STRIPE_PRICE_IDS[tier] || STRIPE_PRICE_IDS.standard;

    // Build subscription items
    const items: Array<{ price: string; quantity?: number }> = [];

    // Add monthly subscription price (if not $0)
    if (tierConfig.monthlyPriceId) {
      items.push({ price: tierConfig.monthlyPriceId });
    }

    // Add metered booking fee price
    if (tierConfig.bookingFeePriceId) {
      items.push({ price: tierConfig.bookingFeePriceId });
    }

    // Add SMS prices
    if (STRIPE_SMS_PRICE_IDS.outbound) {
      items.push({ price: STRIPE_SMS_PRICE_IDS.outbound });
    }
    if (STRIPE_SMS_PRICE_IDS.inbound) {
      items.push({ price: STRIPE_SMS_PRICE_IDS.inbound });
    }

    if (items.length === 0) {
      throw new BadRequestException(`No valid Stripe prices configured for tier: ${tier}`);
    }

    // Create the subscription
    const subscription = await this.stripe.createSubscriptionWithItems(
      customerId,
      items,
      {
        organizationId,
        tier,
      },
      tierConfig.trialDays,
      tierConfig.couponId
    );

    // Store subscription ID on organization
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        stripeSubscriptionId: subscription.id,
        billingTier: tier,
      },
    });

    this.logger.log(
      `Created subscription ${subscription.id} for org ${organizationId} on tier ${tier}`
    );

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
    };
  }

  /**
   * Get subscription details for an organization
   */
  async getSubscription(organizationId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    if (!org.stripeSubscriptionId) {
      return null;
    }

    return this.stripe.getSubscription(org.stripeSubscriptionId);
  }

  /**
   * Cancel subscription (at period end by default)
   */
  async cancelSubscription(
    organizationId: string,
    cancelImmediately: boolean = false
  ) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    if (!org.stripeSubscriptionId) {
      throw new NotFoundException("Organization has no active subscription");
    }

    const result = await this.stripe.cancelSubscription(
      org.stripeSubscriptionId,
      !cancelImmediately // cancelAtPeriodEnd
    );

    this.logger.log(
      `Cancelled subscription ${org.stripeSubscriptionId} for org ${organizationId}`
    );

    return result;
  }

  /**
   * Report a booking to Stripe for metered billing
   */
  async reportBookingUsage(
    organizationId: string,
    reservationId: string,
    quantity: number = 1
  ) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    if (!org.stripeSubscriptionId) {
      this.logger.warn(
        `Cannot report booking usage - org ${organizationId} has no subscription`
      );
      return null;
    }

    // Get subscription to find the booking fee subscription item
    const subscription = await this.stripe.getSubscription(org.stripeSubscriptionId);
    const tierConfig = STRIPE_PRICE_IDS[org.billingTier || "standard"];

    if (!tierConfig?.bookingFeePriceId) {
      this.logger.warn(`No booking fee price configured for tier ${org.billingTier}`);
      return null;
    }

    // Find the subscription item for booking fees
    const bookingFeeItem = subscription.items.data.find(
      (item: any) => item.price.id === tierConfig.bookingFeePriceId
    );

    if (!bookingFeeItem) {
      this.logger.warn(
        `Booking fee subscription item not found for org ${organizationId}`
      );
      return null;
    }

    // Report usage to Stripe
    const usageRecord = await this.stripe.reportUsage(
      bookingFeeItem.id,
      quantity,
      Math.floor(Date.now() / 1000),
      "increment"
    );

    this.logger.log(
      `Reported ${quantity} booking(s) for org ${organizationId}, reservation ${reservationId}`
    );

    return usageRecord;
  }

  /**
   * Report SMS usage to Stripe for metered billing
   */
  async reportSmsUsage(
    organizationId: string,
    direction: "outbound" | "inbound",
    quantity: number = 1
  ) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    if (!org.stripeSubscriptionId) {
      this.logger.warn(
        `Cannot report SMS usage - org ${organizationId} has no subscription`
      );
      return null;
    }

    const priceId = direction === "outbound"
      ? STRIPE_SMS_PRICE_IDS.outbound
      : STRIPE_SMS_PRICE_IDS.inbound;

    if (!priceId) {
      this.logger.warn(`No SMS ${direction} price configured`);
      return null;
    }

    // Get subscription to find the SMS subscription item
    const subscription = await this.stripe.getSubscription(org.stripeSubscriptionId);

    const smsItem = subscription.items.data.find(
      (item: any) => item.price.id === priceId
    );

    if (!smsItem) {
      this.logger.warn(
        `SMS ${direction} subscription item not found for org ${organizationId}`
      );
      return null;
    }

    // Report usage to Stripe
    const usageRecord = await this.stripe.reportUsage(
      smsItem.id,
      quantity,
      Math.floor(Date.now() / 1000),
      "increment"
    );

    this.logger.log(
      `Reported ${quantity} ${direction} SMS for org ${organizationId}`
    );

    return usageRecord;
  }

  /**
   * Get billing portal URL for self-service management
   */
  async getBillingPortalUrl(
    organizationId: string,
    returnUrl: string
  ): Promise<string> {
    const customerId = await this.ensureStripeCustomer(organizationId);
    const session = await this.stripe.createBillingPortalSession(
      customerId,
      returnUrl
    );
    return session.url;
  }

  /**
   * Get usage records for the current billing period
   */
  async getCurrentUsage(organizationId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    if (!org.stripeSubscriptionId) {
      return null;
    }

    const subscription = await this.stripe.getSubscription(org.stripeSubscriptionId);
    const tierConfig = STRIPE_PRICE_IDS[org.billingTier || "standard"];

    const usage: Record<string, any> = {
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000),
      items: {},
    };

    // Get usage for each metered item
    for (const item of subscription.items.data) {
      if (item.price.recurring?.usage_type === "metered") {
        try {
          const records = await this.stripe.getUsageRecords(item.id, 1);
          usage.items[item.price.nickname || item.price.id] = {
            priceId: item.price.id,
            totalUsage: records.data[0]?.total_usage || 0,
            unitAmount: item.price.unit_amount,
          };
        } catch (error) {
          this.logger.warn(`Could not fetch usage for item ${item.id}:`, error);
        }
      }
    }

    return usage;
  }

  /**
   * Upgrade or downgrade a subscription tier
   * Note: This is complex and should be done carefully
   */
  async changeTier(organizationId: string, newTier: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    if (!org.stripeSubscriptionId) {
      // If no subscription exists, create one
      return this.createSubscription(organizationId, newTier);
    }

    // For tier changes, it's often easier to cancel and recreate
    // This ensures clean metered billing
    // In production, you might want to prorate or handle this more gracefully

    this.logger.log(
      `Changing tier for org ${organizationId} from ${org.billingTier} to ${newTier}`
    );

    // Cancel at period end to avoid prorated charges
    await this.cancelSubscription(organizationId, false);

    // Update the tier in our database - new subscription will be created on next billing cycle
    // Or you could create a new one immediately with a trial to cover the remaining period
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { billingTier: newTier },
    });

    return { message: "Tier change scheduled", newTier };
  }

  /**
   * Handle subscription webhook events
   */
  async handleSubscriptionUpdated(subscriptionId: string, status: string) {
    // Find organization by subscription ID
    const org = await this.prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!org) {
      this.logger.warn(`No organization found for subscription ${subscriptionId}`);
      return;
    }

    // Update status based on subscription state
    if (status === "canceled" || status === "unpaid") {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { billingStatus: "suspended" },
      });
      this.logger.log(`Suspended org ${org.id} due to subscription ${status}`);
    } else if (status === "active") {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { billingStatus: "active" },
      });
      this.logger.log(`Activated org ${org.id} subscription`);
    }
  }

  /**
   * Handle invoice payment succeeded
   */
  async handleInvoicePaid(invoiceId: string, customerId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!org) {
      this.logger.warn(`No organization found for customer ${customerId}`);
      return;
    }

    // Record the payment in our billing system
    const invoice = await this.stripe.getInvoice(invoiceId);

    // Find or create the billing period
    const periodStart = new Date(invoice.period_start * 1000);
    const periodEnd = new Date(invoice.period_end * 1000);

    await this.prisma.organizationBillingPeriod.upsert({
      where: {
        organizationId_periodStart: {
          organizationId: org.id,
          periodStart,
        },
      },
      create: {
        organizationId: org.id,
        periodStart,
        periodEnd,
        status: "paid",
        stripeInvoiceId: invoiceId,
        totalCents: invoice.amount_paid,
        paidAt: new Date(),
      },
      update: {
        status: "paid",
        stripeInvoiceId: invoiceId,
        totalCents: invoice.amount_paid,
        paidAt: new Date(),
      },
    });

    this.logger.log(`Recorded payment for org ${org.id}, invoice ${invoiceId}`);
  }

  /**
   * Handle invoice payment failed
   */
  async handleInvoiceFailed(invoiceId: string, customerId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!org) {
      this.logger.warn(`No organization found for customer ${customerId}`);
      return;
    }

    // Update billing period status
    const invoice = await this.stripe.getInvoice(invoiceId);
    const periodStart = new Date(invoice.period_start * 1000);

    await this.prisma.organizationBillingPeriod.updateMany({
      where: {
        organizationId: org.id,
        periodStart,
      },
      data: {
        status: "past_due",
        stripeInvoiceId: invoiceId,
      },
    });

    this.logger.warn(`Payment failed for org ${org.id}, invoice ${invoiceId}`);

    // Send notification to org owner about failed payment
    await this.notifyOrgOwnerPaymentFailed(org, invoice);
  }

  /**
   * Send notification to org owner about failed payment
   */
  private async notifyOrgOwnerPaymentFailed(org: any, invoice: any) {
    try {
      // Get the org owner (user with owner role in this org)
      const ownerMembership = await this.prisma.campgroundMembership.findFirst({
        where: {
          campground: { organizationId: org.id },
          role: "owner",
        },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      });

      if (!ownerMembership?.user?.email) {
        this.logger.warn(`No owner email found for org ${org.id}, cannot send payment failed notification`);
        return;
      }

      const amountDue = invoice.amount_due ? `$${(invoice.amount_due / 100).toFixed(2)}` : "the amount due";
      const dueDate = invoice.due_date
        ? new Date(invoice.due_date * 1000).toLocaleDateString()
        : "soon";

      await this.emailService.sendEmail({
        to: ownerMembership.user.email,
        subject: `[Action Required] Payment Failed for ${org.name}`,
        html: `
          <h2>Payment Failed</h2>
          <p>Hi ${ownerMembership.user.firstName || "there"},</p>
          <p>We were unable to process your payment of <strong>${amountDue}</strong> for your ${org.name} subscription.</p>
          <p>To avoid service interruption, please update your payment method as soon as possible.</p>
          <p><strong>Invoice ID:</strong> ${invoice.id}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
          <p>If you believe this is an error or need assistance, please contact our support team.</p>
          <p>Thank you,<br/>The Keepr Team</p>
        `,
      });

      this.logger.log(`Payment failed notification sent to ${ownerMembership.user.email} for org ${org.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to send payment failed notification for org ${org.id}: ${error.message}`);
    }
  }
}
