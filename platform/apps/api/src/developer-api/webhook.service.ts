import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookSecurityService } from "../webhooks/webhook-security.service";
import { WebhookEvent } from "../webhooks/event-catalog";

// Re-export for backward compatibility
export { WebhookEvent } from "../webhooks/event-catalog";

/**
 * Retry configuration for webhook deliveries
 *
 * Version 2.0 uses shorter intervals: 1s, 10s, 60s
 * After 3 failed attempts, moves to dead letter queue
 */
const RETRY_DELAYS_MS = [
  1_000, // 1 second
  10_000, // 10 seconds
  60_000, // 60 seconds
];
const MAX_RETRIES = 3;
const DELIVERY_TIMEOUT_MS = 30_000;

/**
 * WebhookService - Legacy API with Webhook 2.0 features
 *
 * This service maintains backward compatibility with existing code while
 * incorporating Webhook 2.0 enhancements:
 * - HMAC-SHA256 signatures with separate timestamp header
 * - Faster retry with exponential backoff (1s, 10s, 60s)
 * - Dead letter queue for persistent failures
 * - Improved logging and error handling
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly securityService: WebhookSecurityService;

  constructor(private readonly prisma: PrismaService) {
    // Create security service inline for backward compatibility
    // (avoids requiring module restructuring)
    this.securityService = new WebhookSecurityService();
  }

  /**
   * Compute signature using legacy format for backward compatibility
   * Format: t=<timestamp>,v1=<digest>
   */
  private computeSignature(
    secret: string,
    payload: string,
    timestamp: number
  ): string {
    return this.securityService.generateLegacySignature(
      secret,
      payload,
      timestamp
    );
  }

  /**
   * Create a new webhook endpoint
   */
  async createEndpoint(input: {
    campgroundId: string;
    apiClientId?: string | null;
    url: string;
    description?: string;
    eventTypes: string[];
  }) {
    const crypto = await import("crypto");
    const secret = `wh_${crypto.randomBytes(16).toString("hex")}`;

    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        campgroundId: input.campgroundId,
        apiClientId: input.apiClientId || null,
        url: input.url,
        description: input.description,
        eventTypes: input.eventTypes,
        secret,
      },
    });

    this.logger.log(
      `Created webhook endpoint ${endpoint.id} for campground ${input.campgroundId}`
    );

    return { endpoint, secret };
  }

  /**
   * List webhook endpoints for a campground
   */
  listEndpoints(campgroundId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Toggle webhook endpoint active status
   */
  async toggleEndpoint(id: string, campgroundId: string, isActive: boolean) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, campgroundId },
      select: { id: true }
    });
    if (!endpoint) {
      throw new NotFoundException("Webhook endpoint not found");
    }
    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { isActive, disabledAt: isActive ? null : new Date() },
    });

    this.logger.log(`Webhook endpoint ${id} ${isActive ? "enabled" : "disabled"}`);

    return updated;
  }

  /**
   * Emit a webhook event to all matching endpoints
   *
   * Supports wildcards:
   * - "*" matches all events
   * - "reservation.*" matches all reservation events
   */
  async emit(
    eventType: WebhookEvent,
    campgroundId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        campgroundId,
        isActive: true,
        OR: [
          { eventTypes: { has: eventType } },
          { eventTypes: { has: "*" } },
          { eventTypes: { has: `${eventType.split(".")[0]}.*` } },
        ],
      },
    });

    if (!endpoints.length) {
      this.logger.debug(
        `No webhook endpoints for event ${eventType} in campground ${campgroundId}`
      );
      return;
    }

    const body = JSON.stringify({
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    for (const ep of endpoints) {
      const timestamp = Date.now();
      const signature = this.computeSignature(ep.secret, body, timestamp);

      // Generate new v2 signature format as well
      const { signature: v2Signature, timestamp: v2Timestamp } =
        this.securityService.generateSignature(ep.secret, body);

      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookEndpointId: ep.id,
          eventType,
          status: "pending",
          payload,
          signature, // Store legacy signature
          attempt: 1,
          nextRetryAt: null,
        },
      });

      // Attempt delivery with both v1 and v2 headers
      this.attemptDelivery(
        delivery.id,
        ep.url,
        ep.secret,
        body,
        signature,
        v2Signature,
        v2Timestamp
      ).catch((err) => {
        this.logger.error(
          `Failed to deliver webhook ${delivery.id}: ${err.message}`
        );
      });
    }
  }

  /**
   * Attempt to deliver a webhook
   */
  private async attemptDelivery(
    deliveryId: string,
    url: string,
    secret: string,
    body: string,
    legacySignature?: string,
    v2Signature?: string,
    v2Timestamp?: number
  ): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery) return;

    const timestamp = Date.now();
    const signature = legacySignature || this.computeSignature(secret, body, timestamp);

    // Generate v2 signature if not provided
    const sig2 =
      v2Signature ||
      this.securityService.generateSignature(secret, body).signature;
    const ts2 =
      v2Timestamp || Math.floor(Date.now() / 1000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Legacy signature header (combined format)
          "X-Campreserv-Signature": signature,
          // v2 separate timestamp header
          "X-Campreserv-Timestamp": String(ts2),
          // Delivery metadata
          "X-Campreserv-Delivery-Id": deliveryId,
          "X-Campreserv-Attempt": String(delivery.attempt || 1),
          "User-Agent": "Campreserv-Webhooks/2.0",
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await res.text();

      if (res.ok) {
        await this.prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "delivered",
            responseStatus: res.status,
            responseBody: text?.slice(0, 2000),
            deliveredAt: new Date(),
            nextRetryAt: null,
          },
        });

        this.logger.log(`Webhook ${deliveryId} delivered successfully to ${url}`);
      } else {
        await this.scheduleRetry(deliveryId, res.status, text?.slice(0, 2000));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Webhook send failed";
      await this.scheduleRetry(deliveryId, null, message);
    }
  }

  /**
   * Schedule a retry or move to dead letter queue
   */
  private async scheduleRetry(
    deliveryId: string,
    responseStatus: number | null,
    errorMessage: string
  ): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery) return;

    const attempt = delivery.attempt || 1;

    if (attempt >= MAX_RETRIES) {
      // Move to dead letter queue instead of just marking as failed
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "dead_letter",
          responseStatus,
          errorMessage,
          nextRetryAt: null,
        },
      });

      this.logger.warn(
        `Webhook ${deliveryId} moved to dead letter queue after ${attempt} attempts`
      );
      return;
    }

    // Schedule next retry with exponential backoff
    const delayMs =
      RETRY_DELAYS_MS[attempt - 1] ||
      RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    const nextRetryAt = new Date(Date.now() + delayMs);

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "retrying",
        responseStatus,
        errorMessage,
        attempt: attempt + 1,
        nextRetryAt,
      },
    });

    this.logger.log(
      `Webhook ${deliveryId} scheduled for retry ${attempt + 1} in ${delayMs}ms`
    );
  }

  /**
   * Process pending retries (call from cron job)
   */
  async processRetries(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const pendingRetries = await this.prisma.webhookDelivery.findMany({
      where: {
        status: "retrying",
        nextRetryAt: { lte: new Date() },
      },
      include: { webhookEndpoint: true },
      take: 100,
    });

    let succeeded = 0;
    let failed = 0;

    for (const delivery of pendingRetries) {
      if (!delivery.webhookEndpoint || !delivery.webhookEndpoint.isActive) {
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "dead_letter",
            errorMessage: "Endpoint disabled or deleted",
          },
        });
        failed++;
        continue;
      }

      const body = JSON.stringify({
        event: delivery.eventType,
        data: delivery.payload,
        timestamp: new Date().toISOString(),
      });

      try {
        await this.attemptDelivery(
          delivery.id,
          delivery.webhookEndpoint.url,
          delivery.webhookEndpoint.secret,
          body
        );

        // Check if it was delivered
        const updated = await this.prisma.webhookDelivery.findUnique({
          where: { id: delivery.id },
        });
        if (updated?.status === "delivered") {
          succeeded++;
        } else if (updated?.status === "dead_letter") {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { processed: pendingRetries.length, succeeded, failed };
  }

  /**
   * Get webhook stats for a campground
   */
  async getStats(campgroundId: string) {
    const [total, delivered, failed, retrying, deadLetter] = await Promise.all([
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { campgroundId } },
      }),
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { campgroundId }, status: "delivered" },
      }),
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { campgroundId }, status: "failed" },
      }),
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { campgroundId }, status: "retrying" },
      }),
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { campgroundId }, status: "dead_letter" },
      }),
    ]);

    const successRate = total > 0 ? Math.round((delivered / total) * 100) : 100;

    return { total, delivered, failed, retrying, deadLetter, successRate };
  }

  /**
   * List webhook deliveries for a campground
   */
  listDeliveries(campgroundId: string, limit = 50) {
    return this.prisma.webhookDelivery.findMany({
      where: { webhookEndpoint: { campgroundId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { webhookEndpoint: true },
    });
  }

  /**
   * Get dead letter queue entries
   */
  getDeadLetterQueue(campgroundId: string, limit = 50) {
    return this.prisma.webhookDelivery.findMany({
      where: {
        status: "dead_letter",
        webhookEndpoint: { campgroundId },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { webhookEndpoint: true },
    });
  }

  /**
   * Replay a failed delivery
   */
  async replay(deliveryId: string, campgroundId: string) {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, webhookEndpoint: { campgroundId } },
      include: { webhookEndpoint: true },
    });

    if (!delivery || !delivery.webhookEndpoint) {
      throw new NotFoundException("Delivery not found");
    }

    const body = JSON.stringify({
      event: delivery.eventType,
      data: delivery.payload,
      timestamp: new Date().toISOString(),
    });

    const timestamp = Date.now();
    const signature = this.computeSignature(
      delivery.webhookEndpoint.secret,
      body,
      timestamp
    );

    const replayLog = await this.prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: delivery.webhookEndpointId,
        eventType: delivery.eventType,
        payload: delivery.payload as object,
        signature,
        status: "pending",
        attempt: 1, // Reset attempt for replay
        replayOfId: delivery.id,
      },
    });

    try {
      const { signature: v2Sig, timestamp: v2Ts } =
        this.securityService.generateSignature(
          delivery.webhookEndpoint.secret,
          body
        );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const res = await fetch(delivery.webhookEndpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Campreserv-Signature": signature,
          "X-Campreserv-Timestamp": String(v2Ts),
          "X-Campreserv-Delivery-Id": replayLog.id,
          "X-Campreserv-Attempt": "1",
          "User-Agent": "Campreserv-Webhooks/2.0",
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await res.text();

      await this.prisma.webhookDelivery.update({
        where: { id: replayLog.id },
        data: {
          status: res.ok ? "delivered" : "failed",
          responseStatus: res.status,
          responseBody: text?.slice(0, 2000),
          deliveredAt: new Date(),
        },
      });

      this.logger.log(
        `Replayed webhook ${deliveryId} -> ${replayLog.id}: ${res.ok ? "delivered" : "failed"}`
      );

      return replayLog;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Replay failed";
      await this.prisma.webhookDelivery.update({
        where: { id: replayLog.id },
        data: { status: "failed", errorMessage: message },
      });
      throw err;
    }
  }

  /**
   * Retry a dead letter queue entry
   */
  async retryDeadLetter(deliveryId: string, campgroundId: string) {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, webhookEndpoint: { campgroundId } },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (delivery.status !== "dead_letter") {
      throw new NotFoundException("Delivery is not in dead letter queue");
    }

    // Reset to pending and retry
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "pending",
        attempt: 1,
        errorMessage: null,
        nextRetryAt: null,
      },
    });

    return this.replay(deliveryId, campgroundId);
  }

  /**
   * Purge old delivery logs
   */
  async purgeLogs(retentionDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.webhookDelivery.deleteMany({
      where: {
        status: { in: ["delivered", "failed"] },
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(
      `Purged ${result.count} webhook delivery logs older than ${retentionDays} days`
    );

    return result.count;
  }
}
