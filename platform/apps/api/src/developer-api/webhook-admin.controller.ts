import type { Request } from "express";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard, RolesGuard, ScopeGuard, Roles } from "../auth/guards";
import { UserRole } from "@prisma/client";
import { WebhookService } from "./webhook.service";
import { ApiUsageService } from "./api-usage.service";
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import {
  EventCatalogSummary,
  EventCatalog,
  getAllCategories,
  getEventDefinition,
  getEventExample,
  WebhookEvent,
} from "../webhooks/event-catalog";
import { WebhookSecurityService } from "../webhooks/webhook-security.service";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

type WebhookRequest = Request & { campgroundId?: string | null };

const isWebhookEvent = (value: string): value is WebhookEvent =>
  Object.prototype.hasOwnProperty.call(EventCatalog, value);

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

class CreateWebhookDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  eventTypes!: string[];
}

class ToggleWebhookDto {
  @IsBoolean()
  isActive!: boolean;
}

class TestWebhookDto {
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsOptional()
  customPayload?: Record<string, unknown>;
}

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Roles(UserRole.owner, UserRole.manager)
@Controller("developer/webhooks")
export class WebhookAdminController {
  private readonly securityService: WebhookSecurityService;

  constructor(
    private readonly webhookService: WebhookService,
    private readonly apiUsageService: ApiUsageService,
    private readonly prisma: PrismaService,
  ) {
    this.securityService = new WebhookSecurityService();
  }

  private requireCampgroundId(req: WebhookRequest, fallback?: string): string {
    const headerValue = req?.headers?.["x-campground-id"];
    const headerCampgroundId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const campgroundId = fallback || req?.campgroundId || headerCampgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  // ============================================
  // EVENT CATALOG (v2.0)
  // ============================================

  /**
   * Get complete event catalog with schemas and examples
   */
  @Get("event-catalog")
  getEventCatalog() {
    return {
      events: EventCatalog,
      categories: getAllCategories(),
      summary: EventCatalogSummary,
    };
  }

  /**
   * Get a specific event definition with schema
   */
  @Get("event-catalog/:eventType")
  getEventDefinition(@Param("eventType") eventType: string) {
    if (!isWebhookEvent(eventType)) {
      throw new NotFoundException(`Event type '${eventType}' not found`);
    }
    const definition = getEventDefinition(eventType);
    if (!definition) {
      throw new NotFoundException(`Event type '${eventType}' not found`);
    }
    return definition;
  }

  /**
   * Get list of all supported event types (legacy + v2)
   */
  @Get("event-types")
  getEventTypes() {
    return {
      eventTypes: EventCatalogSummary,
      categories: getAllCategories(),
    };
  }

  // ============================================
  // ENDPOINT MANAGEMENT
  // ============================================

  @Get()
  list(@Query("campgroundId") campgroundId: string, @Req() req: WebhookRequest) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.webhookService.listEndpoints(requiredCampgroundId);
  }

  @Post()
  create(@Body() body: CreateWebhookDto, @Req() req: WebhookRequest) {
    const requiredCampgroundId = this.requireCampgroundId(req, body.campgroundId);
    return this.webhookService.createEndpoint({ ...body, campgroundId: requiredCampgroundId });
  }

  @Patch(":id/toggle")
  toggle(
    @Param("id") id: string,
    @Body() body: ToggleWebhookDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: WebhookRequest,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.webhookService.toggleEndpoint(id, requiredCampgroundId, body.isActive);
  }

  // ============================================
  // DELIVERIES & LOGS
  // ============================================

  @Get("deliveries")
  listDeliveries(@Query("campgroundId") campgroundId: string, @Req() req: WebhookRequest) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.webhookService.listDeliveries(requiredCampgroundId);
  }

  @Post("deliveries/:id/replay")
  replay(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: WebhookRequest,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.webhookService.replay(id, requiredCampgroundId);
  }

  // ============================================
  // DEAD LETTER QUEUE (v2.0)
  // ============================================

  /**
   * Get dead letter queue entries
   */
  @Get("dead-letter")
  getDeadLetterQueue(
    @Query("campgroundId") campgroundId: string,
    @Req() req: WebhookRequest,
    @Query("limit") limit?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.webhookService.getDeadLetterQueue(
      requiredCampgroundId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * Retry a dead letter queue entry
   */
  @Post("dead-letter/:id/retry")
  retryDeadLetter(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: WebhookRequest,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.webhookService.retryDeadLetter(id, requiredCampgroundId);
  }

  // ============================================
  // TEST WEBHOOK (v2.0)
  // ============================================

  /**
   * Send a test webhook to an endpoint
   */
  @Post(":id/test")
  async testWebhook(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string,
    @Body() dto: TestWebhookDto,
    @Req() req: WebhookRequest,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    // Get the endpoint
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, campgroundId: requiredCampgroundId },
    });

    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    // Get example payload
    if (!isWebhookEvent(dto.eventType)) {
      throw new NotFoundException(`Event type '${dto.eventType}' not found`);
    }
    const eventType = dto.eventType;
    let payload = dto.customPayload;

    if (!payload) {
      const example = getEventExample(eventType);
      if (!example) {
        throw new NotFoundException(
          `No example payload available for event type '${dto.eventType}'`,
        );
      }
      payload = {
        ...example,
        _test: true,
        _testTimestamp: new Date().toISOString(),
      };
    }

    // Build the webhook payload
    const eventPayload = {
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
      _test: true,
    };
    const payloadJson = toJsonValue(eventPayload) ?? Prisma.JsonNull;

    const body = JSON.stringify(eventPayload);
    const timestamp = Date.now();
    const legacySignature = this.securityService.generateLegacySignature(
      endpoint.secret,
      body,
      timestamp,
    );
    const { signature: v2Signature, timestamp: v2Timestamp } =
      this.securityService.generateSignature(endpoint.secret, body);

    // Create a delivery record
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        id: randomUUID(),
        webhookEndpointId: endpoint.id,
        eventType,
        status: "pending",
        payload: payloadJson,
        signature: legacySignature,
        attempt: 1,
      },
    });

    // Attempt delivery
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    timeoutId.unref?.();

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Campreserv-Signature": legacySignature,
          "X-Campreserv-Timestamp": String(v2Timestamp),
          "X-Campreserv-Delivery-Id": delivery.id,
          "X-Campreserv-Attempt": "1",
          "User-Agent": "Campreserv-Webhooks/2.0",
        },
        body,
        signal: controller.signal,
      });

      const responseBody = await response.text();

      // Update delivery status
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: response.ok ? "delivered" : "failed",
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 2000),
          deliveredAt: new Date(),
        },
      });

      return {
        deliveryId: delivery.id,
        eventType,
        payload: eventPayload,
        result: {
          success: response.ok,
          status: response.ok ? "delivered" : "failed",
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 500),
        },
        headers: {
          "X-Campreserv-Signature": legacySignature,
          "X-Campreserv-Timestamp": String(v2Timestamp),
          "X-Campreserv-Delivery-Id": delivery.id,
          "X-Campreserv-Attempt": "1",
        },
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Test failed";

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "failed",
          errorMessage,
        },
      });

      return {
        deliveryId: delivery.id,
        eventType,
        payload: eventPayload,
        result: {
          success: false,
          status: "failed",
          errorMessage,
        },
        headers: {
          "X-Campreserv-Signature": legacySignature,
          "X-Campreserv-Timestamp": String(v2Timestamp),
          "X-Campreserv-Delivery-Id": delivery.id,
          "X-Campreserv-Attempt": "1",
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  @Get("stats")
  getStats(@Query("campgroundId") campgroundId: string, @Req() req: WebhookRequest) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.webhookService.getStats(requiredCampgroundId);
  }

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  @Post("process-retries")
  processRetries() {
    return this.webhookService.processRetries();
  }

  @Post("purge-logs")
  purgeLogs(@Query("retentionDays") retentionDays?: string) {
    const days = retentionDays ? parseInt(retentionDays, 10) : 30;
    return this.webhookService.purgeLogs(days);
  }

  // ============================================
  // API USAGE
  // ============================================

  @Get("api-usage")
  async getApiUsage(@Query("campgroundId") campgroundId: string, @Query("days") days?: string) {
    return this.apiUsageService.getPlatformStats(days ? parseInt(days, 10) : 30);
  }
}
