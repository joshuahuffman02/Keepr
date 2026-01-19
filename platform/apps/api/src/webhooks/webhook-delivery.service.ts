import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookSecurityService } from "./webhook-security.service";
import { WebhookEvent } from "./event-catalog";
import type { Prisma } from "@prisma/client";

/**
 * Retry configuration for webhook deliveries
 *
 * Uses exponential backoff: 1s, 10s, 60s
 * After 3 failed attempts, the delivery is moved to the dead letter queue
 */
const RETRY_DELAYS_MS = [
  1_000, // 1 second
  10_000, // 10 seconds
  60_000, // 60 seconds
];

const MAX_RETRIES = 3;
const DELIVERY_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Webhook delivery status
 */
export type DeliveryStatus =
  | "pending"
  | "delivered"
  | "failed"
  | "retrying"
  | "dead_letter";

export interface DeliveryResult {
  success: boolean;
  status: DeliveryStatus;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveredAt?: Date;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is Prisma.InputJsonValue => {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
};

const toJsonInput = (value: unknown): Prisma.InputJsonValue | undefined =>
  isJsonValue(value) ? value : undefined;

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: WebhookSecurityService
  ) {}

  /**
   * Emit a webhook event to all matching endpoints
   *
   * @param eventType - The type of event being emitted
   * @param campgroundId - The campground ID for tenant isolation
   * @param payload - The event payload data
   * @returns Array of delivery IDs created
   */
  async emit(
    eventType: WebhookEvent,
    campgroundId: string,
    payload: Record<string, unknown>
  ): Promise<string[]> {
    // Find all active endpoints that subscribe to this event type
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        campgroundId,
        isActive: true,
        OR: [
          { eventTypes: { has: eventType } },
          { eventTypes: { has: "*" } },
          // Support category wildcards (e.g., "reservation.*")
          {
            eventTypes: {
              has: `${eventType.split(".")[0]}.*`,
            },
          },
        ],
      },
    });

    if (!endpoints.length) {
      this.logger.debug(
        `No webhook endpoints found for event ${eventType} in campground ${campgroundId}`
      );
      return [];
    }

    const deliveryIds: string[] = [];

    // Create delivery records and attempt delivery for each endpoint
    for (const endpoint of endpoints) {
      const deliveryId = await this.createAndDeliver(endpoint, eventType, payload);
      deliveryIds.push(deliveryId);
    }

    return deliveryIds;
  }

  /**
   * Create a delivery record and attempt delivery
   */
  private async createAndDeliver(
    endpoint: {
      id: string;
      url: string;
      secret: string;
    },
    eventType: WebhookEvent,
    payload: Record<string, unknown>
  ): Promise<string> {
    const payloadValue = toJsonInput(payload);
    if (!payloadValue) {
      throw new BadRequestException("Webhook payload must be JSON-serializable");
    }

    const eventPayload: Prisma.InputJsonValue = {
      event: eventType,
      data: payloadValue,
      timestamp: new Date().toISOString(),
    };

    const body = JSON.stringify(eventPayload);
    const { signature, timestamp } = this.securityService.generateSignature(
      endpoint.secret,
      body
    );

    // Create delivery record
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        id: randomUUID(),
        webhookEndpointId: endpoint.id,
        eventType,
        status: "pending",
        payload: eventPayload,
        signature: `t=${timestamp},${signature}`,
        attempt: 1,
        nextRetryAt: null,
      },
    });

    // Attempt delivery asynchronously (don't block the caller)
    this.attemptDelivery(delivery.id, endpoint.url, endpoint.secret, body).catch(
      (err) => {
        this.logger.error(
          `Failed to deliver webhook ${delivery.id}: ${err.message}`
        );
      }
    );

    return delivery.id;
  }

  /**
   * Attempt to deliver a webhook
   */
  async attemptDelivery(
    deliveryId: string,
    url: string,
    secret: string,
    body: string
  ): Promise<DeliveryResult> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery ${deliveryId} not found`);
    }

    const attempt = delivery.attempt || 1;
    const { signature, timestamp } = this.securityService.generateSignature(
      secret,
      body
    );

    const headers = this.securityService.buildDeliveryHeaders(
      deliveryId,
      signature,
      timestamp,
      attempt
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    timeoutId.unref?.();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      const responseBody = await response.text();

      if (response.ok) {
        // Success - mark as delivered
        await this.prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "delivered",
            responseStatus: response.status,
            responseBody: responseBody.slice(0, 2000),
            deliveredAt: new Date(),
            nextRetryAt: null,
          },
        });

        this.logger.log(
          `Webhook ${deliveryId} delivered successfully to ${url}`
        );

        return {
          success: true,
          status: "delivered",
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 2000),
          deliveredAt: new Date(),
        };
      }

      // HTTP error - schedule retry or mark as failed
      return this.handleDeliveryFailure(
        deliveryId,
        response.status,
        responseBody.slice(0, 2000),
        attempt
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Webhook delivery failed";

      // Network error - schedule retry or mark as failed
      return this.handleDeliveryFailure(deliveryId, null, errorMessage, attempt);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle a failed delivery attempt
   */
  private async handleDeliveryFailure(
    deliveryId: string,
    responseStatus: number | null,
    errorMessage: string,
    attempt: number
  ): Promise<DeliveryResult> {
    if (attempt >= MAX_RETRIES) {
      // Move to dead letter queue
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

      return {
        success: false,
        status: "dead_letter",
        responseStatus: responseStatus || undefined,
        errorMessage,
      };
    }

    // Schedule retry with exponential backoff
    const delayMs = RETRY_DELAYS_MS[attempt - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
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
      `Webhook ${deliveryId} scheduled for retry ${attempt + 1} at ${nextRetryAt.toISOString()}`
    );

    return {
      success: false,
      status: "retrying",
      responseStatus: responseStatus || undefined,
      errorMessage,
    };
  }

  /**
   * Process pending retries (should be called by a cron job)
   *
   * @param batchSize - Maximum number of retries to process at once
   * @returns Number of retries processed
   */
  async processRetries(batchSize = 100): Promise<{ processed: number; succeeded: number; failed: number }> {
    const pendingRetries = await this.prisma.webhookDelivery.findMany({
      where: {
        status: "retrying",
        nextRetryAt: { lte: new Date() },
      },
      include: { WebhookEndpoint: true },
      take: batchSize,
    });

    let succeeded = 0;
    let failed = 0;

    for (const delivery of pendingRetries) {
      if (!delivery.WebhookEndpoint || !delivery.WebhookEndpoint.isActive) {
        // Endpoint disabled or deleted - move to dead letter
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "dead_letter",
            errorMessage: "Endpoint disabled or deleted",
            nextRetryAt: null,
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

      const result = await this.attemptDelivery(
        delivery.id,
        delivery.WebhookEndpoint.url,
        delivery.WebhookEndpoint.secret,
        body
      );

      if (result.success) {
        succeeded++;
      } else if (result.status === "dead_letter") {
        failed++;
      }
    }

    return {
      processed: pendingRetries.length,
      succeeded,
      failed,
    };
  }

  /**
   * Get dead letter queue entries for a campground
   */
  async getDeadLetterQueue(
    campgroundId: string,
    limit = 50
  ): Promise<
    Array<{
      id: string;
      eventType: string;
      payload: unknown;
      errorMessage: string | null;
      createdAt: Date;
      webhookEndpoint: { id: string; url: string };
    }>
  > {
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        status: "dead_letter",
        WebhookEndpoint: { campgroundId },
      },
      select: {
        id: true,
        eventType: true,
        payload: true,
        errorMessage: true,
        createdAt: true,
        WebhookEndpoint: {
          select: { id: true, url: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return deliveries.map(({ WebhookEndpoint, ...delivery }) => ({
      ...delivery,
      webhookEndpoint: WebhookEndpoint,
    }));
  }

  /**
   * Retry a dead letter queue entry
   */
  async retryDeadLetter(deliveryId: string): Promise<DeliveryResult> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { WebhookEndpoint: true },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery ${deliveryId} not found`);
    }

    if (delivery.status !== "dead_letter") {
      throw new NotFoundException(
        `Delivery ${deliveryId} is not in dead letter queue`
      );
    }

    if (!delivery.WebhookEndpoint || !delivery.WebhookEndpoint.isActive) {
      throw new NotFoundException("Webhook endpoint is disabled or deleted");
    }

    // Reset attempt counter for manual retry
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "pending",
        attempt: 1,
        errorMessage: null,
        nextRetryAt: null,
      },
    });

    const body = JSON.stringify({
      event: delivery.eventType,
      data: delivery.payload,
      timestamp: new Date().toISOString(),
    });

    return this.attemptDelivery(
      deliveryId,
      delivery.WebhookEndpoint.url,
      delivery.WebhookEndpoint.secret,
      body
    );
  }

  /**
   * Purge old dead letter entries
   *
   * @param retentionDays - Number of days to retain entries
   * @returns Number of entries purged
   */
  async purgeDeadLetterQueue(retentionDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.webhookDelivery.deleteMany({
      where: {
        status: "dead_letter",
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(
      `Purged ${result.count} dead letter entries older than ${retentionDays} days`
    );

    return result.count;
  }
}
