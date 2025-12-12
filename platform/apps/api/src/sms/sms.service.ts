import { Injectable, Logger } from "@nestjs/common";
import fetch from "node-fetch";
import { AlertingService } from "../observability/alerting.service";

interface SmsSendResult {
  providerMessageId?: string;
  provider: string;
  fallback?: string;
  success: boolean;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly twilioSid = process.env.TWILIO_ACCOUNT_SID || "";
  private readonly twilioToken = process.env.TWILIO_AUTH_TOKEN || "";
  private readonly fromNumber = process.env.TWILIO_FROM_NUMBER || "";
  private readonly smsEnabled = process.env.SMS_ENABLED !== "false"; // Feature flag
  private readonly isConfigured: boolean;
  private readonly backoffScheduleMs = [0, 400, 1200];

  // Telemetry counters
  private telemetry = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  constructor(private readonly alerting: AlertingService) {
    this.isConfigured = !!(this.twilioSid && this.twilioToken && this.fromNumber);
    if (this.isConfigured) {
      this.logger.log("SMS service initialized with Twilio credentials");
    } else {
      this.logger.warn("SMS service running in no-op mode (Twilio not configured)");
    }
  }

  /**
   * Check if SMS is available
   */
  isAvailable(): boolean {
    return this.smsEnabled && this.isConfigured;
  }

  /**
   * Get telemetry stats
   */
  getStats() {
    return { ...this.telemetry, configured: this.isConfigured, enabled: this.smsEnabled };
  }

  async sendSms(opts: { to: string; body: string; campgroundId?: string; reservationId?: string }): Promise<SmsSendResult> {
    this.telemetry.attempted++;

    // Feature flag check
    if (!this.smsEnabled) {
      this.logger.debug(`SMS disabled by feature flag, would send to ${opts.to}`);
      this.telemetry.skipped++;
      return { provider: "disabled", fallback: "feature_flag_off", success: false };
    }

    // Credentials check
    if (!this.isConfigured) {
      this.logger.warn(`SMS no-op: Twilio not configured. Would send to ${opts.to}: "${opts.body.substring(0, 50)}..."`);
      this.telemetry.skipped++;
      this.dispatchAlert("SMS not configured", `Twilio credentials missing; SMS send skipped for ${opts.to}`, "warning", {
        to: opts.to,
        campgroundId: opts.campgroundId,
        reservationId: opts.reservationId,
        reason: "not_configured",
      });
      return { provider: "noop", fallback: "not_configured", success: false };
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append("To", opts.to);
    params.append("From", this.fromNumber);
    params.append("Body", opts.body);

    const attemptSend = async (): Promise<SmsSendResult> => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      });
      const data: any = await res.json();
      if (!res.ok) {
        throw new Error(`Twilio send failed: ${res.status} ${JSON.stringify(data)}`);
      }
      this.telemetry.sent++;
      this.logger.log(`SMS sent to ${opts.to} via Twilio (sid: ${data.sid})`);
      return { providerMessageId: data.sid, provider: "twilio", success: true };
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
    this.logger.error(`Twilio failed for ${opts.to} after ${this.backoffScheduleMs.length} attempts: ${lastError}`);
    await this.dispatchAlert(
      "SMS send failure",
      `Twilio failed for ${opts.to} after retries`,
      "error",
      `sms-send-failure-${opts.campgroundId ?? "global"}`,
      { to: opts.to, campgroundId: opts.campgroundId, reservationId: opts.reservationId, error: (lastError as any)?.message }
    );

    // Final fallback: report failure and let caller decide on follow-up/failover.
    return { provider: "twilio", fallback: "send_failed", success: false };
  }

  private async dispatchAlert(
    title: string,
    body: string,
    severity: "info" | "warning" | "error" | "critical",
    dedupKey?: string,
    details?: Record<string, any>
  ) {
    try {
      await this.alerting.dispatch(title, body, severity, dedupKey, details);
    } catch (err) {
      this.logger.debug(`SMS alert dispatch skipped: ${(err as any)?.message ?? err}`);
    }
  }
}

