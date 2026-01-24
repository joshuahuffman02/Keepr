import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { LockCodesService } from "./lock-codes.service";
import { LockCodeType, LockCodeRotationSchedule } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards";
import { ScopeGuard } from "../auth/guards/scope.guard";

@UseGuards(JwtAuthGuard, ScopeGuard)
@Controller("campgrounds/:campgroundId/lock-codes")
export class LockCodesController {
  constructor(private readonly lockCodesService: LockCodesService) {}

  @Post()
  create(
    @Param("campgroundId") campgroundId: string,
    @Body()
    body: {
      name: string;
      code: string;
      type: LockCodeType;
      rotationSchedule?: LockCodeRotationSchedule;
      showOnConfirmation?: boolean;
      showAtCheckin?: boolean;
      appliesTo?: string[];
      notes?: string;
    },
  ) {
    return this.lockCodesService.create({
      campgroundId,
      ...body,
    });
  }

  @Get()
  findAllByCampground(@Param("campgroundId") campgroundId: string) {
    return this.lockCodesService.findAllByCampground(campgroundId);
  }

  @Get(":id")
  findOne(@Param("campgroundId") campgroundId: string, @Param("id") id: string) {
    return this.lockCodesService.findOne(id, campgroundId);
  }

  @Patch(":id")
  update(
    @Param("campgroundId") campgroundId: string,
    @Param("id") id: string,
    @Body()
    body: Partial<{
      name: string;
      code: string;
      type: LockCodeType;
      rotationSchedule: LockCodeRotationSchedule;
      showOnConfirmation: boolean;
      showAtCheckin: boolean;
      appliesTo: string[];
      isActive: boolean;
      notes: string;
    }>,
  ) {
    return this.lockCodesService.update(id, campgroundId, body);
  }

  @Delete(":id")
  remove(@Param("campgroundId") campgroundId: string, @Param("id") id: string) {
    return this.lockCodesService.remove(id, campgroundId);
  }

  @Post(":id/rotate")
  rotate(@Param("campgroundId") campgroundId: string, @Param("id") id: string) {
    return this.lockCodesService.rotate(id, campgroundId);
  }

  @Get("guest/confirmation")
  getConfirmationCodes(@Param("campgroundId") campgroundId: string) {
    return this.lockCodesService.getGuestVisibleCodes(campgroundId, "confirmation");
  }

  @Get("guest/checkin")
  getCheckinCodes(@Param("campgroundId") campgroundId: string) {
    return this.lockCodesService.getGuestVisibleCodes(campgroundId, "checkin");
  }
}
