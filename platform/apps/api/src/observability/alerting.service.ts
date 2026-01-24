import { Injectable, Logger } from "@nestjs/common";

type Severity = "info" | "warning" | "error" | "critical";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly slackWebhook = process.env.SLACK_ALERT_WEBHOOK;
  private readonly pagerDutyKey = process.env.PAGERDUTY_SERVICE_KEY;
  private readonly namespace = process.env.METRICS_NAMESPACE || "campreserv";

  async notifySlack(text: string, payload?: Record<string, unknown>) {
    if (!this.slackWebhook) {
      this.logger.debug(`Slack alert skipped (no webhook configured)`);
      return { ok: false, skipped: true };
    }
    try {
      await fetch(this.slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...payload }),
      });
      return { ok: true };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      this.logger.warn(`Failed to post Slack alert: ${message}`);
      return { ok: false, error: message };
    }
  }

  async notifyPagerDuty(
    summary: string,
    severity: Severity = "error",
    source = "campreserv-api",
    dedupKey?: string,
    details?: Record<string, unknown>,
  ) {
    if (!this.pagerDutyKey) {
      this.logger.debug(`PagerDuty alert skipped (no service key configured)`);
      return { ok: false, skipped: true };
    }

    const body = {
      routing_key: this.pagerDutyKey,
      event_action: "trigger",
      dedup_key: dedupKey ?? `${this.namespace}:${summary.toLowerCase().replace(/\s+/g, "-")}`,
      payload: {
        summary,
        source,
        severity,
        custom_details: details ?? {},
      },
    };

    try {
      await fetch("https://events.pagerduty.com/v2/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { ok: true };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      this.logger.warn(`Failed to post PagerDuty alert: ${message}`);
      return { ok: false, error: message };
    }
  }

  async dispatch(
    title: string,
    body: string,
    severity: Severity = "error",
    dedupKey?: string,
    details?: Record<string, unknown>,
  ) {
    const slack = await this.notifySlack(`:rotating_light: ${title}\n${body}`);
    const pd = await this.notifyPagerDuty(
      `${title} — ${body}`,
      severity,
      "campreserv-api",
      dedupKey,
      details,
    );
    return { slack, pagerDuty: pd };
  }
}
