import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  Optional,
} from "@nestjs/common";
import Stripe from "stripe";
import { isRecord } from "../utils/type-guards";
import { RustPaymentClientService } from "./rust-payment-client.service";

const normalizeCapabilities = (
  capabilities: Stripe.Account.Capabilities | null | undefined,
): Record<string, string> | undefined => {
  if (!capabilities) return undefined;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(capabilities)) {
    if (typeof value === "string") {
      normalized[key] = value;
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
};

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;
  private readonly configured: boolean;

  constructor(
    @Optional()
    @Inject(RustPaymentClientService)
    private readonly rustPayment?: RustPaymentClientService,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    // Check if key is valid (not empty, not a placeholder)
    const isValidKey =
      !!secretKey &&
      secretKey.length > 20 &&
      !secretKey.includes("placeholder") &&
      (secretKey.startsWith("sk_live_") ||
        secretKey.startsWith("sk_test_") ||
        secretKey.startsWith("rk_"));

    this.configured = isValidKey;

    if (!this.configured) {
      const isProduction = process.env.NODE_ENV === "production";
      const message =
        "STRIPE_SECRET_KEY is not configured or invalid. Payment processing is disabled.";

      if (isProduction) {
        this.logger.error(`${message} Set a valid Stripe secret key to enable payments.`);
      } else {
        this.logger.warn(message);
      }
    } else {
      // Only create Stripe instance if we have a valid key
      // SDK v20+ requires options object even if empty
      this.stripe = new Stripe(secretKey!, {});
      this.logger.log("Initialized with valid API key");
    }
  }

  isConfigured() {
    return this.configured;
  }

  /**
   * Check if Rust payment service is available for optimized operations
   */
  isRustAvailable(): boolean {
    return this.rustPayment?.healthy ?? false;
  }

  /**
   * Calculate fees using Rust service (falls back to local calculation)
   * This ensures consistent fee math across TypeScript and Rust
   */
  async calculateFees(amountCents: number): Promise<{
    baseAmountCents: number;
    platformFeeCents: number;
    gatewayFeeCents: number;
    applicationFeeCents: number;
    chargeAmountCents: number;
  }> {
    // Try Rust service first
    if (this.rustPayment) {
      const rustResult = await this.rustPayment.calculateFees(amountCents);
      if (rustResult) {
        return {
          baseAmountCents: rustResult.base_amount_cents,
          platformFeeCents: rustResult.platform_fee_cents,
          gatewayFeeCents: rustResult.gateway_fee_cents,
          applicationFeeCents: rustResult.application_fee_cents,
          chargeAmountCents: rustResult.charge_amount_cents,
        };
      }
    }

    // Local fallback: simple fee calculation
    // Platform fee: $3.00 per booking (configurable)
    const platformFeeCents = parseInt(process.env.PAYMENT_PLATFORM_FEE_CENTS || "300", 10);
    // Gateway fee: 2.9% + $0.30 (Stripe standard)
    const gatewayFeeCents = Math.round(amountCents * 0.029) + 30;
    // Application fee = platform fee only (gateway fees paid by Stripe)
    const applicationFeeCents = platformFeeCents;
    // Charge amount = base amount (fees are deducted from transfer)
    const chargeAmountCents = amountCents;

    return {
      baseAmountCents: amountCents,
      platformFeeCents,
      gatewayFeeCents,
      applicationFeeCents,
      chargeAmountCents,
    };
  }

  private assertConfigured(action: string): Stripe {
    if (!this.configured || !this.stripe) {
      throw new BadRequestException(
        `Stripe is not configured; cannot ${action}. Set STRIPE_SECRET_KEY to enable payments.`,
      );
    }
    return this.stripe;
  }

  async createPaymentIntent(
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
    stripeAccountId: string,
    applicationFeeCents: number,
    captureMethod: "automatic" | "manual" = "automatic",
    paymentMethodTypes?: string[],
    idempotencyKey?: string,
    threeDsPolicy: "automatic" | "any" = "automatic",
  ) {
    const stripe = this.assertConfigured("create payment intents");

    // Build payment intent params - don't mix automatic_payment_methods with payment_method_types
    const params: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency,
      metadata,
      capture_method: captureMethod,
      payment_method_options: {
        card: {
          request_three_d_secure: threeDsPolicy,
        },
      },
      transfer_data: {
        destination: stripeAccountId,
      },
    };

    // Only add application_fee_amount if > 0
    if (applicationFeeCents > 0) {
      params.application_fee_amount = applicationFeeCents;
    }

    // Use specific payment methods if provided, otherwise enable automatic
    if (paymentMethodTypes && paymentMethodTypes.length > 0) {
      params.payment_method_types = paymentMethodTypes;
    } else {
      params.automatic_payment_methods = {
        enabled: true,
        allow_redirects: "always",
      };
    }

    // Only pass options if we have an idempotency key
    if (idempotencyKey) {
      return stripe.paymentIntents.create(params, { idempotencyKey });
    }
    return stripe.paymentIntents.create(params);
  }

  async listBalanceTransactionsForPayout(payoutId: string, stripeAccountId: string) {
    const stripe = this.assertConfigured("list balance transactions");
    return stripe.balanceTransactions.list(
      { payout: payoutId, limit: 100 },
      { stripeAccount: stripeAccountId },
    );
  }

  async listPayouts(stripeAccountId: string, sinceSeconds: number = 7 * 24 * 3600) {
    const stripe = this.assertConfigured("list payouts");
    const now = Math.floor(Date.now() / 1000);
    return stripe.payouts.list(
      {
        arrival_date: { gte: now - sinceSeconds },
        limit: 100,
      },
      { stripeAccount: stripeAccountId },
    );
  }

  async createSetupIntent(
    stripeAccountId: string,
    metadata: Record<string, string>,
    paymentMethodTypes: string[],
  ) {
    const stripe = this.assertConfigured("create setup intents");
    return stripe.setupIntents.create(
      {
        usage: "off_session",
        payment_method_types: paymentMethodTypes,
        metadata,
      },
      { stripeAccount: stripeAccountId },
    );
  }

  async retrieveAccountCapabilities(stripeAccountId: string) {
    if (!this.configured || !this.stripe) {
      // Stubbed when keys are not configured; return undefined to signal skip.
      return undefined;
    }
    const mock = process.env.STRIPE_CAPABILITIES_MOCK;
    if (mock) {
      try {
        const parsed = JSON.parse(mock);
        if (isRecord(parsed)) {
          const normalized: Record<string, string> = {};
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "string") {
              normalized[key] = value;
            }
          }
          if (Object.keys(normalized).length) {
            return normalized;
          }
        }
      } catch {
        // fall through to live fetch
      }
    }
    const acct = await this.stripe.accounts.retrieve(stripeAccountId);
    return normalizeCapabilities(acct.capabilities);
  }

  /**
   * Retrieve a connected Stripe account's details
   */
  async retrieveAccount(stripeAccountId: string) {
    const stripe = this.assertConfigured("retrieve account");
    return stripe.accounts.retrieve(stripeAccountId);
  }

  constructEventFromPayload(signature: string, payload: Buffer) {
    const stripe = this.assertConfigured("construct webhook events");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException("STRIPE_WEBHOOK_SECRET is not set");
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Retrieve the current status and details of a payment intent
   */
  async retrievePaymentIntent(paymentIntentId: string) {
    const stripe = this.assertConfigured("retrieve payment intents");
    return stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Capture an authorized payment intent (used for deposit/hold flows)
   * @param paymentIntentId - The ID of the payment intent to capture
   * @param amountCents - Optional amount to capture (for partial captures)
   * @param idempotencyKey - Optional idempotency key for safe retries
   */
  async capturePaymentIntent(
    paymentIntentId: string,
    amountCents?: number,
    idempotencyKey?: string,
  ) {
    const stripe = this.assertConfigured("capture payment intents");
    const captureParams: Stripe.PaymentIntentCaptureParams = {};
    if (amountCents !== undefined) {
      captureParams.amount_to_capture = amountCents;
    }
    const requestOptions: Stripe.RequestOptions = {};
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }
    return stripe.paymentIntents.capture(paymentIntentId, captureParams, requestOptions);
  }

  /**
   * Create a refund for a payment intent
   * @param paymentIntentId - The payment intent to refund
   * @param amountCents - Optional amount to refund (for partial refunds)
   * @param reason - Optional reason for the refund
   * @param idempotencyKey - Optional idempotency key for safe retries
   */
  async createRefund(
    paymentIntentId: string,
    amountCents?: number,
    reason?: "duplicate" | "fraudulent" | "requested_by_customer",
    idempotencyKey?: string,
  ) {
    const stripe = this.assertConfigured("create refunds");
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };
    if (amountCents !== undefined) {
      refundParams.amount = amountCents;
    }
    if (reason) {
      refundParams.reason = reason;
    }
    const requestOptions: Stripe.RequestOptions = {};
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }
    return stripe.refunds.create(refundParams, requestOptions);
  }

  /**
   * Charge a saved payment method (off-session payment)
   * Used for kiosk check-in, repeat charges, and other automated payments
   *
   * @param amountCents - Amount to charge in cents
   * @param currency - Currency code (e.g., 'usd')
   * @param customerId - Stripe customer ID (from connected account)
   * @param paymentMethodId - Saved payment method ID
   * @param stripeAccountId - Connected Stripe account ID
   * @param metadata - Metadata for the payment intent
   * @param applicationFeeCents - Application fee in cents
   * @param idempotencyKey - Optional idempotency key for safe retries
   */
  async chargeOffSession(
    amountCents: number,
    currency: string,
    customerId: string,
    paymentMethodId: string,
    stripeAccountId: string,
    metadata: Record<string, string>,
    applicationFeeCents: number = 0,
    idempotencyKey?: string,
  ) {
    const stripe = this.assertConfigured("charge off-session");

    const params: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata,
      application_fee_amount: applicationFeeCents,
      transfer_data: {
        destination: stripeAccountId,
      },
    };

    const requestOptions: Stripe.RequestOptions = {
      stripeAccount: stripeAccountId,
    };

    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }

    return stripe.paymentIntents.create(params, requestOptions);
  }

  /**
   * Create a payment intent with authorization hold (capture_method: manual)
   * Used for deposit flows where payment is authorized but not captured immediately
   */
  // Legacy helper kept for backward compatibility (not used in connect flow)
  async createPaymentIntentWithHold(
    amountCents: number,
    currency: string,
    metadata?: Record<string, string>,
  ) {
    const stripe = this.assertConfigured("create payment intents with hold");
    return stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      metadata,
      capture_method: "manual",
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  async createExpressAccount(email?: string, metadata?: Record<string, string>) {
    const stripe = this.assertConfigured("create accounts");
    return stripe.accounts.create({
      type: "express",
      email,
      metadata,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
  }

  async createAccountOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string) {
    const stripe = this.assertConfigured("create account onboarding links");
    return stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
  }

  // =========================================================================
  // SUBSCRIPTION BILLING (for charging campgrounds their monthly fees)
  // =========================================================================

  /**
   * Create or retrieve a Stripe customer for an organization
   */
  async createOrGetCustomer(
    organizationId: string,
    email: string,
    name: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Customer> {
    const stripe = this.assertConfigured("create customers");

    // First check if customer already exists with this org ID
    const existing = await stripe.customers.list({
      limit: 1,
      email,
    });

    if (existing.data.length > 0 && existing.data[0].metadata?.organizationId === organizationId) {
      return existing.data[0];
    }

    // Create new customer
    return stripe.customers.create({
      email,
      name,
      metadata: {
        organizationId,
        ...metadata,
      },
    });
  }

  /**
   * Retrieve a customer by ID
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    const stripe = this.assertConfigured("get customers");
    const customer = await stripe.customers.retrieve(customerId);
    return this.ensureActiveCustomer(customer);
  }

  /**
   * Update customer details
   */
  async updateCustomer(
    customerId: string,
    updates: {
      email?: string;
      name?: string;
      metadata?: Record<string, string>;
    },
  ): Promise<Stripe.Customer> {
    const stripe = this.assertConfigured("update customers");
    return stripe.customers.update(customerId, updates);
  }

  /**
   * Create a subscription for organization billing
   * Supports both fixed monthly pricing and metered/usage-based pricing
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>,
    trialPeriodDays?: number,
    couponId?: string,
  ): Promise<Stripe.Subscription> {
    const stripe = this.assertConfigured("create subscriptions");

    const params: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      metadata,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    };

    if (trialPeriodDays) {
      params.trial_period_days = trialPeriodDays;
    }

    if (couponId) {
      params.discounts = [{ coupon: couponId }];
    }

    return stripe.subscriptions.create(params);
  }

  /**
   * Create a subscription with multiple price items (e.g., base + metered usage)
   */
  async createSubscriptionWithItems(
    customerId: string,
    items: Array<{ priceId: string; quantity?: number }>,
    metadata?: Record<string, string>,
    trialPeriodDays?: number,
    couponId?: string,
  ): Promise<Stripe.Subscription> {
    const stripe = this.assertConfigured("create subscriptions");

    const params: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: items.map((item) => ({
        price: item.priceId,
        quantity: item.quantity,
      })),
      metadata,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    };

    if (trialPeriodDays) {
      params.trial_period_days = trialPeriodDays;
    }

    if (couponId) {
      params.discounts = [{ coupon: couponId }];
    }

    return stripe.subscriptions.create(params);
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = this.assertConfigured("get subscriptions");
    return stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice", "default_payment_method"],
    });
  }

  /**
   * List subscriptions for a customer
   */
  async listCustomerSubscriptions(
    customerId: string,
  ): Promise<Stripe.ApiList<Stripe.Subscription>> {
    const stripe = this.assertConfigured("list subscriptions");
    return stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      expand: ["data.latest_invoice"],
    });
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd = true,
  ): Promise<Stripe.Subscription> {
    const stripe = this.assertConfigured("cancel subscriptions");

    if (cancelAtPeriodEnd) {
      return stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }

    return stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Report metered usage for a subscription item
   * Used for per-booking fees, SMS charges, etc.
   */
  async reportUsage(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: number,
    action: "increment" | "set" = "increment",
  ): Promise<Stripe.UsageRecord> {
    const stripe = this.assertConfigured("report usage");
    return stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      action,
    });
  }

  /**
   * Get usage records for a subscription item
   */
  async getUsageRecords(
    subscriptionItemId: string,
    limit = 100,
  ): Promise<Stripe.ApiList<Stripe.UsageRecordSummary>> {
    const stripe = this.assertConfigured("get usage records");
    return stripe.subscriptionItems.listUsageRecordSummaries(subscriptionItemId, {
      limit,
    });
  }

  /**
   * Create a billing portal session for customer self-service
   */
  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    const stripe = this.assertConfigured("create billing portal");
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  /**
   * Create a checkout session for subscription signup
   */
  async createSubscriptionCheckout(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>,
    trialPeriodDays?: number,
  ): Promise<Stripe.Checkout.Session> {
    const stripe = this.assertConfigured("create checkout session");

    const params: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: {
        metadata,
      },
    };

    if (trialPeriodDays) {
      params.subscription_data!.trial_period_days = trialPeriodDays;
    }

    return stripe.checkout.sessions.create(params);
  }

  /**
   * Create an invoice for one-time charges (manual billing)
   */
  async createInvoice(
    customerId: string,
    autoAdvance = true,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Invoice> {
    const stripe = this.assertConfigured("create invoices");
    return stripe.invoices.create({
      customer: customerId,
      auto_advance: autoAdvance,
      metadata,
    });
  }

  /**
   * Add line item to an invoice
   */
  async addInvoiceItem(
    customerId: string,
    amountCents: number,
    description: string,
    invoiceId?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.InvoiceItem> {
    const stripe = this.assertConfigured("add invoice items");
    return stripe.invoiceItems.create({
      customer: customerId,
      amount: amountCents,
      currency: "usd",
      description,
      invoice: invoiceId,
      metadata,
    });
  }

  /**
   * Finalize and send an invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const stripe = this.assertConfigured("finalize invoices");
    return stripe.invoices.finalizeInvoice(invoiceId);
  }

  /**
   * Pay an invoice immediately (if customer has payment method on file)
   */
  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const stripe = this.assertConfigured("pay invoices");
    return stripe.invoices.pay(invoiceId);
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const stripe = this.assertConfigured("get invoices");
    return stripe.invoices.retrieve(invoiceId);
  }

  /**
   * List invoices for a customer
   */
  async listInvoices(customerId: string, limit = 10): Promise<Stripe.ApiList<Stripe.Invoice>> {
    const stripe = this.assertConfigured("list invoices");
    return stripe.invoices.list({
      customer: customerId,
      limit,
    });
  }

  // =========================================================================
  // PRODUCTS & PRICES (for setting up billing plans)
  // =========================================================================

  /**
   * Create a product (e.g., "Keepr Subscription")
   */
  async createProduct(
    name: string,
    description?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Product> {
    const stripe = this.assertConfigured("create products");
    return stripe.products.create({
      name,
      description,
      metadata,
    });
  }

  /**
   * Create a recurring price for a product
   */
  async createRecurringPrice(
    productId: string,
    unitAmountCents: number,
    interval: "month" | "year" = "month",
    currency = "usd",
    metadata?: Record<string, string>,
  ): Promise<Stripe.Price> {
    const stripe = this.assertConfigured("create prices");
    return stripe.prices.create({
      product: productId,
      unit_amount: unitAmountCents,
      currency,
      recurring: { interval },
      metadata,
    });
  }

  /**
   * Create a metered (usage-based) price
   */
  async createMeteredPrice(
    productId: string,
    unitAmountCents: number,
    interval: "month" | "year" = "month",
    currency = "usd",
    usageType: "metered" | "licensed" = "metered",
    aggregateUsage: "sum" | "last_during_period" | "last_ever" | "max" = "sum",
    metadata?: Record<string, string>,
  ): Promise<Stripe.Price> {
    const stripe = this.assertConfigured("create prices");
    return stripe.prices.create({
      product: productId,
      unit_amount: unitAmountCents,
      currency,
      recurring: {
        interval,
        usage_type: usageType,
        aggregate_usage: usageType === "metered" ? aggregateUsage : undefined,
      },
      metadata,
    });
  }

  /**
   * List all prices for a product
   */
  async listPrices(productId: string): Promise<Stripe.ApiList<Stripe.Price>> {
    const stripe = this.assertConfigured("list prices");
    return stripe.prices.list({
      product: productId,
      active: true,
    });
  }

  /**
   * Create a coupon for discounts
   */
  async createCoupon(
    percentOff?: number,
    amountOffCents?: number,
    duration: "forever" | "once" | "repeating" = "once",
    durationInMonths?: number,
    name?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Coupon> {
    const stripe = this.assertConfigured("create coupons");

    const params: Stripe.CouponCreateParams = {
      duration,
      name,
      metadata,
    };

    if (percentOff) {
      params.percent_off = percentOff;
    } else if (amountOffCents) {
      params.amount_off = amountOffCents;
      params.currency = "usd";
    }

    if (duration === "repeating" && durationInMonths) {
      params.duration_in_months = durationInMonths;
    }

    return stripe.coupons.create(params);
  }

  // =========================================================================
  // STRIPE CUSTOMER MANAGEMENT (on Connected Accounts - for guest card storage)
  // =========================================================================

  /**
   * Create a Stripe Customer on a connected account for storing payment methods
   */
  async createCustomerOnConnectedAccount(
    stripeAccountId: string,
    email: string,
    name?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Customer> {
    const stripe = this.assertConfigured("create customers on connected accounts");
    return stripe.customers.create(
      {
        email,
        name,
        metadata,
      },
      { stripeAccount: stripeAccountId },
    );
  }

  /**
   * Retrieve a customer from a connected account
   */
  async getCustomerOnConnectedAccount(
    stripeAccountId: string,
    customerId: string,
  ): Promise<Stripe.Customer> {
    const stripe = this.assertConfigured("get customers on connected accounts");
    const customer = await stripe.customers.retrieve(customerId, {
      stripeAccount: stripeAccountId,
    });
    return this.ensureActiveCustomer(customer);
  }

  private ensureActiveCustomer(
    customer: Stripe.Customer | Stripe.DeletedCustomer,
  ): Stripe.Customer {
    if ("deleted" in customer && customer.deleted) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }

  /**
   * Update customer's default payment method on a connected account
   */
  async setCustomerDefaultPaymentMethod(
    stripeAccountId: string,
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Customer> {
    const stripe = this.assertConfigured("update customers on connected accounts");
    return stripe.customers.update(
      customerId,
      { invoice_settings: { default_payment_method: paymentMethodId } },
      { stripeAccount: stripeAccountId },
    );
  }

  // =========================================================================
  // PAYMENT METHOD MANAGEMENT (on Connected Accounts)
  // =========================================================================

  /**
   * Attach a payment method to a customer on a connected account
   */
  async attachPaymentMethodOnConnectedAccount(
    stripeAccountId: string,
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    const stripe = this.assertConfigured("attach payment methods");
    return stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: customerId },
      { stripeAccount: stripeAccountId },
    );
  }

  /**
   * Detach a payment method from a customer on a connected account
   */
  async detachPaymentMethodOnConnectedAccount(
    stripeAccountId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    const stripe = this.assertConfigured("detach payment methods");
    return stripe.paymentMethods.detach(paymentMethodId, {}, { stripeAccount: stripeAccountId });
  }

  /**
   * Retrieve payment method details on a connected account
   */
  async getPaymentMethodOnConnectedAccount(
    stripeAccountId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    const stripe = this.assertConfigured("get payment methods");
    return stripe.paymentMethods.retrieve(paymentMethodId, {}, { stripeAccount: stripeAccountId });
  }

  /**
   * List all payment methods for a customer on a connected account
   */
  async listPaymentMethodsOnConnectedAccount(
    stripeAccountId: string,
    customerId: string,
    type: "card" | "us_bank_account" = "card",
  ): Promise<Stripe.PaymentMethod[]> {
    const stripe = this.assertConfigured("list payment methods");
    const result = await stripe.paymentMethods.list(
      {
        customer: customerId,
        type,
      },
      { stripeAccount: stripeAccountId },
    );
    return result.data;
  }

  /**
   * Create a SetupIntent on a connected account for saving a payment method
   */
  async createSetupIntentOnConnectedAccount(
    stripeAccountId: string,
    customerId: string,
    metadata?: Record<string, string>,
    paymentMethodTypes: string[] = ["card"],
  ): Promise<Stripe.SetupIntent> {
    const stripe = this.assertConfigured("create setup intents on connected accounts");
    return stripe.setupIntents.create(
      {
        customer: customerId,
        usage: "off_session",
        payment_method_types: paymentMethodTypes,
        metadata,
      },
      { stripeAccount: stripeAccountId },
    );
  }

  /**
   * Retrieve a SetupIntent on a connected account
   */
  async retrieveSetupIntentOnConnectedAccount(
    stripeAccountId: string,
    setupIntentId: string,
  ): Promise<Stripe.SetupIntent> {
    const stripe = this.assertConfigured("retrieve setup intents");
    return stripe.setupIntents.retrieve(setupIntentId, {}, { stripeAccount: stripeAccountId });
  }

  // =========================================================================
  // STRIPE TERMINAL (for in-person card payments - per campground)
  // =========================================================================

  /**
   * Create a Terminal Location on a connected account
   */
  async createTerminalLocation(
    stripeAccountId: string,
    displayName: string,
    address: {
      line1: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
      line2?: string;
    },
  ): Promise<Stripe.Terminal.Location> {
    const stripe = this.assertConfigured("create terminal locations");
    return stripe.terminal.locations.create(
      {
        display_name: displayName,
        address: {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country,
        },
      },
      { stripeAccount: stripeAccountId },
    );
  }

  /**
   * List Terminal Locations on a connected account
   */
  async listTerminalLocations(stripeAccountId: string): Promise<Stripe.Terminal.Location[]> {
    const stripe = this.assertConfigured("list terminal locations");
    const result = await stripe.terminal.locations.list(
      { limit: 100 },
      { stripeAccount: stripeAccountId },
    );
    return result.data;
  }

  /**
   * Delete a Terminal Location on a connected account
   */
  async deleteTerminalLocation(
    stripeAccountId: string,
    locationId: string,
  ): Promise<Stripe.Terminal.DeletedLocation> {
    const stripe = this.assertConfigured("delete terminal locations");
    return stripe.terminal.locations.del(locationId, {}, { stripeAccount: stripeAccountId });
  }

  /**
   * Register a new Terminal Reader on a connected account
   */
  async registerTerminalReader(
    stripeAccountId: string,
    registrationCode: string,
    label: string,
    locationId?: string,
  ): Promise<Stripe.Terminal.Reader> {
    const stripe = this.assertConfigured("register terminal readers");
    return stripe.terminal.readers.create(
      {
        registration_code: registrationCode,
        label,
        location: locationId,
      },
      { stripeAccount: stripeAccountId },
    );
  }

  /**
   * List Terminal Readers on a connected account
   */
  async listTerminalReaders(
    stripeAccountId: string,
    locationId?: string,
  ): Promise<Stripe.Terminal.Reader[]> {
    const stripe = this.assertConfigured("list terminal readers");
    const params: Stripe.Terminal.ReaderListParams = { limit: 100 };
    if (locationId) {
      params.location = locationId;
    }
    const result = await stripe.terminal.readers.list(params, { stripeAccount: stripeAccountId });
    return result.data;
  }

  /**
   * Get Terminal Reader details on a connected account
   */
  async getTerminalReader(
    stripeAccountId: string,
    readerId: string,
  ): Promise<Stripe.Terminal.Reader> {
    const stripe = this.assertConfigured("get terminal readers");
    const reader = await stripe.terminal.readers.retrieve(
      readerId,
      {},
      { stripeAccount: stripeAccountId },
    );
    if ("deleted" in reader && reader.deleted) {
      throw new NotFoundException("Reader not found");
    }
    return reader;
  }

  /**
   * Delete a Terminal Reader on a connected account
   */
  async deleteTerminalReader(
    stripeAccountId: string,
    readerId: string,
  ): Promise<Stripe.Terminal.DeletedReader> {
    const stripe = this.assertConfigured("delete terminal readers");
    return stripe.terminal.readers.del(readerId, {}, { stripeAccount: stripeAccountId });
  }

  /**
   * Update Terminal Reader label on a connected account
   */
  async updateTerminalReader(
    stripeAccountId: string,
    readerId: string,
    label: string,
  ): Promise<Stripe.Terminal.Reader> {
    const stripe = this.assertConfigured("update terminal readers");
    const reader = await stripe.terminal.readers.update(
      readerId,
      { label },
      { stripeAccount: stripeAccountId },
    );
    if ("deleted" in reader && reader.deleted) {
      throw new NotFoundException("Reader not found");
    }
    return reader;
  }

  /**
   * Create a PaymentIntent for Terminal (card_present)
   */
  async createTerminalPaymentIntent(
    stripeAccountId: string,
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
    applicationFeeCents: number = 0,
    options?: {
      customerId?: string;
      setupFutureUsage?: "off_session";
      captureMethod?: "automatic" | "manual";
      idempotencyKey?: string;
    },
  ): Promise<Stripe.PaymentIntent> {
    const stripe = this.assertConfigured("create terminal payment intents");

    const params: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency,
      payment_method_types: ["card_present"],
      capture_method: options?.captureMethod ?? "automatic",
      metadata,
      application_fee_amount: applicationFeeCents > 0 ? applicationFeeCents : undefined,
    };

    if (options?.customerId) {
      params.customer = options.customerId;
    }

    if (options?.setupFutureUsage) {
      params.setup_future_usage = options.setupFutureUsage;
    }

    const requestOptions: Stripe.RequestOptions = {
      stripeAccount: stripeAccountId,
    };

    if (options?.idempotencyKey) {
      requestOptions.idempotencyKey = options.idempotencyKey;
    }

    return stripe.paymentIntents.create(params, requestOptions);
  }

  /**
   * Process a payment on a Terminal Reader
   * Sends the PaymentIntent to the physical device for card collection
   */
  async processPaymentOnReader(
    stripeAccountId: string,
    readerId: string,
    paymentIntentId: string,
  ): Promise<Stripe.Terminal.Reader> {
    const stripe = this.assertConfigured("process terminal payments");
    return stripe.terminal.readers.processPaymentIntent(
      readerId,
      { payment_intent: paymentIntentId },
      { stripeAccount: stripeAccountId },
    );
  }

  /**
   * Cancel an action on a Terminal Reader
   */
  async cancelTerminalReaderAction(
    stripeAccountId: string,
    readerId: string,
  ): Promise<Stripe.Terminal.Reader> {
    const stripe = this.assertConfigured("cancel terminal reader actions");
    return stripe.terminal.readers.cancelAction(readerId, {}, { stripeAccount: stripeAccountId });
  }

  /**
   * Create a connection token for Terminal SDK (used by frontend)
   */
  async createConnectionToken(
    stripeAccountId: string,
    locationId?: string,
  ): Promise<Stripe.Terminal.ConnectionToken> {
    const stripe = this.assertConfigured("create connection tokens");
    const params: Stripe.Terminal.ConnectionTokenCreateParams = {};
    if (locationId) {
      params.location = locationId;
    }
    return stripe.terminal.connectionTokens.create(params, { stripeAccount: stripeAccountId });
  }

  /**
   * Retrieve PaymentIntent on a connected account
   */
  async retrievePaymentIntentOnConnectedAccount(
    stripeAccountId: string,
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    const stripe = this.assertConfigured("retrieve payment intents");
    return stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["payment_method", "charges.data.payment_method_details"] },
      { stripeAccount: stripeAccountId },
    );
  }

  /**
   * Capture a PaymentIntent on a connected account
   */
  async capturePaymentIntentOnConnectedAccount(
    stripeAccountId: string,
    paymentIntentId: string,
    amountCents?: number,
    idempotencyKey?: string,
  ): Promise<Stripe.PaymentIntent> {
    const stripe = this.assertConfigured("capture payment intents");
    const params: Stripe.PaymentIntentCaptureParams = {};
    if (amountCents !== undefined) {
      params.amount_to_capture = amountCents;
    }
    const requestOptions: Stripe.RequestOptions = {
      stripeAccount: stripeAccountId,
    };
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }
    return stripe.paymentIntents.capture(paymentIntentId, params, requestOptions);
  }

  /**
   * Create a refund on a connected account (always to original payment method)
   */
  async createRefundOnConnectedAccount(
    stripeAccountId: string,
    paymentIntentId: string,
    amountCents?: number,
    reason?: "duplicate" | "fraudulent" | "requested_by_customer",
    idempotencyKey?: string,
  ): Promise<Stripe.Refund> {
    const stripe = this.assertConfigured("create refunds on connected accounts");
    const params: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };
    if (amountCents !== undefined) {
      params.amount = amountCents;
    }
    if (reason) {
      params.reason = reason;
    }
    // Note: Stripe automatically refunds to the original payment method
    // There is no option to specify a different destination
    const requestOptions: Stripe.RequestOptions = {
      stripeAccount: stripeAccountId,
    };
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }
    return stripe.refunds.create(params, requestOptions);
  }

  /**
   * Charge a saved payment method off-session on a connected account
   */
  async chargeOffSessionOnConnectedAccount(
    stripeAccountId: string,
    customerId: string,
    paymentMethodId: string,
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
    applicationFeeCents: number = 0,
    idempotencyKey?: string,
  ): Promise<Stripe.PaymentIntent> {
    const stripe = this.assertConfigured("charge off-session on connected accounts");

    const params: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata,
      application_fee_amount: applicationFeeCents > 0 ? applicationFeeCents : undefined,
    };

    const requestOptions: Stripe.RequestOptions = {
      stripeAccount: stripeAccountId,
    };

    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }

    return stripe.paymentIntents.create(params, requestOptions);
  }
}
