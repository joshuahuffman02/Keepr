import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { AnnouncementStatus, PlatformRole } from "@prisma/client";
import { AnnouncementService } from "./announcement.service";
import type { Request } from "express";

class CreateAnnouncementDto {
  title!: string;
  message!: string;
  type?: "info" | "warning" | "success";
  target?: "all" | "admins" | "campground";
  campgroundId?: string;
  scheduledAt?: string;
}

class UpdateAnnouncementDto {
  title?: string;
  message?: string;
  type?: "info" | "warning" | "success";
  target?: "all" | "admins" | "campground";
  campgroundId?: string;
  scheduledAt?: string;
}

@Controller("admin/announcements")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin, PlatformRole.support_agent)
export class AnnouncementController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  async list(@Query("status") status?: string) {
    const parsedStatus =
      status === "draft" || status === "scheduled" || status === "sent" ? status : undefined;
    return this.announcements.findAll(parsedStatus);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.announcements.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateAnnouncementDto, @Req() req: Request) {
    return this.announcements.create({
      ...dto,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      createdById: req.user?.id || "unknown",
      createdByEmail: req.user?.email,
    });
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcements.update(id, {
      ...dto,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    });
  }

  @Patch(":id/send")
  async send(@Param("id") id: string) {
    return this.announcements.send(id);
  }

  @Delete(":id")
  async delete(@Param("id") id: string) {
    return this.announcements.delete(id);
  }
}
