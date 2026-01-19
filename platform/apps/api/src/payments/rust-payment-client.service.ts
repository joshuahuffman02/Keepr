import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { getRequestHeaders } from "../common/request-context";

/**
 * Rust Payment Client Service
 *
 * HTTP client that delegates critical payment operations to the
 * Rust payment-processor-rs for improved safety and type correctness.
 *
 * Operations delegated to Rust:
 * - Payment intent creation (with fee calculation)
 * - Payment intent capture
 * - Refunds
 * - Fee calculations
 * - Reconciliation processing
 *
 * Operations kept in NestJS/Stripe SDK:
 * - Account setup and onboarding
 * - Customer management
 * - Terminal management
 * - Capability checks
 * - Setup intents
 */

// Zod schemas for response validation
const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
});

const PaymentIntentResponseSchema = z.object({
  id: z.string(),
  client_secret: z.string(),
  status: z.string(),
  amount_cents: z.number(),
  currency: z.string(),
});

const CaptureResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount_captured: z.number(),
  receipt_url: z.string().optional(),
});

const RefundResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount_cents: z.number(),
});

const FeeCalculationSchema = z.object({
  base_amount_cents: z.number(),
  platform_fee_cents: z.number(),
  gateway_fee_cents: z.number(),
  application_fee_cents: z.number(),
  charge_amount_cents: z.number(),
});

const ReconciliationSummarySchema = z.object({
  payout_id: z.string(),
  campground_id: z.string(),
  stripe_amount_cents: z.number(),
  computed_amount_cents: z.number(),
  drift_cents: z.number(),
  is_balanced: z.boolean(),
});

const ReconciliationResponseSchema = z.object({
  payout: ReconciliationSummarySchema,
});

type PaymentIntentResponse = z.infer<typeof PaymentIntentResponseSchema>;
type CaptureResponse = z.infer<typeof CaptureResponseSchema>;
type RefundResponse = z.infer<typeof RefundResponseSchema>;
type FeeCalculation = z.infer<typeof FeeCalculationSchema>;
type ReconciliationSummary = z.infer<typeof ReconciliationSummarySchema>;

interface CreatePaymentIntentDto {
  amount_cents: number;
  currency: string;
  campground_id: string;
  reservation_id?: string;
  connected_account_id: string;
  customer_id?: string;
  payment_method_id?: string;
  capture_method?: string;
  description?: string;
  idempotency_key?: string;
}

interface CapturePaymentIntentDto {
  connected_account_id?: string;
  amount_to_capture?: number;
}

interface CreateRefundDto {
  payment_intent_id: string;
  amount_cents?: number;
  connected_account_id?: string;
  reason?: string;
  idempotency_key?: string;
}

@Injectable()
export class RustPaymentClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RustPaymentClientService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private isHealthy = false;
  private fallbackToLocal = false;
  private healthCheckTimeout: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>("RUST_PAYMENT_SERVICE_URL", "http://localhost:8080");
    this.timeout = this.config.get<number>("RUST_PAYMENT_TIMEOUT_MS", 10000);
  }

  async onModuleInit(): Promise<void> {
    await this.checkHealth();
  }

  onModuleDestroy(): void {
    if (this.healthCheckTimeout) {
      clearTimeout(this.healthCheckTimeout);
      this.healthCheckTimeout = null;
    }
    this.healthCheckScheduled = false;
  }

  /**
   * Check if the Rust payment service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.baseUrl}/health`, {
        headers: getRequestHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json: unknown = await response.json();
        const data = HealthResponseSchema.parse(json);
        this.isHealthy = data.status === "ok";
        this.fallbackToLocal = false;
        this.logger.log(`Rust payment service connected: ${data.service} v${data.version}`);
        return true;
      }
    } catch {
      this.isHealthy = false;
      this.fallbackToLocal = true;
      this.logger.warn(`Rust payment service unavailable at ${this.baseUrl}, using local fallback`);
    }
    return false;
  }

  /**
   * Create a payment intent via Rust service
   */
  async createPaymentIntent(dto: CreatePaymentIntentDto): Promise<PaymentIntentResponse | null> {
    if (this.fallbackToLocal) {
      return null; // Caller should use local Stripe SDK
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/payments/create-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify(dto),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Create intent failed: ${response.status} - ${error}`);
      }

      const json: unknown = await response.json();
      return PaymentIntentResponseSchema.parse(json);
    } catch (error) {
      this.logger.warn("Rust create intent failed, using local fallback", error instanceof Error ? error.message : error);
      this.scheduleHealthCheck();
      return null;
    }
  }

  /**
   * Capture a payment intent via Rust service
   */
  async capturePaymentIntent(
    paymentIntentId: string,
    dto: CapturePaymentIntentDto
  ): Promise<CaptureResponse | null> {
    if (this.fallbackToLocal) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/payments/intents/${paymentIntentId}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify(dto),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Capture failed: ${response.status} - ${error}`);
      }

      const json: unknown = await response.json();
      return CaptureResponseSchema.parse(json);
    } catch (error) {
      this.logger.warn("Rust capture failed, using local fallback", error instanceof Error ? error.message : error);
      this.scheduleHealthCheck();
      return null;
    }
  }

  /**
   * Create a refund via Rust service
   */
  async createRefund(dto: CreateRefundDto): Promise<RefundResponse | null> {
    if (this.fallbackToLocal) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/payments/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify(dto),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Refund failed: ${response.status} - ${error}`);
      }

      const json: unknown = await response.json();
      return RefundResponseSchema.parse(json);
    } catch (error) {
      this.logger.warn("Rust refund failed, using local fallback", error instanceof Error ? error.message : error);
      this.scheduleHealthCheck();
      return null;
    }
  }

  /**
   * Calculate fees via Rust service
   */
  async calculateFees(amountCents: number): Promise<FeeCalculation | null> {
    if (this.fallbackToLocal) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/payments/calculate-fees`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify({ amount_cents: amountCents }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const json: unknown = await response.json();
      return FeeCalculationSchema.parse(json);
    } catch {
      return null;
    }
  }

  /**
   * Process a payout for reconciliation
   */
  async processPayoutReconciliation(
    payoutId: string,
    campgroundId: string,
    stripeAccountId: string
  ): Promise<ReconciliationSummary | null> {
    if (this.fallbackToLocal) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/reconciliation/process-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify({
          payout_id: payoutId,
          campground_id: campgroundId,
          stripe_account_id: stripeAccountId,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const json: unknown = await response.json();
      const data = ReconciliationResponseSchema.parse(json);
      return data.payout;
    } catch {
      return null;
    }
  }

  /**
   * Check if the Rust service is currently healthy
   */
  get healthy(): boolean {
    return this.isHealthy;
  }

  /**
   * Check if we're using local fallback
   */
  get usingFallback(): boolean {
    return this.fallbackToLocal;
  }

  // --- Health check scheduling ---

  private healthCheckScheduled = false;

  private scheduleHealthCheck(): void {
    if (this.healthCheckScheduled) return;
    this.healthCheckScheduled = true;

    // Retry health check after 30 seconds
    this.healthCheckTimeout = setTimeout(async () => {
      this.healthCheckScheduled = false;
      const healthy = await this.checkHealth();
      if (healthy) {
        this.fallbackToLocal = false;
        this.logger.log("Rust payment service recovered, resuming Rust operations");
      }
    }, 30000);
    this.healthCheckTimeout.unref();
  }
}
