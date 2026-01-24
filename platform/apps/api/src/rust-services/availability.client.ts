import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Types for Availability Calculator Rust service
 */
export interface PricingRule {
  id: string;
  name: string;
  priority: number;
  adjustment_type: "percent" | "fixed";
  adjustment_value: number;
  stack_mode: "additive" | "override" | "max";
  days_of_week?: number[];
  start_date?: string;
  end_date?: string;
  min_nights?: number;
  max_nights?: number;
}

export interface DemandBand {
  occupancy_threshold: number;
  multiplier: number;
}

export interface EvaluatePricingRequest {
  campground_id: string;
  site_class_id: string;
  base_rate_cents: number;
  arrival_date: string; // YYYY-MM-DD
  departure_date: string;
  rules: PricingRule[];
  demand_bands?: DemandBand[];
  current_occupancy?: number;
}

export interface NightlyRate {
  date: string;
  rate_cents: number;
  applied_rules: string[];
}

export interface PricingResult {
  total_cents: number;
  nights: number;
  average_rate_cents: number;
  nightly_rates: NightlyRate[];
  demand_multiplier?: number;
}

export interface SiteData {
  id: string;
  name: string;
  site_class_id: string;
  base_rate_cents?: number;
}

export interface ReservationData {
  site_id: string;
  arrival_date: string;
  departure_date: string;
  status: string;
}

export interface MaintenanceData {
  site_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export interface CheckAvailabilityRequest {
  campground_id: string;
  site_class_id?: string;
  arrival_date: string;
  departure_date: string;
  sites: SiteData[];
  reservations: ReservationData[];
  maintenance: MaintenanceData[];
}

export interface SiteAvailability {
  site_id: string;
  site_name: string;
  site_class_id: string;
  is_available: boolean;
  unavailable_reason?: string;
  base_rate_cents?: number;
}

export interface CheckAvailabilityResponse {
  available_sites: SiteAvailability[];
  total_sites_checked: number;
  available_count: number;
}

export interface DepositPolicy {
  id: string;
  strategy: "first_night" | "percent" | "fixed";
  value: number;
  apply_to: "lodging_only" | "lodging_plus_fees";
  min_cap?: number;
  max_cap?: number;
}

export interface CalculateDepositRequest {
  lodging_cents: number;
  first_night_rate_cents: number;
  fees_cents: number;
  policy: DepositPolicy;
}

export interface DepositResult {
  deposit_cents: number;
  base_amount_cents: number;
  strategy: string;
  min_cap_applied: boolean;
  max_cap_applied: boolean;
}

/**
 * Client for Availability Calculator Rust service.
 *
 * Handles pricing evaluation, availability checking, and deposit calculation.
 */
@Injectable()
export class AvailabilityClient implements OnModuleInit {
  private readonly logger = new Logger(AvailabilityClient.name);
  private baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get("AVAILABILITY_SERVICE_URL") || "http://localhost:8081";
  }

  async onModuleInit() {
    try {
      const healthy = await this.healthCheck();
      if (healthy) {
        this.logger.log(`Availability Calculator service available at ${this.baseUrl}`);
      }
    } catch {
      this.logger.warn(
        `Availability Calculator service not available at ${this.baseUrl}. ` +
          `Some features will use fallback implementation.`,
      );
    }
  }

  /**
   * Check if the availability service is healthy.
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
   * Evaluate pricing for a reservation.
   */
  async evaluatePricing(request: EvaluatePricingRequest): Promise<PricingResult> {
    const response = await fetch(`${this.baseUrl}/api/pricing/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to evaluate pricing");
    }

    return response.json();
  }

  /**
   * Check site availability for a date range.
   */
  async checkAvailability(request: CheckAvailabilityRequest): Promise<CheckAvailabilityResponse> {
    const response = await fetch(`${this.baseUrl}/api/availability/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to check availability");
    }

    return response.json();
  }

  /**
   * Calculate deposit amount based on policy.
   */
  async calculateDeposit(request: CalculateDepositRequest): Promise<DepositResult> {
    const response = await fetch(`${this.baseUrl}/api/deposits/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to calculate deposit");
    }

    return response.json();
  }

  /**
   * Generate revenue forecast.
   */
  async generateForecast(request: {
    campground_id: string;
    start_date: string;
    days: number;
    avg_daily_rate_cents: number;
    occupancy_data: Array<{
      date: string;
      occupied_sites: number;
      total_sites: number;
    }>;
  }): Promise<{
    campground_id: string;
    daily_forecasts: Array<{
      date: string;
      occupancy_percent: number;
      projected_revenue_cents: number;
      confidence: number;
    }>;
    total_revenue_cents: number;
    avg_occupancy_percent: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/forecasting/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to generate forecast");
    }

    return response.json();
  }
}
