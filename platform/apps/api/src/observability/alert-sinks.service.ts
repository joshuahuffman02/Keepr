import { Injectable, Logger } from "@nestjs/common";

type SlackBlock = Record<string, unknown>;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Alert severity levels matching PagerDuty severity model
 */
export type AlertSeverity = "info" | "warning" | "error" | "critical";

/**
 * Standard alert payload structure
 */
export interface AlertPayload {
  title: string;
  message: string;
  severity: AlertSeverity;
  dedupKey?: string;
  source?: string;
  details?: Record<string, unknown>;
  timestamp?: Date;
}

/**
 * Result from sending an alert
 */
export interface AlertResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  rateLimited?: boolean;
}

/**
 * Abstract interface for alert sink implementations
 * Extend this to add new alert destinations (email, OpsGenie, etc.)
 */
export abstract class AlertSink {
  abstract readonly name: string;
  abstract send(payload: AlertPayload): Promise<AlertResult>;
  abstract isConfigured(): boolean;
}

/**
 * Rate limiter for preventing alert storms
 * Uses sliding window with configurable limits per dedup key
 */
class AlertRateLimiter {
  private readonly windows: Map<string, number[]> = new Map();
  private readonly maxAlertsPerWindow: number;
  private readonly windowMs: number;
  private readonly cleanupIntervalMs = 60 * 1000; // Cleanup every minute
  private lastCleanup = Date.now();

  constructor(maxAlertsPerWindow = 5, windowMs = 5 * 60 * 1000) {
    this.maxAlertsPerWindow = maxAlertsPerWindow;
    this.windowMs = windowMs;
  }

  /**
   * Check if an alert with the given key should be allowed
   * Returns true if allowed, false if rate limited
   */
  allow(key: string): boolean {
    const now = Date.now();
    this.maybeCleanup(now);

    const timestamps = this.windows.get(key) || [];
    const windowStart = now - this.windowMs;

    // Filter to only timestamps within the current window
    const recentTimestamps = timestamps.filter((t) => t > windowStart);

    if (recentTimestamps.length >= this.maxAlertsPerWindow) {
      return false;
    }

    recentTimestamps.push(now);
    this.windows.set(key, recentTimestamps);
    return true;
  }

  /**
   * Periodic cleanup of old entries to prevent memory leaks
   */
  private maybeCleanup(now: number): void {
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }

    const windowStart = now - this.windowMs;
    const keysToDelete: string[] = [];
    const keysToUpdate: Array<{ key: string; timestamps: number[] }> = [];

    this.windows.forEach((timestamps, key) => {
      const recent = timestamps.filter((t) => t > windowStart);
      if (recent.length === 0) {
        keysToDelete.push(key);
      } else if (recent.length !== timestamps.length) {
        keysToUpdate.push({ key, timestamps: recent });
      }
    });

    for (const key of keysToDelete) {
      this.windows.delete(key);
    }
    for (const { key, timestamps } of keysToUpdate) {
      this.windows.set(key, timestamps);
    }

    // Prevent unbounded growth - limit to 1000 unique keys
    if (this.windows.size > 1000) {
      const entries: Array<[string, number[]]> = [];
      this.windows.forEach((value, key) => {
        entries.push([key, value]);
      });
      entries.sort((a, b) => Math.max(...b[1]) - Math.max(...a[1]));
      this.windows.clear();
      for (let i = 0; i < Math.min(500, entries.length); i++) {
        this.windows.set(entries[i][0], entries[i][1]);
      }
    }

    this.lastCleanup = now;
  }
}

/**
 * PagerDuty alert sink implementation
 * Uses PagerDuty Events API v2
 */
export class PagerDutySink extends AlertSink {
  readonly name = "pagerduty";
  private readonly logger = new Logger(PagerDutySink.name);
  private readonly routingKey: string | undefined;
  private readonly namespace: string;

  constructor() {
    super();
    this.routingKey = process.env.PAGERDUTY_ROUTING_KEY || process.env.PAGERDUTY_SERVICE_KEY;
    this.namespace = process.env.METRICS_NAMESPACE || "campreserv";
  }

  isConfigured(): boolean {
    return !!this.routingKey;
  }

  async send(payload: AlertPayload): Promise<AlertResult> {
    if (!this.routingKey) {
      return { ok: false, skipped: true };
    }

    const dedupKey =
      payload.dedupKey || `${this.namespace}:${payload.title.toLowerCase().replace(/\s+/g, "-")}`;

    const body = {
      routing_key: this.routingKey,
      event_action: "trigger",
      dedup_key: dedupKey,
      payload: {
        summary: `${payload.title} - ${payload.message}`.slice(0, 1024),
        source: payload.source || "campreserv-api",
        severity: payload.severity,
        timestamp: (payload.timestamp || new Date()).toISOString(),
        custom_details: {
          ...payload.details,
          namespace: this.namespace,
        },
      },
    };

    try {
      const response = await fetch("https://events.pagerduty.com/v2/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "unknown");
        this.logger.warn(`PagerDuty API returned ${response.status}: ${text}`);
        return { ok: false, error: `HTTP ${response.status}` };
      }

      return { ok: true };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      this.logger.error(`PagerDuty send failed: ${message}`);
      return { ok: false, error: message || "unknown error" };
    }
  }
}

/**
 * Slack webhook alert sink implementation
 * Sends formatted messages to a Slack channel via incoming webhook
 */
export class SlackSink extends AlertSink {
  readonly name = "slack";
  private readonly logger = new Logger(SlackSink.name);
  private readonly webhookUrl: string | undefined;

  constructor() {
    super();
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.SLACK_ALERT_WEBHOOK;
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  async send(payload: AlertPayload): Promise<AlertResult> {
    if (!this.webhookUrl) {
      return { ok: false, skipped: true };
    }

    const severityEmoji = this.getSeverityEmoji(payload.severity);
    const color = this.getSeverityColor(payload.severity);

    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${severityEmoji} ${payload.title}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: payload.message,
        },
      },
    ];

    // Add details as fields if present
    if (payload.details && Object.keys(payload.details).length > 0) {
      const fields = Object.entries(payload.details)
        .slice(0, 10) // Limit to 10 fields
        .map(([key, value]) => ({
          type: "mrkdwn",
          text: `*${key}:* ${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
        }));

      blocks.push({
        type: "section",
        fields,
      });
    }

    // Add timestamp
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Severity: *${payload.severity.toUpperCase()}* | Source: ${payload.source || "campreserv-api"} | ${(payload.timestamp || new Date()).toISOString()}`,
        },
      ],
    });

    const body = {
      attachments: [
        {
          color,
          blocks,
        },
      ],
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "unknown");
        this.logger.warn(`Slack webhook returned ${response.status}: ${text}`);
        return { ok: false, error: `HTTP ${response.status}` };
      }

      return { ok: true };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      this.logger.error(`Slack send failed: ${message}`);
      return { ok: false, error: message || "unknown error" };
    }
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case "critical":
        return ":rotating_light:";
      case "error":
        return ":x:";
      case "warning":
        return ":warning:";
      case "info":
      default:
        return ":information_source:";
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case "critical":
        return "#dc2626"; // red-600
      case "error":
        return "#ea580c"; // orange-600
      case "warning":
        return "#ca8a04"; // yellow-600
      case "info":
      default:
        return "#2563eb"; // blue-600
    }
  }
}

/**
 * Unified alert sinks service
 * Manages multiple alert destinations with rate limiting
 */
@Injectable()
export class AlertSinksService {
  private readonly logger = new Logger(AlertSinksService.name);
  private readonly sinks: AlertSink[] = [];
  private readonly rateLimiter: AlertRateLimiter;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = (process.env.ALERT_SINKS_ENABLED ?? "true").toLowerCase() === "true";

    const maxAlertsPerWindow = Number(process.env.ALERT_RATE_LIMIT_COUNT ?? 5);
    const windowMs = Number(process.env.ALERT_RATE_LIMIT_WINDOW_MS ?? 5 * 60 * 1000);
    this.rateLimiter = new AlertRateLimiter(maxAlertsPerWindow, windowMs);

    // Register default sinks
    this.registerSink(new PagerDutySink());
    this.registerSink(new SlackSink());

    const configuredSinks = this.sinks.filter((s) => s.isConfigured()).map((s) => s.name);
    if (configuredSinks.length > 0) {
      this.logger.log(`Alert sinks initialized: ${configuredSinks.join(", ")}`);
    } else {
      this.logger.warn(
        "No alert sinks configured (set PAGERDUTY_ROUTING_KEY or SLACK_WEBHOOK_URL)",
      );
    }
  }

  /**
   * Register a custom alert sink
   */
  registerSink(sink: AlertSink): void {
    this.sinks.push(sink);
  }

  /**
   * Get all registered sinks
   */
  getSinks(): AlertSink[] {
    return [...this.sinks];
  }

  /**
   * Get configured (ready to use) sinks
   */
  getConfiguredSinks(): AlertSink[] {
    return this.sinks.filter((s) => s.isConfigured());
  }

  /**
   * Send an alert to all configured sinks
   * Applies rate limiting based on dedupKey
   */
  async dispatch(payload: AlertPayload): Promise<Record<string, AlertResult>> {
    if (!this.enabled) {
      return { _disabled: { ok: false, skipped: true } };
    }

    const dedupKey = payload.dedupKey || payload.title;

    // Check rate limiting
    if (!this.rateLimiter.allow(dedupKey)) {
      this.logger.debug(`Rate limited alert: ${payload.title}`);
      return { _rateLimited: { ok: false, rateLimited: true } };
    }

    const results: Record<string, AlertResult> = {};
    const configuredSinks = this.getConfiguredSinks();

    if (configuredSinks.length === 0) {
      this.logger.warn(`Alert not sent (no configured sinks): ${payload.title}`);
      return { _noSinks: { ok: false, skipped: true } };
    }

    // Send to all configured sinks in parallel
    const sendPromises = configuredSinks.map(async (sink) => {
      try {
        const result = await sink.send(payload);
        results[sink.name] = result;
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        this.logger.error(`Sink ${sink.name} threw: ${message}`);
        results[sink.name] = { ok: false, error: message || "exception" };
      }
    });

    await Promise.all(sendPromises);

    const successCount = Object.values(results).filter((r) => r.ok).length;
    if (successCount === 0) {
      this.logger.error(`All alert sinks failed for: ${payload.title}`);
    }

    return results;
  }

  /**
   * Convenience method for critical alerts
   */
  async critical(
    title: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<Record<string, AlertResult>> {
    return this.dispatch({ title, message, severity: "critical", details });
  }

  /**
   * Convenience method for error alerts
   */
  async error(
    title: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<Record<string, AlertResult>> {
    return this.dispatch({ title, message, severity: "error", details });
  }

  /**
   * Convenience method for warning alerts
   */
  async warning(
    title: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<Record<string, AlertResult>> {
    return this.dispatch({ title, message, severity: "warning", details });
  }

  /**
   * Convenience method for info alerts
   */
  async info(
    title: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<Record<string, AlertResult>> {
    return this.dispatch({ title, message, severity: "info", details });
  }
}
