import { Body, Controller, Get, Headers, Param, Patch, Post, RawBodyRequest, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards";
import { OtaService } from "./ota.service";
import { CreateOtaChannelDto } from "./dto/create-ota-channel.dto";
import { UpdateOtaChannelDto } from "./dto/update-ota-channel.dto";
import { UpsertOtaMappingDto } from "./dto/upsert-mapping.dto";
import { SaveOtaConfigDto } from "./dto/save-ota-config.dto";

@UseGuards(JwtAuthGuard)
@Controller("ota")
export class OtaController {
  constructor(private readonly ota: OtaService) {}

  @Get("campgrounds/:campgroundId/config")
  getConfig(@Param("campgroundId") campgroundId: string) {
    return this.ota.getConfig(campgroundId);
  }

  @Post("campgrounds/:campgroundId/config")
  saveConfig(@Param("campgroundId") campgroundId: string, @Body() body: SaveOtaConfigDto) {
    return this.ota.saveConfig(campgroundId, body);
  }

  @Get("campgrounds/:campgroundId/sync-status")
  getSyncStatus(@Param("campgroundId") campgroundId: string) {
    return this.ota.getSyncStatus(campgroundId);
  }

  @Get("campgrounds/:campgroundId/channels")
  listChannels(@Param("campgroundId") campgroundId: string) {
    return this.ota.listChannels(campgroundId);
  }

  @Post("campgrounds/:campgroundId/channels")
  createChannel(@Param("campgroundId") campgroundId: string, @Body() body: CreateOtaChannelDto) {
    return this.ota.createChannel(campgroundId, body);
  }

  @Patch("channels/:id")
  updateChannel(@Param("id") id: string, @Body() body: UpdateOtaChannelDto) {
    return this.ota.updateChannel(id, body);
  }

  @Get("channels/:id/mappings")
  listMappings(@Param("id") id: string) {
    return this.ota.listMappings(id);
  }

  @Post("channels/:id/mappings")
  upsertMapping(@Param("id") id: string, @Body() body: UpsertOtaMappingDto) {
    return this.ota.upsertMapping(id, body);
  }

  @Post("mappings/:id/ical/token")
  ensureIcalToken(@Param("id") id: string) {
    return this.ota.ensureIcalToken(id);
  }

  @Post("mappings/:id/ical/url")
  setIcalUrl(@Param("id") id: string, @Body() body: { url: string }) {
    return this.ota.setIcalUrl(id, body?.url || "");
  }

  @Post("mappings/:id/ical/import")
  importIcal(@Param("id") id: string) {
    return this.ota.importIcal(id);
  }

  @Get("channels/:id/logs")
  listLogs(@Param("id") id: string) {
    return (this.ota as any).listSyncLogs?.(id) ?? [];
  }

  @Post("channels/:id/push")
  pushAvailability(@Param("id") id: string) {
    return this.ota.pushAvailability(id);
  }

  @Get("channels/:id/imports")
  listImports(@Param("id") id: string) {
    return (this.ota as any).listImports?.(id) ?? [];
  }

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

  @Get("monitor")
  monitor() {
    return this.ota.monitor();
  }

  @Get("alerts")
  alerts() {
    return this.ota.alerts();
  }
}

