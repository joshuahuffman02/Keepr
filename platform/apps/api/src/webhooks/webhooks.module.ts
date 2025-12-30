import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookLogsService } from "./webhook-logs.service";
import { WebhookSecurityService } from "./webhook-security.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Webhooks Module
 *
 * Provides webhook 2.0 functionality including:
 * - HMAC-SHA256 signature generation and verification
 * - Exponential backoff retries (1s, 10s, 60s)
 * - Dead letter queue for persistent failures
 * - Event catalog with JSON schemas
 * - Delivery logging with 30-day retention
 * - Testing endpoints for webhook verification
 */
@Module({
  controllers: [WebhooksController],
  providers: [
    WebhookDeliveryService,
    WebhookLogsService,
    WebhookSecurityService,
    PrismaService,
  ],
  exports: [
    WebhookDeliveryService,
    WebhookLogsService,
    WebhookSecurityService,
  ],
})
export class WebhooksModule {}
