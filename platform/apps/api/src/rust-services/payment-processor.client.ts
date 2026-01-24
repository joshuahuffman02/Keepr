import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Types for Payment Processor Rust service
 */
export interface CreatePaymentIntentRequest {
  amount_cents: number;
  currency: string;
  customer_id?: string;
  description?: string;
  metadata?: Record<string, string>;
  campground_stripe_account_id: string;
  fee_mode?: "absorb" | "pass_through";
}

export interface CreatePaymentIntentResponse {
  payment_intent_id: string;
  client_secret: string;
  amount_cents: number;
  platform_fee_cents: number;
  gateway_fee_cents: number;
  total_fees_cents: number;
}

export interface CapturePaymentRequest {
  payment_intent_id: string;
  amount_cents?: number; // Optional partial capture
  campground_stripe_account_id: string;
}

export interface RefundRequest {
  payment_intent_id: string;
  amount_cents?: number; // Optional partial refund
  reason?: string;
  campground_stripe_account_id: string;
}

export interface RefundResponse {
  refund_id: string;
  amount_cents: number;
  status: string;
}

export interface FeeCalculation {
  base_amount_cents: number;
  platform_fee_cents: number;
  gateway_fee_cents: number;
  total_fees_cents: number;
  net_amount_cents: number;
  fee_mode: "absorb" | "pass_through";
}

/**
 * Client for Payment Processor Rust service.
 *
 * Handles Stripe payments, fee calculations, and reconciliation.
 */
@Injectable()
export class PaymentProcessorClient implements OnModuleInit {
  private readonly logger = new Logger(PaymentProcessorClient.name);
  private baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get("PAYMENT_SERVICE_URL") || "http://localhost:8080";
  }

  async onModuleInit() {
    // Check if service is available
    try {
      const healthy = await this.healthCheck();
      if (healthy) {
        this.logger.log(`Payment Processor service available at ${this.baseUrl}`);
      }
    } catch {
      this.logger.warn(
        `Payment Processor service not available at ${this.baseUrl}. ` +
          `Some payment features will use fallback implementation.`,
      );
    }
  }

  /**
   * Check if the payment processor service is healthy.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Create a payment intent via Stripe.
   */
  async createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<CreatePaymentIntentResponse> {
    const response = await fetch(`${this.baseUrl}/api/payments/create-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create payment intent");
    }

    return response.json();
  }

  /**
   * Capture a payment intent.
   */
  async capturePayment(request: CapturePaymentRequest): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/payments/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to capture payment");
    }
  }

  /**
   * Create a refund.
   */
  async createRefund(request: RefundRequest): Promise<RefundResponse> {
    const response = await fetch(`${this.baseUrl}/api/payments/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create refund");
    }

    return response.json();
  }

  /**
   * Calculate fees for a payment amount.
   */
  async calculateFees(
    amountCents: number,
    feeMode: "absorb" | "pass_through" = "absorb",
  ): Promise<FeeCalculation> {
    const response = await fetch(`${this.baseUrl}/api/payments/calculate-fees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_cents: amountCents,
        fee_mode: feeMode,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to calculate fees");
    }

    return response.json();
  }

  /**
   * Validate a Stripe webhook signature.
   */
  async validateWebhook(payload: string, signature: string, secret: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/payments/webhook/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, signature, secret }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.valid;
  }
}
