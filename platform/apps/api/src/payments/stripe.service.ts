import { Injectable } from "@nestjs/common";
import Stripe from "stripe";

@Injectable()
export class StripeService {
    private stripe: Stripe;
    private readonly configured: boolean;
    private readonly apiVersion = "2025-11-17.clover" as any;

    constructor() {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        this.configured = !!secretKey && !secretKey.includes("placeholder");
        if (!this.configured) {
            console.warn("STRIPE_SECRET_KEY is not set. Stripe calls will be stubbed.");
        }
        this.stripe = new Stripe(secretKey || "sk_test_placeholder", {
            apiVersion: this.apiVersion,
        });
    }

    isConfigured() {
        return this.configured;
    }

    private assertConfigured(action: string) {
        if (!this.configured) {
            throw new Error(`Stripe is not configured; cannot ${action}. Set STRIPE_SECRET_KEY to enable payments.`);
        }
    }

    async createPaymentIntent(
        amountCents: number,
        currency: string,
        metadata: Record<string, string>,
        stripeAccountId: string,
        applicationFeeCents: number,
        captureMethod: 'automatic' | 'manual' = 'automatic',
        paymentMethodTypes?: string[],
        idempotencyKey?: string,
        threeDsPolicy: 'automatic' | 'any' = 'automatic'
    ) {
        this.assertConfigured("create payment intents");
        const requestOptions: Stripe.RequestOptions = {};
        if (idempotencyKey) {
            requestOptions.idempotencyKey = idempotencyKey;
        }
        return this.stripe.paymentIntents.create({
            amount: amountCents,
            currency,
            metadata,
            capture_method: captureMethod,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: "always",
            },
            payment_method_options: {
                card: {
                    request_three_d_secure: threeDsPolicy,
                },
            },
            payment_method_types: paymentMethodTypes,
            application_fee_amount: applicationFeeCents,
            transfer_data: {
                destination: stripeAccountId
            }
        }, requestOptions);
    }

    async listBalanceTransactionsForPayout(payoutId: string, stripeAccountId: string) {
        this.assertConfigured("list balance transactions");
        return this.stripe.balanceTransactions.list(
            { payout: payoutId, limit: 100 },
            { stripeAccount: stripeAccountId }
        );
    }

    async listPayouts(stripeAccountId: string, sinceSeconds: number = 7 * 24 * 3600) {
        this.assertConfigured("list payouts");
        const now = Math.floor(Date.now() / 1000);
        return this.stripe.payouts.list(
            {
                arrival_date: { gte: now - sinceSeconds },
                limit: 100
            },
            { stripeAccount: stripeAccountId }
        );
    }

    async createSetupIntent(stripeAccountId: string, metadata: Record<string, string>, paymentMethodTypes: string[]) {
        this.assertConfigured("create setup intents");
        return this.stripe.setupIntents.create(
            {
                usage: "off_session",
                payment_method_types: paymentMethodTypes,
                metadata
            },
            { stripeAccount: stripeAccountId }
        );
    }

    async retrieveAccountCapabilities(stripeAccountId: string) {
        if (!this.configured) {
            // Stubbed when keys are not configured; return undefined to signal skip.
            return undefined;
        }
        const mock = process.env.STRIPE_CAPABILITIES_MOCK;
        if (mock) {
            try {
                return JSON.parse(mock) as Record<string, string>;
            } catch {
                // fall through to live fetch
            }
        }
        const acct = await this.stripe.accounts.retrieve(stripeAccountId);
        return (acct as any).capabilities as Record<string, string> | undefined;
    }

    constructEventFromPayload(signature: string, payload: Buffer) {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new Error("STRIPE_WEBHOOK_SECRET is not set");
        }
        return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    }

    /**
     * Retrieve the current status and details of a payment intent
     */
    async retrievePaymentIntent(paymentIntentId: string) {
        this.assertConfigured("retrieve payment intents");
        return this.stripe.paymentIntents.retrieve(paymentIntentId);
    }

    /**
     * Capture an authorized payment intent (used for deposit/hold flows)
     * @param paymentIntentId - The ID of the payment intent to capture
     * @param amountCents - Optional amount to capture (for partial captures)
     * @param idempotencyKey - Optional idempotency key for safe retries
     */
    async capturePaymentIntent(paymentIntentId: string, amountCents?: number, idempotencyKey?: string) {
        this.assertConfigured("capture payment intents");
        const captureParams: Stripe.PaymentIntentCaptureParams = {};
        if (amountCents !== undefined) {
            captureParams.amount_to_capture = amountCents;
        }
        const requestOptions: Stripe.RequestOptions = {};
        if (idempotencyKey) {
            requestOptions.idempotencyKey = idempotencyKey;
        }
        return this.stripe.paymentIntents.capture(paymentIntentId, captureParams, requestOptions);
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
        reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer',
        idempotencyKey?: string
    ) {
        this.assertConfigured("create refunds");
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
        return this.stripe.refunds.create(refundParams, requestOptions);
    }

    /**
     * Create a payment intent with authorization hold (capture_method: manual)
     * Used for deposit flows where payment is authorized but not captured immediately
     */
    // Legacy helper kept for backward compatibility (not used in connect flow)
    async createPaymentIntentWithHold(
        amountCents: number,
        currency: string,
        metadata?: Record<string, string>
    ) {
        this.assertConfigured("create payment intents with hold");
        return this.stripe.paymentIntents.create({
            amount: amountCents,
            currency,
            metadata,
            capture_method: 'manual',
            automatic_payment_methods: {
                enabled: true,
            },
        });
    }

    async createExpressAccount(email?: string, metadata?: Record<string, string>) {
        this.assertConfigured("create accounts");
        return this.stripe.accounts.create({
            type: "express",
            email,
            metadata,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true }
            }
        });
    }

    async createAccountOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string) {
        this.assertConfigured("create account onboarding links");
        return this.stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: "account_onboarding"
        });
    }
}
