import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { BullQueueService, JobData } from "../bull-queue.service";

export interface WebhookJobData {
  webhookId: string;
  url: string;
  event: string;
  payload: Record<string, unknown>;
  signature?: string;
  headers?: Record<string, string>;
}

export const WEBHOOK_QUEUE = "webhook";

@Injectable()
export class WebhookQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(WebhookQueueProcessor.name);

  constructor(private readonly queueService: BullQueueService) {}

  onModuleInit() {
    this.queueService.registerProcessor<WebhookJobData>(
      WEBHOOK_QUEUE,
      this.process.bind(this)
    );
    this.logger.log("Webhook processor registered");
  }

  private async process(job: JobData<WebhookJobData>): Promise<{
    success: boolean;
    statusCode?: number;
    duration?: number;
  }> {
    const { webhookId, url, event, payload, signature, headers } = job.data;
    const startTime = Date.now();

    this.logger.debug(`Processing webhook ${webhookId}: ${event} to ${url}`);

    try {
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Campreserv-Webhooks/1.0",
        "X-Webhook-Event": event,
        "X-Webhook-Delivery": job.id,
        ...headers,
      };

      if (signature) {
        requestHeaders["X-Webhook-Signature"] = signature;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger.log(`Webhook delivered: ${event} to ${url} (${duration}ms)`);

      return {
        success: true,
        statusCode: response.status,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Webhook failed: ${event} to ${url} - ${message}`);

      throw error;
    }
  }
}
