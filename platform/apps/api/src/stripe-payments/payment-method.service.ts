import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../payments/stripe.service";
import { CustomerService } from "./customer.service";
import type { GuestPaymentMethod } from "@prisma/client";
import { randomUUID } from "crypto";

export interface PaymentMethodInfo {
  id: string;
  stripePaymentMethodId: string;
  type: string;
  last4: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  bankName: string | null;
  isDefault: boolean;
  nickname: string | null;
  addedBy: string;
  createdAt: Date;
}

@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly customerService: CustomerService,
  ) {}

  /**
   * Create a SetupIntent for adding a new payment method
   * Returns clientSecret for Stripe.js/Elements on the frontend
   */
  async createSetupIntent(
    campgroundId: string,
    guestId: string,
    metadata?: Record<string, string>,
  ): Promise<{ clientSecret: string; setupIntentId: string }> {
    // Get or create customer
    const customer = await this.customerService.getOrCreateCustomer(campgroundId, guestId);

    // Get campground Stripe account
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    // Create SetupIntent on connected account
    const setupIntent = await this.stripe.createSetupIntentOnConnectedAccount(
      campground.stripeAccountId,
      customer.stripeCustomerId,
      { campgroundId, guestId, ...metadata },
    );

    return {
      clientSecret: setupIntent.client_secret!,
      setupIntentId: setupIntent.id,
    };
  }

  /**
   * Attach a payment method to a customer after SetupIntent is confirmed
   * Called after Stripe.js confirms the SetupIntent on the frontend
   */
  async attachPaymentMethod(
    campgroundId: string,
    guestId: string,
    stripePaymentMethodId: string,
    addedBy: "guest" | "staff" | "auto",
    addedByUserId?: string,
    nickname?: string,
    setAsDefault?: boolean,
  ): Promise<PaymentMethodInfo> {
    // Get customer
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found. Create customer first.");
    }

    // Check if payment method already exists
    const existing = await this.prisma.guestPaymentMethod.findFirst({
      where: {
        stripeCustomerId: customer.id,
        stripePaymentMethodId,
      },
    });

    if (existing) {
      // Already attached, just return it
      return this.mapPaymentMethod(existing);
    }

    // Get campground for Stripe account
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    // Retrieve payment method details from Stripe
    const pm = await this.stripe.getPaymentMethodOnConnectedAccount(
      campground.stripeAccountId,
      stripePaymentMethodId,
    );

    // Extract card/bank details
    let last4: string | null = null;
    let brand: string | null = null;
    let expMonth: number | null = null;
    let expYear: number | null = null;
    let bankName: string | null = null;

    if (pm.type === "card" && pm.card) {
      last4 = pm.card.last4;
      brand = pm.card.brand;
      expMonth = pm.card.exp_month;
      expYear = pm.card.exp_year;
    } else if (pm.type === "us_bank_account" && pm.us_bank_account) {
      last4 = pm.us_bank_account.last4;
      bankName = pm.us_bank_account.bank_name;
    } else if (pm.type === "card_present" && pm.card_present) {
      const cardPresent = pm.card_present;
      last4 = cardPresent.last4;
      brand = cardPresent.brand;
      expMonth = cardPresent.exp_month;
      expYear = cardPresent.exp_year;
    }

    // Determine if this should be default (first card = default)
    const existingCount = await this.prisma.guestPaymentMethod.count({
      where: { stripeCustomerId: customer.id },
    });
    const shouldBeDefault = setAsDefault || existingCount === 0;

    // If setting as default, unset others first
    if (shouldBeDefault) {
      await this.prisma.guestPaymentMethod.updateMany({
        where: { stripeCustomerId: customer.id },
        data: { isDefault: false },
      });
    }

    // Store in database
    const paymentMethod = await this.prisma.guestPaymentMethod.create({
      data: {
        id: randomUUID(),
        stripeCustomerId: customer.id,
        stripePaymentMethodId,
        type: pm.type,
        last4,
        brand,
        expMonth,
        expYear,
        bankName,
        isDefault: shouldBeDefault,
        nickname,
        addedBy,
        addedByUserId,
        updatedAt: new Date(),
      },
    });

    // Update customer default if needed
    if (shouldBeDefault) {
      await this.prisma.stripeCustomer.update({
        where: { id: customer.id },
        data: { defaultPaymentMethodId: stripePaymentMethodId },
      });
    }

    return this.mapPaymentMethod(paymentMethod);
  }

  /**
   * Auto-store payment method after a successful payment
   * Called from payment webhook when setup_future_usage was set
   */
  async autoStoreFromPaymentIntent(
    campgroundId: string,
    guestId: string,
    stripePaymentMethodId: string,
  ): Promise<PaymentMethodInfo | null> {
    try {
      return await this.attachPaymentMethod(campgroundId, guestId, stripePaymentMethodId, "auto");
    } catch (error) {
      // If already exists or other error, don't fail the payment
      this.logger.warn("Failed to auto-store payment method:", error);
      return null;
    }
  }

  /**
   * List all payment methods for a guest at a campground
   */
  async listPaymentMethods(campgroundId: string, guestId: string): Promise<PaymentMethodInfo[]> {
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
      include: {
        GuestPaymentMethod: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!customer) {
      return [];
    }

    return customer.GuestPaymentMethod.map((pm) => this.mapPaymentMethod(pm));
  }

  /**
   * Get a specific payment method
   */
  async getPaymentMethod(
    campgroundId: string,
    guestId: string,
    paymentMethodId: string,
  ): Promise<PaymentMethodInfo | null> {
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
    });

    if (!customer) {
      return null;
    }

    const pm = await this.prisma.guestPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        stripeCustomerId: customer.id,
      },
    });

    return pm ? this.mapPaymentMethod(pm) : null;
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(
    campgroundId: string,
    guestId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const pm = await this.prisma.guestPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        stripeCustomerId: customer.id,
      },
    });

    if (!pm) {
      throw new NotFoundException("Payment method not found");
    }

    // Get campground for Stripe account
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (campground?.stripeAccountId) {
      // Detach from Stripe
      try {
        await this.stripe.detachPaymentMethodOnConnectedAccount(
          campground.stripeAccountId,
          pm.stripePaymentMethodId,
        );
      } catch (error) {
        // Log but don't fail if Stripe detach fails
        this.logger.warn("Failed to detach payment method from Stripe:", error);
      }
    }

    // Delete from database
    await this.prisma.guestPaymentMethod.delete({
      where: { id: paymentMethodId },
    });

    // If this was the default, set another as default
    if (pm.isDefault) {
      const nextDefault = await this.prisma.guestPaymentMethod.findFirst({
        where: { stripeCustomerId: customer.id },
        orderBy: { createdAt: "desc" },
      });

      if (nextDefault) {
        await this.prisma.guestPaymentMethod.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
        await this.prisma.stripeCustomer.update({
          where: { id: customer.id },
          data: { defaultPaymentMethodId: nextDefault.stripePaymentMethodId },
        });
      } else {
        await this.prisma.stripeCustomer.update({
          where: { id: customer.id },
          data: { defaultPaymentMethodId: null },
        });
      }
    }
  }

  /**
   * Update payment method nickname
   */
  async updatePaymentMethodNickname(
    campgroundId: string,
    guestId: string,
    paymentMethodId: string,
    nickname: string,
  ): Promise<PaymentMethodInfo> {
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const pm = await this.prisma.guestPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        stripeCustomerId: customer.id,
      },
    });

    if (!pm) {
      throw new NotFoundException("Payment method not found");
    }

    const updated = await this.prisma.guestPaymentMethod.update({
      where: { id: paymentMethodId },
      data: { nickname },
    });

    return this.mapPaymentMethod(updated);
  }

  private mapPaymentMethod(pm: GuestPaymentMethod): PaymentMethodInfo {
    return {
      id: pm.id,
      stripePaymentMethodId: pm.stripePaymentMethodId,
      type: pm.type,
      last4: pm.last4,
      brand: pm.brand,
      expMonth: pm.expMonth,
      expYear: pm.expYear,
      bankName: pm.bankName,
      isDefault: pm.isDefault,
      nickname: pm.nickname,
      addedBy: pm.addedBy,
      createdAt: pm.createdAt,
    };
  }
}
