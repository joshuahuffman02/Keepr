import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import fetch from "node-fetch";
import { AlertingService } from "../observability/alerting.service";
import { UsageTrackerService } from "../org-billing/usage-tracker.service";
import { PrismaService } from "../prisma/prisma.service";

interface SmsSendResult {
  providerMessageId?: string;
  provider: string;
  fallback?: string;
  success: boolean;
}

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  source: "campground" | "global";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  // Global/fallback credentials from environment
  private readonly globalTwilioSid = process.env.TWILIO_ACCOUNT_SID || "";
  private readonly globalTwilioToken = process.env.TWILIO_AUTH_TOKEN || "";
  private readonly globalFromNumber = process.env.TWILIO_FROM_NUMBER || "";
  private readonly smsEnabled = process.env.SMS_ENABLED !== "false"; // Feature flag
  private readonly globalIsConfigured: boolean;
  private readonly backoffScheduleMs = [0, 400, 1200];

  // Telemetry counters
  private telemetry = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  constructor(
    private readonly alerting: AlertingService,
    private readonly usageTracker: UsageTrackerService,
    private readonly prisma: PrismaService,
  ) {
    this.globalIsConfigured = !!(
      this.globalTwilioSid &&
      this.globalTwilioToken &&
      this.globalFromNumber
    );
    if (this.globalIsConfigured) {
      this.logger.log("SMS service initialized with global Twilio credentials");
    } else {
      this.logger.warn(
        "SMS service: no global Twilio credentials (per-campground config may still work)",
      );
    }
  }

  /**
   * Check if SMS is available globally (for backwards compatibility)
   */
  isAvailable(): boolean {
    return this.smsEnabled && this.globalIsConfigured;
  }

  /**
   * Check if SMS is available for a specific campground
   */
  async isAvailableForCampground(campgroundId: string): Promise<boolean> {
    if (!this.smsEnabled) return false;
    const creds = await this.getCredentialsForCampground(campgroundId);
    return !!creds;
  }

  /**
   * Get Twilio credentials for a campground
   * Priority:
   * 1. Full campground credentials (campground has their own Twilio account)
   * 2. Campground assigned number + global credentials (platform assigns a dedicated number)
   * 3. Global credentials with global number (shared platform number)
   */
  private async getCredentialsForCampground(
    campgroundId?: string,
  ): Promise<TwilioCredentials | null> {
    if (campgroundId) {
      const campground = await this.prisma.campground.findUnique({
        where: { id: campgroundId },
        select: {
          smsEnabled: true,
          twilioAccountSid: true,
          twilioAuthToken: true,
          twilioFromNumber: true,
        },
      });

      // Option 1: Campground has their own full Twilio credentials
      if (
        campground?.smsEnabled &&
        campground.twilioAccountSid &&
        campground.twilioAuthToken &&
        campground.twilioFromNumber
      ) {
        return {
          accountSid: campground.twilioAccountSid,
          authToken: campground.twilioAuthToken,
          fromNumber: campground.twilioFromNumber,
          source: "campground",
        };
      }

      // Option 2: Campground has an assigned number but uses platform credentials
      if (campground?.twilioFromNumber && this.globalIsConfigured) {
        return {
          accountSid: this.globalTwilioSid,
          authToken: this.globalTwilioToken,
          fromNumber: campground.twilioFromNumber,
          source: "campground", // Still "campground" since it's their dedicated number
        };
      }
    }

    // Option 3: Fall back to global credentials with global number
    if (this.globalIsConfigured) {
      return {
        accountSid: this.globalTwilioSid,
        authToken: this.globalTwilioToken,
        fromNumber: this.globalFromNumber,
        source: "global",
      };
    }

    return null;
  }

  /**
   * Get telemetry stats
   */
  getStats() {
    return { ...this.telemetry, configured: this.globalIsConfigured, enabled: this.smsEnabled };
  }

  async sendSms(opts: {
    to: string;
    body: string;
    campgroundId?: string;
    reservationId?: string;
  }): Promise<SmsSendResult> {
    this.telemetry.attempted++;

    // Feature flag check
    if (!this.smsEnabled) {
      this.logger.debug(`SMS disabled by feature flag, would send to ${opts.to}`);
      this.telemetry.skipped++;
      return { provider: "disabled", fallback: "feature_flag_off", success: false };
    }

    // Get credentials (per-campground or global fallback)
    const credentials = await this.getCredentialsForCampground(opts.campgroundId);

    if (!credentials) {
      this.logger.warn(
        `SMS no-op: No Twilio credentials available. Would send to ${opts.to}: "${opts.body.substring(0, 50)}..."`,
      );
      this.telemetry.skipped++;
      this.dispatchAlert(
        "SMS not configured",
        `Twilio credentials missing; SMS send skipped for ${opts.to}`,
        "warning",
        `sms-not-configured-${opts.campgroundId ?? "global"}`,
        {
          to: opts.to,
          campgroundId: opts.campgroundId,
          reservationId: opts.reservationId,
          reason: "not_configured",
        },
      );
      return { provider: "noop", fallback: "not_configured", success: false };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append("To", opts.to);
    params.append("From", credentials.fromNumber);
    params.append("Body", opts.body);

    const attemptSend = async (): Promise<SmsSendResult> => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        throw new BadRequestException(`Twilio send failed: ${res.status} ${JSON.stringify(data)}`);
      }
      const sid = isRecord(data) && typeof data.sid === "string" ? data.sid : undefined;
      this.telemetry.sent++;
      this.logger.log(
        `SMS sent to ${opts.to} via Twilio (${credentials.source}, sid: ${sid ?? "unknown"})`,
      );

      // Track SMS usage for billing (non-blocking)
      this.trackSmsUsageForBilling(opts.campgroundId, sid);

      return { providerMessageId: sid, provider: "twilio", success: true };
    };

    let lastError: unknown;
    for (const delay of this.backoffScheduleMs) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      try {
        return await attemptSend();
      } catch (err) {
        lastError = err;
        this.logger.warn(`Twilio send attempt failed (delay ${delay}ms): ${err}`);
      }
    }

    this.telemetry.failed++;
    this.logger.error(
      `Twilio failed for ${opts.to} after ${this.backoffScheduleMs.length} attempts: ${lastError}`,
    );
    await this.dispatchAlert(
      "SMS send failure",
      `Twilio failed for ${opts.to} after retries`,
      "error",
      `sms-send-failure-${opts.campgroundId ?? "global"}`,
      {
        to: opts.to,
        campgroundId: opts.campgroundId,
        reservationId: opts.reservationId,
        error: getErrorMessage(lastError),
      },
    );

    // Final fallback: report failure and let caller decide on follow-up/failover.
    return { provider: "twilio", fallback: "send_failed", success: false };
  }

  private async dispatchAlert(
    title: string,
    body: string,
    severity: "info" | "warning" | "error" | "critical",
    dedupKey?: string,
    details?: Record<string, unknown>,
  ) {
    try {
      await this.alerting.dispatch(title, body, severity, dedupKey, details);
    } catch (err) {
      this.logger.debug(`SMS alert dispatch skipped: ${getErrorMessage(err)}`);
    }
  }

  /**
   * Track SMS usage for billing (non-blocking, fire-and-forget)
   */
  private async trackSmsUsageForBilling(campgroundId?: string, messageId?: string) {
    try {
      if (!campgroundId) {
        this.logger.debug("Cannot track SMS usage: no campgroundId provided");
        return;
      }

      // Look up organization from campground
      const campground = await this.prisma.campground.findUnique({
        where: { id: campgroundId },
        select: { organizationId: true },
      });

      if (!campground?.organizationId) {
        this.logger.debug(`Cannot track SMS usage: no organization for campground ${campgroundId}`);
        return;
      }

      await this.usageTracker.trackSmsSent(
        campground.organizationId,
        campgroundId,
        "outbound",
        messageId,
        1, // segment count - Twilio charges per segment
      );
    } catch (err) {
      // Don't fail SMS send if usage tracking fails
      this.logger.debug(`SMS usage tracking failed: ${getErrorMessage(err)}`);
    }
  }
}
