import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, RawBodyRequest, Req, UseGuards, Query } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { ScopeGuard } from "../permissions/scope.guard";
import { UserRole } from "@prisma/client";
import { OtaService } from "./ota.service";
import { CreateOtaChannelDto } from "./dto/create-ota-channel.dto";
import { UpdateOtaChannelDto } from "./dto/update-ota-channel.dto";
import { UpsertOtaMappingDto } from "./dto/upsert-mapping.dto";
import { SaveOtaConfigDto } from "./dto/save-ota-config.dto";

@Controller("ota")
export class OtaController {
  constructor(private readonly ota: OtaService) {}

  private requireCampgroundId(req: any, fallback?: string): string {
    const campgroundId = fallback || req?.campgroundId || req?.headers?.["x-campground-id"];
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("campgrounds/:campgroundId/config")
  @Roles(UserRole.owner, UserRole.manager)
  getConfig(@Param("campgroundId") campgroundId: string) {
    return this.ota.getConfig(campgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("campgrounds/:campgroundId/config")
  @Roles(UserRole.owner, UserRole.manager)
  saveConfig(@Param("campgroundId") campgroundId: string, @Body() body: SaveOtaConfigDto) {
    return this.ota.saveConfig(campgroundId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("campgrounds/:campgroundId/sync-status")
  @Roles(UserRole.owner, UserRole.manager)
  getSyncStatus(@Param("campgroundId") campgroundId: string) {
    return this.ota.getSyncStatus(campgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("campgrounds/:campgroundId/channels")
  @Roles(UserRole.owner, UserRole.manager)
  listChannels(@Param("campgroundId") campgroundId: string) {
    return this.ota.listChannels(campgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("campgrounds/:campgroundId/channels")
  @Roles(UserRole.owner, UserRole.manager)
  createChannel(@Param("campgroundId") campgroundId: string, @Body() body: CreateOtaChannelDto) {
    return this.ota.createChannel(campgroundId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Patch("channels/:id")
  @Roles(UserRole.owner, UserRole.manager)
  updateChannel(
    @Param("id") id: string,
    @Body() body: UpdateOtaChannelDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.ota.updateChannel(id, requiredCampgroundId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("channels/:id/mappings")
  @Roles(UserRole.owner, UserRole.manager)
  listMappings(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.ota.listMappings(id, requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("channels/:id/mappings")
  @Roles(UserRole.owner, UserRole.manager)
  upsertMapping(
    @Param("id") id: string,
    @Body() body: UpsertOtaMappingDto,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.ota.upsertMapping(id, requiredCampgroundId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("mappings/:id/ical/token")
  @Roles(UserRole.owner, UserRole.manager)
  ensureIcalToken(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.ota.ensureIcalToken(id, requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("mappings/:id/ical/rotate")
  @Roles(UserRole.owner, UserRole.manager)
  rotateIcalToken(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.ota.rotateIcalToken(id, requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("mappings/:id/ical/url")
  @Roles(UserRole.owner, UserRole.manager)
  setIcalUrl(
    @Param("id") id: string,
    @Body() body: { url: string },
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.ota.setIcalUrl(id, requiredCampgroundId, body?.url || "");
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("mappings/:id/ical/import")
  @Roles(UserRole.owner, UserRole.manager)
  importIcal(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.ota.importIcal(id, requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("channels/:id/logs")
  @Roles(UserRole.owner, UserRole.manager)
  listLogs(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return (this.ota as any).listSyncLogs?.(id, requiredCampgroundId) ?? [];
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Post("channels/:id/push")
  @Roles(UserRole.owner, UserRole.manager)
  pushAvailability(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return this.ota.pushAvailability(id, requiredCampgroundId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("channels/:id/imports")
  @Roles(UserRole.owner, UserRole.manager)
  listImports(
    @Param("id") id: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    return (this.ota as any).listImports?.(id, requiredCampgroundId) ?? [];
  }

  // Webhook endpoint - no auth (called by external OTA providers)
  @Post("webhooks/:provider")
  webhook(
    @Param("provider") provider: string,
    @Body() body: any,
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-ota-signature") signature?: string,
    @Headers("x-ota-timestamp") timestamp?: string,
  ) {
    const raw = (req as any).rawBody ? (req as any).rawBody.toString() : JSON.stringify(body);
    return this.ota.handleWebhook(provider, body, raw, signature, timestamp);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("monitor")
  @Roles(UserRole.owner, UserRole.manager)
  monitor() {
    return this.ota.monitor();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Get("alerts")
  @Roles(UserRole.owner, UserRole.manager)
  alerts() {
    return this.ota.alerts();
  }
}
