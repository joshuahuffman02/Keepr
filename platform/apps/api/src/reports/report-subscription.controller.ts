import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { ReportSubscriptionService } from "./report-subscription.service";
import type { Request } from "express";
import type { ReportFrequency, ReportType } from "@prisma/client";
import {
  ReportFrequency as ReportFrequencyEnum,
  ReportType as ReportTypeEnum,
} from "@prisma/client";

class CreateSubscriptionDto {
  reportType!: string;
  frequency!: string;
  campgroundId?: string;
  deliveryTime?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

class UpdateSubscriptionDto {
  enabled?: boolean;
  frequency?: string;
  deliveryTime?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

@Controller("report-subscriptions")
@UseGuards(JwtAuthGuard)
export class ReportSubscriptionController {
  constructor(private readonly subscriptions: ReportSubscriptionService) {}

  @Get()
  async list(@Req() req: AuthRequest) {
    if (!req.user?.id) {
      throw new BadRequestException("User context is required");
    }
    return this.subscriptions.findByUser(req.user.id);
  }

  @Get("campground/:campgroundId")
  async listByCampground(@Param("campgroundId") campgroundId: string) {
    return this.subscriptions.findByCampground(campgroundId);
  }

  @Post()
  async create(@Body() dto: CreateSubscriptionDto, @Req() req: AuthRequest) {
    if (!isReportType(dto.reportType)) {
      throw new BadRequestException("Invalid report type");
    }
    if (!isReportFrequency(dto.frequency)) {
      throw new BadRequestException("Invalid frequency");
    }
    if (!req.user?.id || !req.user?.email) {
      throw new BadRequestException("User context is required");
    }
    return this.subscriptions.create({
      userId: req.user.id,
      userEmail: req.user.email,
      campgroundId: dto.campgroundId,
      reportType: dto.reportType,
      frequency: dto.frequency,
      deliveryTime: dto.deliveryTime,
      dayOfWeek: dto.dayOfWeek,
      dayOfMonth: dto.dayOfMonth,
    });
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateSubscriptionDto) {
    const payload: {
      enabled?: boolean;
      frequency?: ReportFrequency;
      deliveryTime?: string;
      dayOfWeek?: number;
      dayOfMonth?: number;
    } = {
      enabled: dto.enabled,
      deliveryTime: dto.deliveryTime,
      dayOfWeek: dto.dayOfWeek,
      dayOfMonth: dto.dayOfMonth,
    };
    if (dto.frequency !== undefined) {
      if (!isReportFrequency(dto.frequency)) {
        throw new BadRequestException("Invalid frequency");
      }
      payload.frequency = dto.frequency;
    }
    return this.subscriptions.update(id, payload);
  }

  @Delete(":id")
  async delete(@Param("id") id: string) {
    return this.subscriptions.delete(id);
  }
}

type AuthRequest = Request & { user?: { id?: string; email?: string } };

const REPORT_TYPES = new Set<string>(Object.values(ReportTypeEnum));
const REPORT_FREQUENCIES = new Set<string>(Object.values(ReportFrequencyEnum));

const isReportType = (value: unknown): value is ReportType =>
  typeof value === "string" && REPORT_TYPES.has(value);

const isReportFrequency = (value: unknown): value is ReportFrequency =>
  typeof value === "string" && REPORT_FREQUENCIES.has(value);
