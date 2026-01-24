import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "crypto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole, PlatformRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookLogsService } from "./webhook-logs.service";
import { WebhookSecurityService } from "./webhook-security.service";
import {
  EventCatalog,
  EventCatalogSummary,
  getAllCategories,
  getAllEventTypes,
  getEventDefinition,
  getEventExample,
  validateEventTypes,
  WebhookEvent,
} from "./event-catalog";
import { PrismaService } from "../prisma/prisma.service";
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsInt,
  Min,
  Max,
} from "class-validator";

// DTOs
class CreateWebhookEndpointDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  eventTypes!: string[];
}

class UpdateWebhookEndpointDto {
  @IsUrl()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  eventTypes?: string[];
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

class QueryLogsDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsString()
  @IsOptional()
  endpointId?: string;

  @IsString()
  @IsOptional()
  eventType?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  offset?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is Prisma.InputJsonValue => {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
};

const toJsonInput = (value: unknown): Prisma.InputJsonValue | undefined =>
  isJsonValue(value) ? value : undefined;

/**
 * Webhooks Controller
 *
 * Provides endpoints for managing webhook endpoints, viewing delivery logs,
 * testing webhooks, and accessing the event catalog.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryService: WebhookDeliveryService,
    private readonly logsService: WebhookLogsService,
    private readonly securityService: WebhookSecurityService,
  ) {}

  // ============================================
  // EVENT CATALOG ENDPOINTS
  // ============================================

  /**
   * Get the complete event catalog with schemas and examples
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
   * Get list of all event types (simple list for dropdowns)
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

  /**
   * List webhook endpoints for a campground
   */
  @Get("endpoints")
  @Roles(UserRole.owner, UserRole.manager)
  async listEndpoints(@Query("campgroundId") campgroundId: string) {
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        description: true,
        eventTypes: true,
        isActive: true,
        disabledAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { WebhookDelivery: true },
        },
      },
    });

    return endpoints;
  }

  /**
   * Get a single webhook endpoint
   */
  @Get("endpoints/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async getEndpoint(@Param("id") id: string, @Query("campgroundId") campgroundId: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, campgroundId },
      include: {
        _count: { select: { WebhookDelivery: true } },
      },
    });

    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    // Mask the secret
    return {
      ...endpoint,
      secret: `${endpoint.secret.slice(0, 7)}...`,
      secretPrefix: endpoint.secret.slice(0, 7),
    };
  }

  /**
   * Create a new webhook endpoint
   */
  @Post("endpoints")
  @Roles(UserRole.owner, UserRole.manager)
  async createEndpoint(@Body() dto: CreateWebhookEndpointDto) {
    // Validate event types
    const validation = validateEventTypes(dto.eventTypes);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid event types: ${validation.invalid.join(", ")}`);
    }

    // Generate secret
    const secret = `wh_${randomBytes(16).toString("hex")}`;

    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        url: dto.url,
        description: dto.description,
        eventTypes: dto.eventTypes,
        secret,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Created webhook endpoint ${endpoint.id} for campground ${dto.campgroundId}`);

    // Return full secret only on creation
    return {
      endpoint: {
        id: endpoint.id,
        url: endpoint.url,
        description: endpoint.description,
        eventTypes: endpoint.eventTypes,
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt,
      },
      secret, // Full secret - show only once
      message: "Save this secret securely. It will not be shown again.",
    };
  }

  /**
   * Update a webhook endpoint
   */
  @Patch("endpoints/:id")
  @Roles(UserRole.owner, UserRole.manager)
  async updateEndpoint(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ) {
    const existing = await this.prisma.webhookEndpoint.findFirst({
      where: { id, campgroundId },
    });

    if (!existing) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    // Validate event types if provided
    if (dto.eventTypes) {
      const validation = validateEventTypes(dto.eventTypes);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid event types: ${validation.invalid.join(", ")}`);
      }
    }

    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        url: dto.url,
        description: dto.description,
        eventTypes: dto.eventTypes,
      },
    });

    return updated;
  }

  /**
   * Toggle webhook endpoint active status
   */
  @Patch("endpoints/:id/toggle")
  @Roles(UserRole.owner, UserRole.manager)
  async toggleEndpoint(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string,
    @Body() dto: ToggleWebhookDto,
  ) {
    const existing = await this.prisma.webhookEndpoint.findFirst({
      where: { id, campgroundId },
    });

    if (!existing) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        isActive: dto.isActive,
        disabledAt: dto.isActive ? null : new Date(),
      },
    });

    this.logger.log(`Webhook endpoint ${id} ${dto.isActive ? "enabled" : "disabled"}`);

    return updated;
  }

  /**
   * Rotate webhook secret
   */
  @Post("endpoints/:id/rotate-secret")
  @Roles(UserRole.owner)
  async rotateSecret(@Param("id") id: string, @Query("campgroundId") campgroundId: string) {
    const existing = await this.prisma.webhookEndpoint.findFirst({
      where: { id, campgroundId },
    });

    if (!existing) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    const crypto = await import("crypto");
    const newSecret = `wh_${crypto.randomBytes(16).toString("hex")}`;

    await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { secret: newSecret },
    });

    this.logger.log(`Rotated secret for webhook endpoint ${id}`);

    return {
      secret: newSecret,
      message:
        "Save this secret securely. It will not be shown again. Update your webhook receiver immediately.",
    };
  }

  /**
   * Delete a webhook endpoint
   */
  @Delete("endpoints/:id")
  @Roles(UserRole.owner)
  async deleteEndpoint(@Param("id") id: string, @Query("campgroundId") campgroundId: string) {
    const existing = await this.prisma.webhookEndpoint.findFirst({
      where: { id, campgroundId },
    });

    if (!existing) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    await this.prisma.webhookEndpoint.delete({ where: { id } });

    this.logger.log(`Deleted webhook endpoint ${id}`);

    return { success: true, deleted: id };
  }

  // ============================================
  // TEST WEBHOOK
  // ============================================

  /**
   * Send a test webhook to an endpoint
   */
  @Post("endpoints/:id/test")
  @Roles(UserRole.owner, UserRole.manager)
  async testWebhook(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string,
    @Body() dto: TestWebhookDto,
  ) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, campgroundId },
    });

    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${id} not found`);
    }

    // Get example payload for the event type
    if (!isWebhookEvent(dto.eventType)) {
      throw new BadRequestException(`Invalid event type '${dto.eventType}'`);
    }
    const eventType = dto.eventType;
    let payload = dto.customPayload;

    if (!payload) {
      const example = getEventExample(eventType);
      if (!example) {
        throw new BadRequestException(
          `No example payload available for event type '${dto.eventType}'`,
        );
      }
      payload = {
        ...example,
        _test: true,
        _testTimestamp: new Date().toISOString(),
      };
    }

    const payloadValue = toJsonInput(payload);
    if (!payloadValue) {
      throw new BadRequestException("Payload must be JSON-serializable");
    }

    // Create a test delivery
    const eventPayload: Prisma.InputJsonValue = {
      event: eventType,
      data: payloadValue,
      timestamp: new Date().toISOString(),
      _test: true,
    };

    const body = JSON.stringify(eventPayload);
    const { signature, timestamp } = this.securityService.generateSignature(endpoint.secret, body);

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
      },
    });

    // Attempt delivery
    const result = await this.deliveryService.attemptDelivery(
      delivery.id,
      endpoint.url,
      endpoint.secret,
      body,
    );

    return {
      deliveryId: delivery.id,
      eventType,
      payload: eventPayload,
      result: {
        success: result.success,
        status: result.status,
        responseStatus: result.responseStatus,
        responseBody: result.responseBody?.slice(0, 500),
        errorMessage: result.errorMessage,
      },
      headers: {
        "X-Campreserv-Signature": signature,
        "X-Campreserv-Timestamp": String(timestamp),
        "X-Campreserv-Delivery-Id": delivery.id,
        "X-Campreserv-Attempt": "1",
      },
    };
  }

  // ============================================
  // DELIVERY LOGS
  // ============================================

  /**
   * Query webhook delivery logs
   */
  @Get("logs")
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  async queryLogs(@Query() query: QueryLogsDto) {
    if (!query.campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    return this.logsService.queryLogs({
      campgroundId: query.campgroundId,
      endpointId: query.endpointId,
      eventType: query.eventType,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });
  }

  /**
   * Get a specific delivery log entry
   */
  @Get("logs/:id")
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  async getLogEntry(@Param("id") id: string, @Query("campgroundId") campgroundId: string) {
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    const entry = await this.logsService.getLogEntry(id, campgroundId);
    if (!entry) {
      throw new NotFoundException(`Delivery log ${id} not found`);
    }

    return entry;
  }

  /**
   * Replay a failed delivery
   */
  @Post("logs/:id/replay")
  @Roles(UserRole.owner, UserRole.manager)
  async replayDelivery(@Param("id") id: string, @Query("campgroundId") campgroundId: string) {
    // Verify the delivery belongs to this campground
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { id, WebhookEndpoint: { campgroundId } },
      include: { WebhookEndpoint: true },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery ${id} not found`);
    }

    if (!delivery.WebhookEndpoint) {
      throw new NotFoundException("Webhook endpoint not found");
    }

    // Create new delivery for replay
    const body = JSON.stringify({
      event: delivery.eventType,
      data: delivery.payload,
      timestamp: new Date().toISOString(),
    });

    const result = await this.deliveryService.attemptDelivery(
      delivery.id,
      delivery.WebhookEndpoint.url,
      delivery.WebhookEndpoint.secret,
      body,
    );

    return {
      deliveryId: delivery.id,
      result,
    };
  }

  // ============================================
  // DEAD LETTER QUEUE
  // ============================================

  /**
   * Get dead letter queue entries
   */
  @Get("dead-letter")
  @Roles(UserRole.owner, UserRole.manager)
  async getDeadLetterQueue(
    @Query("campgroundId") campgroundId: string,
    @Query("limit") limit?: string,
  ) {
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    return this.deliveryService.getDeadLetterQueue(campgroundId, limit ? parseInt(limit, 10) : 50);
  }

  /**
   * Retry a dead letter queue entry
   */
  @Post("dead-letter/:id/retry")
  @Roles(UserRole.owner, UserRole.manager)
  async retryDeadLetter(@Param("id") id: string, @Query("campgroundId") campgroundId: string) {
    // Verify ownership
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { id, WebhookEndpoint: { campgroundId }, status: "dead_letter" },
    });

    if (!delivery) {
      throw new NotFoundException(
        `Dead letter entry ${id} not found in campground ${campgroundId}`,
      );
    }

    return this.deliveryService.retryDeadLetter(id);
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get webhook delivery statistics
   */
  @Get("stats")
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  async getStats(@Query("campgroundId") campgroundId: string, @Query("days") days?: string) {
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    const daysNum = days ? parseInt(days, 10) : 30;

    const [overall, byEventType, byEndpoint, recentFailures] = await Promise.all([
      this.logsService.getStats(campgroundId, daysNum),
      this.logsService.getStatsByEventType(campgroundId, daysNum),
      this.logsService.getStatsByEndpoint(campgroundId, daysNum),
      this.logsService.getRecentFailures(campgroundId, 60),
    ]);

    return {
      overall,
      byEventType,
      byEndpoint,
      recentFailures,
      period: `Last ${daysNum} days`,
    };
  }

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  /**
   * Process pending retries (for cron/scheduler)
   */
  @Post("process-retries")
  @Roles(PlatformRole.platform_admin)
  async processRetries() {
    return this.deliveryService.processRetries();
  }

  /**
   * Purge old delivery logs
   */
  @Post("purge-logs")
  @Roles(PlatformRole.platform_admin)
  async purgeLogs(@Query("retentionDays") retentionDays?: string) {
    const days = retentionDays ? parseInt(retentionDays, 10) : 30;
    return this.logsService.purgeLogs(days);
  }

  /**
   * Purge dead letter queue
   */
  @Post("purge-dead-letter")
  @Roles(PlatformRole.platform_admin)
  async purgeDeadLetter(@Query("retentionDays") retentionDays?: string) {
    const days = retentionDays ? parseInt(retentionDays, 10) : 30;
    return this.deliveryService.purgeDeadLetterQueue(days);
  }
}

const WEBHOOK_EVENTS = new Set<string>(getAllEventTypes());

const isWebhookEvent = (value: string): value is WebhookEvent => WEBHOOK_EVENTS.has(value);
