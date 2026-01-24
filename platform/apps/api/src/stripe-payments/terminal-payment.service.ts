import { Injectable, BadRequestException, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../payments/stripe.service";
import { CustomerService } from "./customer.service";
import { PaymentMethodService } from "./payment-method.service";

export interface TerminalPaymentResult {
  paymentIntentId: string;
  status: string;
  amountCents: number;
  currency: string;
  readerStatus?: string;
}

@Injectable()
export class TerminalPaymentService {
  private readonly logger = new Logger(TerminalPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly customerService: CustomerService,
    private readonly paymentMethodService: PaymentMethodService,
  ) {}

  /**
   * Create a PaymentIntent for terminal collection
   */
  async createTerminalPayment(
    campgroundId: string,
    readerId: string,
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
    options?: {
      guestId?: string;
      saveCard?: boolean;
      idempotencyKey?: string;
    },
  ): Promise<TerminalPaymentResult> {
    // Get reader
    const reader = await this.prisma.stripeTerminalReader.findFirst({
      where: { id: readerId, campgroundId },
    });

    if (!reader) {
      throw new NotFoundException("Reader not found");
    }

    if (reader.status === "offline") {
      throw new BadRequestException("Reader is offline. Please check the device.");
    }

    // Get campground
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        stripeAccountId: true,
        applicationFeeFlatCents: true,
        currency: true,
      },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    // Get or create customer if guest provided and save card requested
    let customerId: string | undefined;
    if (options?.guestId && options?.saveCard) {
      const customer = await this.customerService.getOrCreateCustomer(
        campgroundId,
        options.guestId,
      );
      customerId = customer.stripeCustomerId;
    }

    // Calculate application fee
    const applicationFeeCents = campground.applicationFeeFlatCents || 0;

    // Create PaymentIntent for terminal
    const intent = await this.stripe.createTerminalPaymentIntent(
      campground.stripeAccountId,
      amountCents,
      currency.toLowerCase(),
      {
        ...metadata,
        campgroundId,
        readerId: reader.stripeReaderId,
        source: "terminal",
      },
      applicationFeeCents,
      {
        customerId,
        setupFutureUsage: options?.saveCard ? "off_session" : undefined,
        captureMethod: "automatic",
        idempotencyKey: options?.idempotencyKey,
      },
    );

    return {
      paymentIntentId: intent.id,
      status: intent.status,
      amountCents: intent.amount,
      currency: intent.currency,
    };
  }

  /**
   * Send payment to the terminal reader for card collection
   */
  async processPaymentOnReader(
    campgroundId: string,
    readerId: string,
    paymentIntentId: string,
  ): Promise<TerminalPaymentResult> {
    // Get reader
    const reader = await this.prisma.stripeTerminalReader.findFirst({
      where: { id: readerId, campgroundId },
    });

    if (!reader) {
      throw new NotFoundException("Reader not found");
    }

    // Get campground
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    // Update reader status to busy
    await this.prisma.stripeTerminalReader.update({
      where: { id: readerId },
      data: { status: "busy" },
    });

    try {
      // Send to reader
      const result = await this.stripe.processPaymentOnReader(
        campground.stripeAccountId,
        reader.stripeReaderId,
        paymentIntentId,
      );

      return {
        paymentIntentId,
        status: "processing",
        amountCents: 0,
        currency: "",
        readerStatus: result.status ?? undefined,
      };
    } catch (error) {
      // Reset reader status on error
      await this.prisma.stripeTerminalReader.update({
        where: { id: readerId },
        data: { status: "online" },
      });
      throw error;
    }
  }

  /**
   * Get the status of a terminal payment
   */
  async getPaymentStatus(
    campgroundId: string,
    paymentIntentId: string,
  ): Promise<{
    status: string;
    amountCents: number;
    currency: string;
    paymentMethodType?: string;
    cardBrand?: string;
    cardLast4?: string;
  }> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    const intent = await this.stripe.retrievePaymentIntentOnConnectedAccount(
      campground.stripeAccountId,
      paymentIntentId,
    );

    let cardBrand: string | undefined;
    let cardLast4: string | undefined;
    let paymentMethodType: string | undefined;

    if (intent.payment_method && typeof intent.payment_method === "object") {
      const pm = intent.payment_method;
      paymentMethodType = pm.type;
      if (pm.card_present) {
        cardBrand = pm.card_present.brand || undefined;
        cardLast4 = pm.card_present.last4 || undefined;
      } else if (pm.card) {
        cardBrand = pm.card.brand || undefined;
        cardLast4 = pm.card.last4 || undefined;
      }
    }

    return {
      status: intent.status,
      amountCents: intent.amount,
      currency: intent.currency,
      paymentMethodType,
      cardBrand,
      cardLast4,
    };
  }

  /**
   * Cancel a terminal payment (and reader action)
   */
  async cancelTerminalPayment(
    campgroundId: string,
    readerId: string,
    paymentIntentId: string,
  ): Promise<void> {
    const reader = await this.prisma.stripeTerminalReader.findFirst({
      where: { id: readerId, campgroundId },
    });

    if (!reader) {
      throw new NotFoundException("Reader not found");
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe");
    }

    // Cancel reader action
    try {
      await this.stripe.cancelTerminalReaderAction(
        campground.stripeAccountId,
        reader.stripeReaderId,
      );
    } catch (error) {
      this.logger.warn("Failed to cancel reader action:", error);
    }

    // Update reader status
    await this.prisma.stripeTerminalReader.update({
      where: { id: readerId },
      data: { status: "online" },
    });
  }

  /**
   * Handle successful terminal payment - auto-store card if requested
   * Called from webhook when payment_intent.succeeded
   */
  async handleTerminalPaymentSuccess(
    campgroundId: string,
    paymentIntentId: string,
    guestId?: string,
  ): Promise<void> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { stripeAccountId: true },
    });

    if (!campground?.stripeAccountId || !guestId) {
      return;
    }

    // Get payment intent to check if save card was requested
    const intent = await this.stripe.retrievePaymentIntentOnConnectedAccount(
      campground.stripeAccountId,
      paymentIntentId,
    );

    // If setup_future_usage was set and we have a payment method, save it
    if (intent.setup_future_usage === "off_session" && intent.payment_method) {
      const paymentMethodId =
        typeof intent.payment_method === "string"
          ? intent.payment_method
          : intent.payment_method.id;

      await this.paymentMethodService.autoStoreFromPaymentIntent(
        campgroundId,
        guestId,
        paymentMethodId,
      );
    }

    // Update reader status back to online
    if (intent.metadata?.readerId) {
      await this.prisma.stripeTerminalReader.updateMany({
        where: { campgroundId, stripeReaderId: intent.metadata.readerId },
        data: { status: "online", lastSeenAt: new Date() },
      });
    }
  }
}
