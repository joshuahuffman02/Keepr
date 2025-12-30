import { Logger } from "@nestjs/common";

export interface OtaBooking {
  externalId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  arrivalDate: Date;
  departureDate: Date;
  status: "confirmed" | "cancelled" | "pending";
  totalCents?: number;
  adults?: number;
  children?: number;
  notes?: string;
  rawData?: Record<string, unknown>;
}

export interface OtaSyncResult {
  success: boolean;
  newBookings: number;
  updatedBookings: number;
  duplicatesSkipped: number;
  errors: Array<{ externalId: string; message: string }>;
  lastSyncAt: Date;
}

export interface OtaProviderConfig {
  channelId: string;
  campgroundId: string;
  provider: string;
  icalUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  rateMultiplier?: number;
  defaultStatus?: "confirmed" | "pending";
}

/**
 * Base abstract class for OTA providers
 * Implements rate limiting and retry patterns from scraping-apis
 */
export abstract class BaseOtaProvider {
  protected readonly logger: Logger;
  protected readonly config: OtaProviderConfig;

  // Rate limiting configuration (from scraping-apis patterns)
  protected readonly REQUEST_DELAY_MS = 500; // Delay between requests
  protected readonly ERROR_RETRY_DELAY_MS = 5000; // Delay after error
  protected readonly MAX_RETRIES = 3;

  constructor(config: OtaProviderConfig) {
    this.config = config;
    this.logger = new Logger(`OtaProvider:${config.provider}`);
  }

  /**
   * Fetch bookings from the OTA
   * Must be implemented by each provider
   */
  abstract fetchBookings(): Promise<OtaBooking[]>;

  /**
   * Get provider name
   */
  abstract get providerName(): string;

  /**
   * Rate-limited delay between requests
   * Pattern from scraping-apis/fetch_apify_actors.js:122
   */
  protected async rateLimitDelay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.REQUEST_DELAY_MS));
  }

  /**
   * Error retry delay
   * Pattern from scraping-apis/fetch_apify_actors.js:127
   */
  protected async errorRetryDelay(): Promise<void> {
    this.logger.warn(`Retrying in ${this.ERROR_RETRY_DELAY_MS / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, this.ERROR_RETRY_DELAY_MS));
  }

  /**
   * Fetch with retry logic
   * Pattern from scraping-apis/fetch_apify_actors.js:124-128
   */
  protected async fetchWithRetry<T>(
    fetchFn: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.rateLimitDelay();
        return await fetchFn();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(
          `${context} failed (attempt ${attempt}/${this.MAX_RETRIES}): ${lastError.message}`
        );

        if (attempt < this.MAX_RETRIES) {
          await this.errorRetryDelay();
        }
      }
    }

    throw lastError;
  }

  /**
   * Normalize guest name from various formats
   */
  protected normalizeGuestName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: "" };
    }
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts[parts.length - 1],
    };
  }

  /**
   * Parse date from various OTA formats
   */
  protected parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Try ISO format first
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try common formats: YYYYMMDD, MM/DD/YYYY
    const yyyymmdd = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmdd) {
      return new Date(`${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`);
    }

    const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
      return new Date(`${mmddyyyy[3]}-${mmddyyyy[1].padStart(2, "0")}-${mmddyyyy[2].padStart(2, "0")}`);
    }

    return null;
  }
}
