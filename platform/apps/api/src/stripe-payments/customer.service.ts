import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../payments/stripe.service";
import { randomUUID } from "crypto";

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Get or create a Stripe Customer for a guest on a specific campground's connected account.
   * Each campground has their own Stripe connected account, so customers are per-campground.
   */
  async getOrCreateCustomer(
    campgroundId: string,
    guestId: string,
  ): Promise<{ id: string; stripeCustomerId: string; isNew: boolean }> {
    // Check if customer already exists locally
    const existing = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
    });

    if (existing) {
      return {
        id: existing.id,
        stripeCustomerId: existing.stripeCustomerId,
        isNew: false,
      };
    }

    // Get campground and guest details
    const [campground, guest] = await Promise.all([
      this.prisma.campground.findUnique({
        where: { id: campgroundId },
        select: { stripeAccountId: true },
      }),
      this.prisma.guest.findUnique({
        where: { id: guestId },
        select: { email: true, primaryFirstName: true, primaryLastName: true },
      }),
    ]);

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    if (!guest) {
      throw new NotFoundException("Guest not found");
    }

    // Create customer on connected account
    const name = `${guest.primaryFirstName} ${guest.primaryLastName}`.trim();
    const stripeCustomer = await this.stripe.createCustomerOnConnectedAccount(
      campground.stripeAccountId,
      guest.email,
      name || undefined,
      { guestId, campgroundId },
    );

    // Store locally
    const customer = await this.prisma.stripeCustomer.create({
      data: {
        id: randomUUID(),
        campgroundId,
        guestId,
        stripeCustomerId: stripeCustomer.id,
        email: guest.email,
        updatedAt: new Date(),
      },
    });

    return {
      id: customer.id,
      stripeCustomerId: customer.stripeCustomerId,
      isNew: true,
    };
  }

  /**
   * Get a Stripe Customer for a guest on a campground
   */
  async getCustomer(campgroundId: string, guestId: string) {
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
      include: {
        GuestPaymentMethod: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    return customer;
  }

  /**
   * Get customer by Stripe customer ID
   */
  async getCustomerByStripeId(campgroundId: string, stripeCustomerId: string) {
    return this.prisma.stripeCustomer.findUnique({
      where: {
        campgroundId_stripeCustomerId: { campgroundId, stripeCustomerId },
      },
      include: {
        GuestPaymentMethod: true,
        Guest: {
          select: {
            id: true,
            email: true,
            primaryFirstName: true,
            primaryLastName: true,
          },
        },
      },
    });
  }

  /**
   * Set the default payment method for a customer
   */
  async setDefaultPaymentMethod(
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

    const paymentMethod = await this.prisma.guestPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        stripeCustomerId: customer.id,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException("Payment method not found");
    }

    // Get campground for Stripe account ID
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    // Update in Stripe
    await this.stripe.setCustomerDefaultPaymentMethod(
      campground.stripeAccountId,
      customer.stripeCustomerId,
      paymentMethod.stripePaymentMethodId,
    );

    // Update locally - reset all to non-default, then set the one
    await this.prisma.$transaction([
      this.prisma.guestPaymentMethod.updateMany({
        where: { stripeCustomerId: customer.id },
        data: { isDefault: false },
      }),
      this.prisma.guestPaymentMethod.update({
        where: { id: paymentMethodId },
        data: { isDefault: true },
      }),
      this.prisma.stripeCustomer.update({
        where: { id: customer.id },
        data: { defaultPaymentMethodId: paymentMethod.stripePaymentMethodId },
      }),
    ]);
  }
}
