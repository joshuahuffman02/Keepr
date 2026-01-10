import { Body, Controller, Get, Post, Patch, Delete, Param, Query, UseGuards, Headers, Req, Res } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { IntegrationsService } from "./integrations.service";
import { UpsertIntegrationConnectionDto } from "./dto/upsert-integration-connection.dto";
import { ListLogsDto } from "./dto/list-logs.dto";
import { SyncRequestDto } from "./dto/sync-request.dto";
import { CreateExportJobDto } from "./dto/create-export-job.dto";
import { RawBodyRequest } from "@nestjs/common";
import { Request, Response } from "express";

@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("connections")
  upsertConnection(@Body() body: UpsertIntegrationConnectionDto) {
    return this.integrations.upsertConnection(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Patch("connections/:id")
  updateConnection(@Param("id") id: string, @Body() body: Partial<UpsertIntegrationConnectionDto>) {
    return this.integrations.updateConnection(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Delete("connections/:id")
  deleteConnection(@Param("id") id: string) {
    return this.integrations.deleteConnection(id);
  }

  /**
   * Get OAuth authorization URL for a provider
   * Returns the URL the frontend should redirect/popup to
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("oauth/:provider/authorize")
  getOAuthUrl(
    @Param("provider") provider: string,
    @Query("campgroundId") campgroundId: string,
    @Query("redirectUri") redirectUri?: string
  ) {
    return this.integrations.getOAuthAuthorizationUrl(provider, campgroundId, redirectUri);
  }

  /**
   * OAuth callback handler - exchanges code for tokens
   */
  @Get("oauth/:provider/callback")
  async handleOAuthCallback(
    @Param("provider") provider: string,
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error?: string,
    @Res() res?: Response
  ) {
    const result = await this.integrations.handleOAuthCallback(provider, code, state, error);

    // Redirect back to the frontend with success/error
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectUrl = new URL(`${frontendUrl}/dashboard/settings/integrations`);

    if (result.success) {
      redirectUrl.searchParams.set("connected", provider);
      redirectUrl.searchParams.set("connectionId", result.connectionId || "");
    } else {
      redirectUrl.searchParams.set("error", result.error || "connection_failed");
      redirectUrl.searchParams.set("provider", provider);
    }

    return res?.redirect(redirectUrl.toString());
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.readonly)
  @Get("connections")
  listConnections(@Query("campgroundId") campgroundId: string) {
    return this.integrations.listConnections(campgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("connections/:id/sync")
  triggerSync(@Param("id") id: string, @Body() body: SyncRequestDto) {
    return this.integrations.triggerSync(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.readonly)
  @Get("connections/:id/logs")
  listLogs(@Param("id") id: string, @Query() query: ListLogsDto) {
    const limit = query.limit ?? 50;
    return this.integrations.listLogs(id, limit, query.cursor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance, UserRole.readonly)
  @Get("connections/:id/webhooks")
  listWebhooks(@Param("id") id: string, @Query() query: ListLogsDto) {
    const limit = query.limit ?? 50;
    return this.integrations.listWebhookEvents(id, limit, query.cursor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("exports")
  queueExport(@Body() body: CreateExportJobDto) {
    return this.integrations.createExportJob(body);
  }

  @Post("webhooks/:provider")
  webhook(
    @Param("provider") provider: string,
    @Body() body: any,
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-signature") signature?: string,
    @Headers("x-hmac-signature") altSignature?: string,
    @Headers("x-campground-id") campgroundId?: string
  ) {
    const raw = req.rawBody ? req.rawBody.toString() : JSON.stringify(body);
    const providedSignature = signature || altSignature || (req.headers["x-hub-signature"] as string | undefined);
    return this.integrations.handleWebhook(provider, body, raw, providedSignature, campgroundId as any);
  }
}

