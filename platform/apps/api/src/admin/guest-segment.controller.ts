import type { Request } from "express";
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { GuestSegmentService } from "./guest-segment.service";
import { JwtAuthGuard } from "../auth/guards";
import { SegmentScope, SegmentStatus } from "@prisma/client";

interface CreateSegmentBody {
  name: string;
  description?: string;
  scope: SegmentScope;
  criteria: SegmentCriteria[];
  isTemplate?: boolean;
  organizationId?: string;
  campgroundId?: string;
}

interface UpdateSegmentBody {
  name?: string;
  description?: string;
  criteria?: SegmentCriteria[];
  status?: SegmentStatus;
}

interface SegmentCriteria {
  type: string;
  operator: string;
  value: string | string[] | number | boolean;
}

type AuthRequest = Request & { user: { id: string; email: string } };

@Controller("admin/guest-segments")
@UseGuards(JwtAuthGuard)
export class GuestSegmentController {
  constructor(private readonly segmentService: GuestSegmentService) {}

  @Post()
  async create(@Body() body: CreateSegmentBody, @Req() req: AuthRequest) {
    return this.segmentService.create({
      ...body,
      createdById: req.user.id,
      createdByEmail: req.user.email,
    });
  }

  @Get()
  async findAll(
    @Query("scope") scope?: SegmentScope,
    @Query("status") status?: SegmentStatus,
    @Query("campgroundId") campgroundId?: string,
    @Query("organizationId") organizationId?: string,
    @Query("isTemplate") isTemplate?: string,
  ) {
    return this.segmentService.findAll({
      scope,
      status,
      campgroundId,
      organizationId,
      isTemplate: isTemplate === "true" ? true : isTemplate === "false" ? false : undefined,
    });
  }

  @Get("templates")
  async getTemplates() {
    return this.segmentService.getGlobalTemplates();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.segmentService.findOne(id);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: UpdateSegmentBody) {
    return this.segmentService.update(id, body);
  }

  @Delete(":id")
  async archive(@Param("id") id: string) {
    return this.segmentService.archive(id);
  }

  @Post(":id/duplicate")
  async duplicate(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.segmentService.duplicate(id, req.user.id, req.user.email);
  }

  @Get(":id/guests")
  async getGuests(
    @Param("id") id: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.segmentService.getSegmentGuests(id, {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Post(":id/calculate")
  async calculateGuestCount(@Param("id") id: string) {
    const count = await this.segmentService.calculateGuestCount(id);
    return { guestCount: count };
  }

  @Post("seed-templates")
  async seedTemplates() {
    await this.segmentService.seedGlobalTemplates();
    return { success: true, message: "Global templates seeded" };
  }
}
