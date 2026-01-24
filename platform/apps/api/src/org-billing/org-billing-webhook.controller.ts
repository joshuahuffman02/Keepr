import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
  RawBodyRequest,
  Logger,
} from "@nestjs/common";
import type { Request } from "express";
import Stripe from "stripe";
import { SubscriptionService } from "./subscription.service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "Unknown error";

const isStripeEvent = (value: unknown): value is Stripe.Event => {
  if (!isRecord(value)) return false;
  if (typeof value.type !== "string") return false;
  if (!("data" in value) || !isRecord(value.data)) return false;
  return true;
};

const isStripeSubscription = (value: unknown): value is Stripe.Subscription =>
  isRecord(value) && typeof value.id === "string" && typeof value.status === "string";

type StripeInvoiceLike = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  customer?: string | Stripe.Customer | null;
};

const isStripeInvoice = (value: unknown): value is StripeInvoiceLike =>
  isRecord(value) && typeof value.id === "string";

/**
 * Webhook controller for organization billing events from Stripe.
 *
 * This handles subscription billing events for Keepr's platform fees,
 * separate from the campground-level payment webhooks in payments.controller.ts.
 *
 * Configure this endpoint in Stripe dashboard as a separate webhook endpoint
 * with events: customer.subscription.*, invoice.*
 */
@Controller("webhooks")
export class OrgBillingWebhookController {
  private readonly logger = new Logger(OrgBillingWebhookController.name);
  private stripe?: Stripe;

  constructor(private subscriptionService: SubscriptionService) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }
  }

  /**
   * Handle Stripe webhooks for organization subscriptions
   *
   * Configure in Stripe Dashboard:
   * - Endpoint URL: https://api.keeprstay.com/webhooks/billing
   * - Events to listen:
   *   - customer.subscription.created
   *   - customer.subscription.updated
   *   - customer.subscription.deleted
   *   - invoice.paid
   *   - invoice.payment_failed
   *   - invoice.finalized
   */
  @Post("billing")
  async handleBillingWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    if (!this.stripe) {
      this.logger.warn("Stripe not configured - skipping webhook");
      return { received: true, warning: "Stripe not configured" };
    }

    if (!signature) {
      throw new BadRequestException("Missing stripe-signature header");
    }

    const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
    const isProduction = process.env.NODE_ENV === "production";
    const isStaging = process.env.NODE_ENV === "staging";

    // Fail closed: require webhook secret in production/staging environments
    if (!webhookSecret) {
      if (isProduction || isStaging) {
        this.logger.error(
          "STRIPE_BILLING_WEBHOOK_SECRET not configured - rejecting webhook in production/staging",
        );
        throw new BadRequestException("Webhook signature verification not configured");
      }
      this.logger.warn(
        "STRIPE_BILLING_WEBHOOK_SECRET not set - accepting without verification (DEV ONLY)",
      );
    }

    let event: Stripe.Event;
    try {
      if (webhookSecret) {
        event = this.stripe.webhooks.constructEvent(req.rawBody!, signature, webhookSecret);
      } else {
        // Only allowed in development when secret is missing
        const parsed = JSON.parse(req.rawBody!.toString());
        if (!isStripeEvent(parsed)) {
          throw new BadRequestException("Invalid Stripe webhook payload");
        }
        event = parsed;
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      this.logger.error(`Webhook signature verification failed: ${message}`);
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    this.logger.log(`Processing billing webhook: ${event.type}`);

    try {
      switch (event.type) {
        // Subscription lifecycle events
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const dataObject = event.data.object;
          if (isStripeSubscription(dataObject)) {
            await this.subscriptionService.handleSubscriptionUpdated(
              dataObject.id,
              dataObject.status,
            );
          } else {
            this.logger.warn("Received subscription event with unexpected payload");
          }
          break;
        }

        case "customer.subscription.deleted": {
          const dataObject = event.data.object;
          if (isStripeSubscription(dataObject)) {
            await this.subscriptionService.handleSubscriptionUpdated(dataObject.id, "canceled");
          } else {
            this.logger.warn("Received subscription deletion event with unexpected payload");
          }
          break;
        }

        // Invoice events
        case "invoice.paid": {
          const dataObject = event.data.object;
          if (isStripeInvoice(dataObject)) {
            if (dataObject.subscription && typeof dataObject.customer === "string") {
              await this.subscriptionService.handleInvoicePaid(dataObject.id, dataObject.customer);
            }
          } else {
            this.logger.warn("Received invoice event with unexpected payload");
          }
          break;
        }

        case "invoice.payment_failed": {
          const dataObject = event.data.object;
          if (isStripeInvoice(dataObject)) {
            if (dataObject.subscription && typeof dataObject.customer === "string") {
              await this.subscriptionService.handleInvoiceFailed(
                dataObject.id,
                dataObject.customer,
              );
            }
          } else {
            this.logger.warn("Received invoice payment failure with unexpected payload");
          }
          break;
        }

        case "invoice.finalized": {
          const dataObject = event.data.object;
          if (!isStripeInvoice(dataObject)) {
            this.logger.warn("Received invoice finalized with unexpected payload");
            break;
          }
          this.logger.log(
            `Invoice finalized: ${dataObject.id}, amount: ${dataObject.amount_due}, customer: ${dataObject.customer}`,
          );
          // Could send notification email here
          break;
        }

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook ${event.type}:`, error);
      // Don't throw - return 200 to avoid Stripe retries for processing errors
      return { received: true, processed: false, error: String(error) };
    }

    return { received: true, processed: true };
  }
}
