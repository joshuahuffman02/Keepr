import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
  RawBodyRequest,
  Logger,
} from "@nestjs/common";
import { Request } from "express";
import Stripe from "stripe";
import { SubscriptionService } from "./subscription.service";

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
  private stripe: Stripe;

  constructor(private subscriptionService: SubscriptionService) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: "2025-11-17.clover" as any,
      });
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
    @Headers("stripe-signature") signature: string
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
          "STRIPE_BILLING_WEBHOOK_SECRET not configured - rejecting webhook in production/staging"
        );
        throw new BadRequestException(
          "Webhook signature verification not configured"
        );
      }
      this.logger.warn(
        "STRIPE_BILLING_WEBHOOK_SECRET not set - accepting without verification (DEV ONLY)"
      );
    }

    let event: Stripe.Event;
    try {
      if (webhookSecret) {
        event = this.stripe.webhooks.constructEvent(
          req.rawBody!,
          signature,
          webhookSecret
        );
      } else {
        // Only allowed in development when secret is missing
        event = JSON.parse(req.rawBody!.toString()) as Stripe.Event;
      }
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    this.logger.log(`Processing billing webhook: ${event.type}`);

    try {
      switch (event.type) {
        // Subscription lifecycle events
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await this.subscriptionService.handleSubscriptionUpdated(
            subscription.id,
            subscription.status
          );
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await this.subscriptionService.handleSubscriptionUpdated(
            subscription.id,
            "canceled"
          );
          break;
        }

        // Invoice events
        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.subscription && typeof invoice.customer === "string") {
            await this.subscriptionService.handleInvoicePaid(
              invoice.id,
              invoice.customer
            );
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.subscription && typeof invoice.customer === "string") {
            await this.subscriptionService.handleInvoiceFailed(
              invoice.id,
              invoice.customer
            );
          }
          break;
        }

        case "invoice.finalized": {
          const invoice = event.data.object as Stripe.Invoice;
          this.logger.log(
            `Invoice finalized: ${invoice.id}, amount: ${invoice.amount_due}, customer: ${invoice.customer}`
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
