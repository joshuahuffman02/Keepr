import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards";
import { RolesGuard, Roles } from "../../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { OtaSyncService } from "./ota-sync.service";
import { CreateChannelDto, UpdateChannelDto, UpsertMappingDto } from "./dto";

@Controller("campgrounds/:campgroundId/ota-channels")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OtaSyncController {
  constructor(private readonly otaSync: OtaSyncService) {}

  /**
   * List all OTA channels for a campground
   */
  @Get()
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async listChannels(@Param("campgroundId") campgroundId: string) {
    return this.otaSync.getChannels(campgroundId);
  }

  /**
   * Get a single OTA channel with mappings and sync history
   */
  @Get(":channelId")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getChannel(@Param("channelId") channelId: string) {
    return this.otaSync.getChannel(channelId);
  }

  /**
   * Create a new OTA channel
   */
  @Post()
  @Roles(UserRole.owner, UserRole.manager)
  async createChannel(@Param("campgroundId") campgroundId: string, @Body() body: CreateChannelDto) {
    return this.otaSync.createChannel({
      ...body,
      campgroundId,
    });
  }

  /**
   * Update OTA channel settings
   */
  @Patch(":channelId")
  @Roles(UserRole.owner, UserRole.manager)
  async updateChannel(@Param("channelId") channelId: string, @Body() body: UpdateChannelDto) {
    return this.otaSync.updateChannel(channelId, body);
  }

  /**
   * Add or update a listing mapping
   */
  @Post(":channelId/mappings")
  @Roles(UserRole.owner, UserRole.manager)
  async upsertMapping(
    @Param("channelId") channelId: string,
    @Body() body: Omit<UpsertMappingDto, "channelId">,
  ) {
    return this.otaSync.upsertMapping({
      ...body,
      channelId,
    });
  }

  /**
   * Trigger a sync for a channel
   */
  @Post(":channelId/sync")
  @Roles(UserRole.owner, UserRole.manager)
  async triggerSync(@Param("channelId") channelId: string) {
    return this.otaSync.triggerSync(channelId);
  }

  /**
   * Get sync logs for a channel
   */
  @Get(":channelId/logs")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getSyncLogs(@Param("channelId") channelId: string, @Query("limit") limit?: string) {
    return this.otaSync.getSyncLogs(channelId, limit ? parseInt(limit, 10) : 50);
  }

  /**
   * Get import history for a channel
   */
  @Get(":channelId/imports")
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  async getImports(@Param("channelId") channelId: string, @Query("limit") limit?: string) {
    return this.otaSync.getImports(channelId, limit ? parseInt(limit, 10) : 50);
  }
}
