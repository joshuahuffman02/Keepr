import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../payments/stripe.service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getStripeClientSecret = (error: unknown): string | undefined => {
  if (!isRecord(error)) return undefined;
  const raw = error.raw;
  if (!isRecord(raw)) return undefined;
  const paymentIntent = raw.payment_intent;
  if (!isRecord(paymentIntent)) return undefined;
  return getString(paymentIntent.client_secret);
};

export interface ChargeResult {
  paymentIntentId: string;
  status: string;
  amountCents: number;
  currency: string;
  requiresAction: boolean;
  clientSecret?: string; // For 3DS authentication
  paymentMethodId: string;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
}

@Injectable()
export class SavedCardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Charge a saved payment method (off-session)
   * Use this for:
   * - POS "Card on File" payments
   * - Auto-charges for reservations
   * - Kiosk self-check-in
   */
  async chargeSavedCard(
    campgroundId: string,
    guestId: string,
    paymentMethodId: string, // Our local ID or Stripe pm_xxx
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<ChargeResult> {
    // Get customer
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
      include: { GuestPaymentMethod: true },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found. Guest has no saved payment methods.");
    }

    // Find the payment method
    let paymentMethod = customer.GuestPaymentMethod.find((pm) => pm.id === paymentMethodId);

    // Also check by Stripe payment method ID
    if (!paymentMethod) {
      paymentMethod = customer.GuestPaymentMethod.find(
        (pm) => pm.stripePaymentMethodId === paymentMethodId,
      );
    }

    if (!paymentMethod) {
      throw new NotFoundException("Payment method not found for this guest");
    }

    // Get campground
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        stripeAccountId: true,
        applicationFeeFlatCents: true,
      },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    // Calculate application fee
    const applicationFeeCents = campground.applicationFeeFlatCents || 0;

    try {
      // Charge off-session
      const intent = await this.stripe.chargeOffSessionOnConnectedAccount(
        campground.stripeAccountId,
        customer.stripeCustomerId,
        paymentMethod.stripePaymentMethodId,
        amountCents,
        currency.toLowerCase(),
        {
          ...metadata,
          campgroundId,
          guestId,
          paymentMethodId: paymentMethod.id,
          source: "saved_card",
        },
        applicationFeeCents,
        idempotencyKey,
      );

      const requiresAction = intent.status === "requires_action";

      return {
        paymentIntentId: intent.id,
        status: intent.status,
        amountCents: intent.amount,
        currency: intent.currency,
        requiresAction,
        clientSecret: requiresAction ? intent.client_secret || undefined : undefined,
        paymentMethodId: paymentMethod.stripePaymentMethodId,
        paymentMethodLast4: paymentMethod.last4,
        paymentMethodBrand: paymentMethod.brand,
      };
    } catch (error: unknown) {
      const errorType = isRecord(error) ? getString(error.type) : undefined;
      const errorCode = isRecord(error) ? getString(error.code) : undefined;
      const errorMessage = isRecord(error) ? getString(error.message) : undefined;

      // Handle specific Stripe errors
      if (errorType === "StripeCardError") {
        throw new BadRequestException(`Card declined: ${errorMessage ?? "Unknown error"}`);
      }
      if (errorCode === "authentication_required") {
        // 3DS required - return client secret for frontend handling
        throw new BadRequestException({
          message: "3D Secure authentication required",
          requiresAction: true,
          clientSecret: getStripeClientSecret(error),
        });
      }
      throw error;
    }
  }

  /**
   * Charge the default payment method for a guest
   */
  async chargeDefaultCard(
    campgroundId: string,
    guestId: string,
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<ChargeResult> {
    // Get customer with default payment method
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
      include: {
        GuestPaymentMethod: {
          where: { isDefault: true },
          take: 1,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (customer.GuestPaymentMethod.length === 0) {
      throw new BadRequestException("No default payment method found for guest");
    }

    return this.chargeSavedCard(
      campgroundId,
      guestId,
      customer.GuestPaymentMethod[0].id,
      amountCents,
      currency,
      metadata,
      idempotencyKey,
    );
  }

  /**
   * Get all available payment methods for charging
   * Returns formatted list for POS/checkout display
   */
  async getChargeablePaymentMethods(
    campgroundId: string,
    guestId: string,
  ): Promise<
    Array<{
      id: string;
      stripePaymentMethodId: string;
      displayName: string;
      type: string;
      last4: string | null;
      brand: string | null;
      isDefault: boolean;
      isExpired: boolean;
    }>
  > {
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

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    return customer.GuestPaymentMethod.map((pm) => {
      // Check if card is expired
      let isExpired = false;
      if (pm.expYear && pm.expMonth) {
        if (
          pm.expYear < currentYear ||
          (pm.expYear === currentYear && pm.expMonth < currentMonth)
        ) {
          isExpired = true;
        }
      }

      // Build display name
      let displayName = pm.nickname || "";
      if (!displayName) {
        if (pm.brand) {
          displayName = `${pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)}`;
        } else if (pm.bankName) {
          displayName = pm.bankName;
        } else {
          displayName = pm.type === "card" ? "Card" : pm.type;
        }
      }
      if (pm.last4) {
        displayName += ` ****${pm.last4}`;
      }

      return {
        id: pm.id,
        stripePaymentMethodId: pm.stripePaymentMethodId,
        displayName,
        type: pm.type,
        last4: pm.last4,
        brand: pm.brand,
        isDefault: pm.isDefault,
        isExpired,
      };
    });
  }

  /**
   * Check if a payment method can be charged
   * (not expired, belongs to guest, etc.)
   */
  async canCharge(
    campgroundId: string,
    guestId: string,
    paymentMethodId: string,
  ): Promise<{ canCharge: boolean; reason?: string }> {
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { campgroundId_guestId: { campgroundId, guestId } },
      include: { GuestPaymentMethod: true },
    });

    if (!customer) {
      return { canCharge: false, reason: "No saved payment methods" };
    }

    const pm = customer.GuestPaymentMethod.find(
      (method) => method.id === paymentMethodId || method.stripePaymentMethodId === paymentMethodId,
    );

    if (!pm) {
      return { canCharge: false, reason: "Payment method not found" };
    }

    // Check expiration
    if (pm.expYear && pm.expMonth) {
      const now = new Date();
      const expDate = new Date(pm.expYear, pm.expMonth - 1);
      if (expDate < now) {
        return { canCharge: false, reason: "Card is expired" };
      }
    }

    return { canCharge: true };
  }
}
