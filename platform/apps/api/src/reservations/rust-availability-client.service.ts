import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { getRequestHeaders } from "../common/request-context";

/**
 * Rust Availability Client Service
 *
 * HTTP client that delegates availability and pricing operations to the
 * Rust availability-rs service for improved correctness and performance.
 *
 * Operations delegated to Rust:
 * - Pricing evaluation (rule-based calculations)
 * - Availability checking (date range conflicts)
 * - Deposit calculation
 * - Revenue forecasting
 *
 * Operations kept in NestJS:
 * - Database queries for sites/reservations
 * - Business logic around reservation creation
 * - Guest management
 */

// Zod schemas for response validation
const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
});

interface PricingEvaluationRequest {
  arrival_date: string; // ISO date
  departure_date: string; // ISO date
  site_class_id: string;
  base_rate_cents: number;
  occupancy_percent?: number;
  rules: PricingRule[];
}

interface PricingRule {
  id: string;
  name: string;
  rule_type: string;
  priority: number;
  adjustment_type: string;
  adjustment_value: number;
  applies_to_days?: number[];
  min_stay?: number;
  max_stay?: number;
  date_ranges?: Array<{ start: string; end: string }>;
}

const PricingEvaluationResponseSchema = z.object({
  nights: z.number(),
  base_subtotal_cents: z.number(),
  adjustments_cents: z.number(),
  total_before_tax_cents: z.number(),
  applied_rules: z.array(
    z.object({
      rule_id: z.string(),
      name: z.string(),
      adjustment_cents: z.number(),
    }),
  ),
});

type PricingEvaluationResponse = z.infer<typeof PricingEvaluationResponseSchema>;

interface AvailabilityCheckRequest {
  arrival_date: string;
  departure_date: string;
  site_class_id?: string;
  sites: SiteData[];
  reservations: ReservationData[];
  maintenance: MaintenanceData[];
}

interface SiteData {
  id: string;
  name: string;
  site_class_id: string;
  base_rate_cents?: number;
}

interface ReservationData {
  site_id: string;
  arrival_date: string;
  departure_date: string;
  status: string;
}

interface MaintenanceData {
  site_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

const AvailabilityCheckResponseSchema = z.object({
  available_sites: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      site_class_id: z.string(),
      base_rate_cents: z.number().optional(),
    }),
  ),
  total_available: z.number(),
});

type AvailabilityCheckResponse = z.infer<typeof AvailabilityCheckResponseSchema>;

interface DepositCalculationRequest {
  total_amount_cents: number;
  lodging_only_cents: number;
  nights: number;
  policy: {
    strategy: string;
    percent?: number;
    fixed_cents?: number;
    first_night_only?: boolean;
    cap_cents?: number;
  };
}

const DepositCalculationResponseSchema = z.object({
  deposit_amount_cents: z.number(),
  policy_applied: z.string(),
});

type DepositCalculationResponse = z.infer<typeof DepositCalculationResponseSchema>;

interface ForecastRequest {
  campground_id: string;
  start_date: string;
  end_date: string;
  historical_data: Array<{
    date: string;
    occupancy_percent: number;
    revenue_cents: number;
  }>;
}

const ForecastResponseSchema = z.object({
  forecasts: z.array(
    z.object({
      date: z.string(),
      predicted_occupancy: z.number(),
      predicted_revenue_cents: z.number(),
      confidence: z.number(),
    }),
  ),
});

type ForecastResponse = z.infer<typeof ForecastResponseSchema>;

@Injectable()
export class RustAvailabilityClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RustAvailabilityClientService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private isHealthy = false;
  private fallbackToLocal = false;
  private healthCheckTimeout: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>(
      "RUST_AVAILABILITY_SERVICE_URL",
      "http://localhost:8081",
    );
    this.timeout = this.config.get<number>("RUST_AVAILABILITY_TIMEOUT_MS", 5000);
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
   * Check if the Rust availability service is available
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
        this.logger.log(`Rust availability service connected: ${data.service} v${data.version}`);
        return true;
      }
    } catch {
      this.isHealthy = false;
      this.fallbackToLocal = true;
      this.logger.warn(
        `Rust availability service unavailable at ${this.baseUrl}, using local fallback`,
      );
    }
    return false;
  }

  /**
   * Evaluate pricing via Rust service
   */
  async evaluatePricing(
    request: PricingEvaluationRequest,
  ): Promise<PricingEvaluationResponse | null> {
    if (this.fallbackToLocal) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/pricing/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const json: unknown = await response.json();
      return PricingEvaluationResponseSchema.parse(json);
    } catch (error) {
      this.logger.warn(
        "Rust pricing evaluation failed, using local fallback",
        error instanceof Error ? error.message : error,
      );
      this.scheduleHealthCheck();
      return null;
    }
  }

  /**
   * Check availability via Rust service
   */
  async checkAvailability(
    request: AvailabilityCheckRequest,
  ): Promise<AvailabilityCheckResponse | null> {
    if (this.fallbackToLocal) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/availability/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const json: unknown = await response.json();
      return AvailabilityCheckResponseSchema.parse(json);
    } catch (error) {
      this.logger.warn(
        "Rust availability check failed, using local fallback",
        error instanceof Error ? error.message : error,
      );
      this.scheduleHealthCheck();
      return null;
    }
  }

  /**
   * Calculate deposit via Rust service
   */
  async calculateDeposit(
    request: DepositCalculationRequest,
  ): Promise<DepositCalculationResponse | null> {
    if (this.fallbackToLocal) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/deposits/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const json: unknown = await response.json();
      return DepositCalculationResponseSchema.parse(json);
    } catch (error) {
      this.logger.warn(
        "Rust deposit calculation failed, using local fallback",
        error instanceof Error ? error.message : error,
      );
      this.scheduleHealthCheck();
      return null;
    }
  }

  /**
   * Generate revenue forecast via Rust service
   */
  async generateForecast(request: ForecastRequest): Promise<ForecastResponse | null> {
    if (this.fallbackToLocal) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/forecasting/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRequestHeaders() },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const json: unknown = await response.json();
      return ForecastResponseSchema.parse(json);
    } catch (error) {
      this.logger.warn(
        "Rust forecasting failed, using local fallback",
        error instanceof Error ? error.message : error,
      );
      this.scheduleHealthCheck();
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

    this.healthCheckTimeout = setTimeout(async () => {
      this.healthCheckScheduled = false;
      const healthy = await this.checkHealth();
      if (healthy) {
        this.fallbackToLocal = false;
        this.logger.log("Rust availability service recovered, resuming Rust operations");
      }
    }, 30000);
    this.healthCheckTimeout.unref();
  }
}
