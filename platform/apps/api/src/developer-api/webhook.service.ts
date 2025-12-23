import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createHmac, randomBytes } from "crypto";

export type WebhookEvent =
  // Reservations
  | "reservation.created"
  | "reservation.updated"
  | "reservation.deleted"
  | "reservation.checked_in"
  | "reservation.checked_out"
  | "reservation.cancelled"
  // Payments
  | "payment.created"
  | "payment.refunded"
  | "payment.failed"
  // Guests
  | "guest.created"
  | "guest.updated"
  | "guest.deleted"
  // Sites
  | "site.created"
  | "site.updated"
  | "site.deleted"
  | "site.blocked"
  | "site.unblocked"
  // Events/Activities
  | "event.created"
  | "event.updated"
  | "event.deleted"
  | "event.registration"
  // Charity
  | "charity.donation"
  | "charity.payout"
  // Store/POS
  | "order.created"
  | "order.refunded"
  // Messaging
  | "message.received"
  | "message.sent"
  // Inventory & Expiration (3rd Party POS Integration)
  | "inventory.expiration.warning"
  | "inventory.expiration.critical"
  | "inventory.expiration.expired"
  | "inventory.batch.received"
  | "inventory.batch.depleted"
  | "inventory.low_stock"
  | "markdown.rule.applied"
  | "product.price.changed";

// Retry configuration
const RETRY_DELAYS_MS = [
  60_000,       // 1 minute
  300_000,      // 5 minutes
  1_800_000,    // 30 minutes
  7_200_000,    // 2 hours
  86_400_000,   // 24 hours
];
const MAX_RETRIES = 5;

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) { }

  private computeSignature(secret: string, payload: string, timestamp: number) {
    const toSign = `${timestamp}.${payload}`;
    const digest = createHmac("sha256", secret).update(toSign).digest("hex");
    return `t=${timestamp},v1=${digest}`;
  }

  async createEndpoint(input: { campgroundId: string; apiClientId?: string | null; url: string; description?: string; eventTypes: string[] }) {
    const secret = `wh_${randomBytes(16).toString("hex")}`;
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        campgroundId: input.campgroundId,
        apiClientId: input.apiClientId || null,
        url: input.url,
        description: input.description,
        eventTypes: input.eventTypes,
        secret
      }
    });
    return { endpoint, secret };
  }

  listEndpoints(campgroundId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" }
    });
  }

  async toggleEndpoint(id: string, isActive: boolean) {
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: { isActive, disabledAt: isActive ? null : new Date() }
    });
  }

  async emit(eventType: WebhookEvent, campgroundId: string, payload: Record<string, any>) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        campgroundId,
        isActive: true,
        OR: [{ eventTypes: { has: eventType } }, { eventTypes: { has: "*" } }]
      }
    });
    if (!endpoints.length) return;

    const body = JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() });

    for (const ep of endpoints) {
      const timestamp = Date.now();
      const signature = this.computeSignature(ep.secret, body, timestamp);
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookEndpointId: ep.id,
          eventType,
          status: "pending",
          payload,
          signature,
          attempt: 1,
          nextRetryAt: null
        }
      });

      await this.attemptDelivery(delivery.id, ep.url, ep.secret, body);
    }
  }

  private async attemptDelivery(deliveryId: string, url: string, secret: string, body: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) return;

    const timestamp = Date.now();
    const signature = this.computeSignature(secret, body, timestamp);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-campreserv-signature": signature,
          "x-campreserv-delivery-id": deliveryId,
          "x-campreserv-attempt": String(delivery.attempt || 1)
        },
        body,
        signal: controller.signal
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
            nextRetryAt: null
          }
        });
      } else {
        await this.scheduleRetry(deliveryId, res.status, text?.slice(0, 2000));
      }
    } catch (err: any) {
      await this.scheduleRetry(deliveryId, null, err?.message || "Webhook send failed");
    }
  }

  private async scheduleRetry(deliveryId: string, responseStatus: number | null, errorMessage: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) return;

    const attempt = delivery.attempt || 1;

    if (attempt >= MAX_RETRIES) {
      // Max retries reached, mark as permanently failed
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "failed",
          responseStatus,
          errorMessage,
          nextRetryAt: null
        }
      });
      return;
    }

    // Schedule next retry with exponential backoff
    const delayMs = RETRY_DELAYS_MS[attempt - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    const nextRetryAt = new Date(Date.now() + delayMs);

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "retrying",
        responseStatus,
        errorMessage,
        attempt: attempt + 1,
        nextRetryAt
      }
    });
  }

  // Process pending retries - call this from a cron job
  async processRetries() {
    const pendingRetries = await this.prisma.webhookDelivery.findMany({
      where: {
        status: "retrying",
        nextRetryAt: { lte: new Date() }
      },
      include: { webhookEndpoint: true },
      take: 100
    });

    for (const delivery of pendingRetries) {
      if (!delivery.webhookEndpoint || !delivery.webhookEndpoint.isActive) {
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "failed", errorMessage: "Endpoint disabled or deleted" }
        });
        continue;
      }

      const body = JSON.stringify({
        event: delivery.eventType,
        data: delivery.payload,
        timestamp: new Date().toISOString()
      });

      await this.attemptDelivery(
        delivery.id,
        delivery.webhookEndpoint.url,
        delivery.webhookEndpoint.secret,
        body
      );
    }

    return { processed: pendingRetries.length };
  }

  // Get webhook stats for a campground
  async getStats(campgroundId: string) {
    const [total, delivered, failed, retrying] = await Promise.all([
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { campgroundId } }
      }),
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { campgroundId }, status: "delivered" }
      }),
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { campgroundId }, status: "failed" }
      }),
      this.prisma.webhookDelivery.count({
        where: { webhookEndpoint: { campgroundId }, status: "retrying" }
      })
    ]);

    const successRate = total > 0 ? Math.round((delivered / total) * 100) : 100;

    return { total, delivered, failed, retrying, successRate };
  }

  listDeliveries(campgroundId: string, limit = 50) {
    return this.prisma.webhookDelivery.findMany({
      where: { webhookEndpoint: { campgroundId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { webhookEndpoint: true }
    });
  }

  async replay(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhookEndpoint: true }
    });
    if (!delivery || !delivery.webhookEndpoint) {
      throw new NotFoundException("Delivery not found");
    }

    const body = JSON.stringify({ event: delivery.eventType, data: delivery.payload });
    const timestamp = Date.now();
    const signature = this.computeSignature(delivery.webhookEndpoint.secret, body, timestamp);

    const replayLog = await this.prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: delivery.webhookEndpointId,
        eventType: delivery.eventType,
        payload: delivery.payload as any,
        signature,
        status: "pending",
        attempt: (delivery.attempt || 1) + 1,
        replayOfId: delivery.id
      }
    });

    try {
      const res = await fetch(delivery.webhookEndpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-campreserv-signature": signature
        },
        body
      });
      const text = await res.text();
      await this.prisma.webhookDelivery.update({
        where: { id: replayLog.id },
        data: {
          status: res.ok ? "delivered" : "failed",
          responseStatus: res.status,
          responseBody: text?.slice(0, 2000),
          deliveredAt: new Date()
        }
      });
      return replayLog;
    } catch (err: any) {
      await this.prisma.webhookDelivery.update({
        where: { id: replayLog.id },
        data: { status: "failed", errorMessage: err?.message || "Replay failed" }
      });
      throw err;
    }
  }
}

