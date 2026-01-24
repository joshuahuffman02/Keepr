import { Controller, Post, Get, Param, Body, Query, UseGuards, Req } from "@nestjs/common";
import type { Request } from "express";
import { AnalyticsExportService } from "./analytics-export.service";
import { AnalyticsShareService } from "./analytics-share.service";
import { JwtAuthGuard } from "../auth/guards";
import { AnalyticsType, ExportFormat, ShareAccessLevel } from "@prisma/client";

class CreateExportDto {
  analyticsType!: AnalyticsType;
  format!: ExportFormat;
  dateRange?: string;
  campgroundId?: string;
  organizationId?: string;
  segmentId?: string;
  includePII?: boolean;
  emailTo?: string[];
}

class CreateShareDto {
  analyticsType!: AnalyticsType;
  accessLevel?: ShareAccessLevel;
  campgroundId?: string;
  organizationId?: string;
  segmentId?: string;
  dateRange?: string;
  name?: string;
  description?: string;
  password?: string;
  expiresIn?: number;
  maxViews?: number;
}

class UpdateShareDto {
  name?: string;
  description?: string;
  expiresAt?: Date | null;
  maxViews?: number | null;
  accessLevel?: ShareAccessLevel;
}

type AuthRequest = Request & { user: { id: string; email: string } };

@Controller("admin/analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsExportController {
  constructor(
    private readonly exportService: AnalyticsExportService,
    private readonly shareService: AnalyticsShareService,
  ) {}

  // ==================== EXPORTS ====================

  @Post("export")
  async createExport(@Body() dto: CreateExportDto, @Req() req: AuthRequest) {
    return this.exportService.createExport(dto, req.user.id, req.user.email);
  }

  @Get("exports")
  async listExports(@Req() req: AuthRequest, @Query("limit") limit?: number) {
    return this.exportService.listExports(req.user.id, limit);
  }

  @Get("exports/:id")
  async getExport(@Param("id") id: string) {
    return this.exportService.getExport(id);
  }

  @Get("exports/:id/download")
  async downloadExport(@Param("id") id: string) {
    return this.exportService.downloadExport(id);
  }

  // ==================== SHARING ====================

  @Post("share")
  async createShareLink(@Body() dto: CreateShareDto, @Req() req: AuthRequest) {
    return this.shareService.createShareLink(dto, req.user.id, req.user.email);
  }

  @Get("shares")
  async listShareLinks(@Req() req: AuthRequest, @Query("limit") limit?: number) {
    return this.shareService.listShareLinks(req.user.id, limit);
  }

  @Get("shares/:id")
  async getShareLink(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.shareService.getShareLink(id, req.user.id);
  }

  @Post("shares/:id/revoke")
  async revokeShareLink(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.shareService.revokeShareLink(id, req.user.id);
  }

  @Post("shares/:id")
  async updateShareLink(
    @Param("id") id: string,
    @Body() dto: UpdateShareDto,
    @Req() req: AuthRequest,
  ) {
    return this.shareService.updateShareLink(id, req.user.id, dto);
  }
}

// Public controller for accessing shared analytics (no auth required)
@Controller("shared/analytics")
export class SharedAnalyticsController {
  constructor(private readonly shareService: AnalyticsShareService) {}

  @Get(":token")
  async accessSharedAnalytics(@Param("token") token: string, @Query("password") password?: string) {
    return this.shareService.accessSharedAnalytics(token, password);
  }
}
