import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  Headers,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Response } from "express";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole } from "@prisma/client";
import { IntegrationRegistryService } from "./integration-registry.service";
import { IntegrationFrameworkService } from "./framework/integration-framework.service";

type RawBodyRequest = Request & { rawBody?: Buffer | string };

/**
 * Marketplace Controller
 *
 * Provides endpoints for the integration marketplace:
 * - Browse available integrations
 * - Connect/disconnect integrations
 * - Manage connection settings
 * - Trigger syncs
 */
@Controller("integrations")
export class MarketplaceController {
  constructor(
    private readonly registry: IntegrationRegistryService,
    private readonly framework: IntegrationFrameworkService,
  ) {}

  // ========================================
  // Public Marketplace Endpoints
  // ========================================

  /**
   * List all integration categories
   */
  @Get("marketplace/categories")
  getCategories() {
    return this.registry.getCategories();
  }

  /**
   * List all available integrations in the marketplace
   */
  @Get("marketplace")
  async listIntegrations(
    @Query("category") category?: string,
    @Query("activeOnly") activeOnly?: string,
  ) {
    return this.registry.listIntegrations({
      category,
      activeOnly: activeOnly !== "false",
    });
  }

  /**
   * Get details for a specific integration
   */
  @Get("marketplace/:slug")
  async getIntegration(@Param("slug") slug: string) {
    const integration = await this.registry.getIntegration(slug);
    if (!integration) {
      throw new NotFoundException(`Integration ${slug} not found`);
    }

    // Add provider capabilities if available
    const capabilities = this.registry.getProviderCapabilities(slug);

    return {
      ...integration,
      providerAvailable: this.registry.isProviderAvailable(slug),
      capabilities,
    };
  }

  // ========================================
  // Authenticated Endpoints
  // ========================================

  /**
   * List integrations with connection status for a campground
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/marketplace")
  async listIntegrationsWithStatus(
    @Param("campgroundId") campgroundId: string,
    @Query("category") category?: string,
  ) {
    return this.registry.listIntegrationsWithStatus(campgroundId, { category });
  }

  /**
   * Get all connections for a campground
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/connections")
  async getConnections(@Param("campgroundId") campgroundId: string) {
    return this.registry.getConnections(campgroundId);
  }

  /**
   * Start OAuth flow for an integration
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Get("campgrounds/:campgroundId/connect/:slug/oauth")
  async initiateOAuth(
    @Param("campgroundId") campgroundId: string,
    @Param("slug") slug: string,
    @Query("redirectUri") redirectUri?: string,
  ) {
    const integration = await this.registry.getIntegration(slug);
    if (!integration) {
      throw new NotFoundException(`Integration ${slug} not found`);
    }

    if (integration.authType !== "oauth2") {
      throw new BadRequestException(`Integration ${slug} does not use OAuth`);
    }

    const defaultRedirectUri = process.env.API_BASE_URL
      ? `${process.env.API_BASE_URL}/integrations/oauth/${slug}/callback`
      : `http://localhost:4000/integrations/oauth/${slug}/callback`;

    return this.framework.initiateOAuth(campgroundId, slug, redirectUri || defaultRedirectUri);
  }

  /**
   * OAuth callback handler
   */
  @Get("oauth/:slug/callback")
  async handleOAuthCallback(
    @Param("slug") slug: string,
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error?: string,
    @Query("error_description") errorDescription?: string,
    @Res() res?: Response,
  ) {
    if (error) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res?.redirect(
        `${frontendUrl}/dashboard/settings/integrations?error=${error}&provider=${slug}`,
      );
    }

    const defaultRedirectUri = process.env.API_BASE_URL
      ? `${process.env.API_BASE_URL}/integrations/oauth/${slug}/callback`
      : `http://localhost:4000/integrations/oauth/${slug}/callback`;

    const result = await this.framework.handleOAuthCallback(slug, code, state, defaultRedirectUri);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectUrl = new URL(`${frontendUrl}/dashboard/settings/integrations`);

    if (result.success) {
      redirectUrl.searchParams.set("connected", slug);
      if (result.connectionId) {
        redirectUrl.searchParams.set("connectionId", result.connectionId);
      }
    } else {
      redirectUrl.searchParams.set("error", result.error || "connection_failed");
      redirectUrl.searchParams.set("provider", slug);
    }

    return res?.redirect(redirectUrl.toString());
  }

  /**
   * Connect an integration with API key or other credentials
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post("campgrounds/:campgroundId/connect/:slug")
  async connect(
    @Param("campgroundId") campgroundId: string,
    @Param("slug") slug: string,
    @Body() body: { apiKey?: string; apiSecret?: string; config?: Record<string, unknown> },
  ) {
    const integration = await this.registry.getIntegration(slug);
    if (!integration) {
      throw new NotFoundException(`Integration ${slug} not found`);
    }

    if (integration.authType === "oauth2") {
      throw new BadRequestException(
        `Integration ${slug} requires OAuth. Use the OAuth flow instead.`,
      );
    }

    if (integration.authType === "api_key" && !body.apiKey) {
      throw new BadRequestException("API key is required");
    }

    return this.framework.connect(
      campgroundId,
      slug,
      {
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
      },
      body.config,
    );
  }

  /**
   * Disconnect an integration
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Delete("campgrounds/:campgroundId/disconnect/:slug")
  async disconnect(@Param("campgroundId") campgroundId: string, @Param("slug") slug: string) {
    return this.framework.disconnect(campgroundId, slug);
  }

  /**
   * Trigger a manual sync for an integration
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("connections/:connectionId/sync")
  async triggerSync(
    @Param("connectionId") connectionId: string,
    @Body()
    body: {
      syncType?: "full" | "incremental";
      direction?: "inbound" | "outbound" | "bidirectional";
      entityTypes?: string[];
    },
  ) {
    return this.framework.triggerSync(connectionId, body);
  }

  /**
   * Test a connection
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("connections/:connectionId/test")
  async testConnection(@Param("connectionId") connectionId: string) {
    return this.framework.testConnection(connectionId);
  }

  /**
   * Get sync logs for a connection
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("connections/:connectionId/logs")
  async getSyncLogs(
    @Param("connectionId") connectionId: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.registry.getSyncLogs(connectionId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  /**
   * Get connection status
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/status/:slug")
  async getConnectionStatus(
    @Param("campgroundId") campgroundId: string,
    @Param("slug") slug: string,
  ) {
    return this.framework.getConnectionStatus(campgroundId, slug);
  }

  // ========================================
  // Webhook Endpoints (No Auth - verified by signature)
  // ========================================

  /**
   * Handle incoming webhook from integration provider
   */
  @Post("webhooks/:slug")
  async handleWebhook(
    @Param("slug") slug: string,
    @Body() body: unknown,
    @Req() req: RawBodyRequest,
    @Headers("x-signature") signature?: string,
    @Headers("x-hub-signature") hubSignature?: string,
    @Headers("x-hmac-signature") hmacSignature?: string,
    @Headers("x-campground-id") campgroundId?: string,
  ) {
    const rawBodyValue = req.rawBody;
    const rawBody =
      rawBodyValue === undefined
        ? JSON.stringify(body)
        : typeof rawBodyValue === "string"
          ? rawBodyValue
          : rawBodyValue.toString();

    const providedSignature = signature || hubSignature || hmacSignature;

    return this.framework.handleWebhook(slug, body, rawBody, providedSignature, campgroundId);
  }
}
