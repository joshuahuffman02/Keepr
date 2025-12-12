import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { PushNotificationType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { PayrollService } from "./payroll.service";

@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(
    private readonly service: StaffService,
    private readonly payroll: PayrollService
  ) {}

  // ---- Shifts ----

  @Post('shifts')
  createShift(@Body() dto: any) {
    return this.service.createShift(dto);
  }

  @Get('shifts')
  listShifts(
    @Query('campgroundId') campgroundId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string
  ) {
    return this.service.listShifts(
      campgroundId,
      new Date(startDate),
      new Date(endDate),
      userId,
      status
    );
  }

  @Patch('shifts/:id')
  updateShift(@Param('id') id: string, @Body() dto: any) {
    return this.service.updateShift(id, dto);
  }

  @Delete('shifts/:id')
  deleteShift(@Param('id') id: string) {
    return this.service.deleteShift(id);
  }

  @Post('shifts/:id/clock-in')
  clockIn(
    @Param('id') id: string,
    @Body() body: { source?: "kiosk" | "mobile" | "web" | "manual"; note?: string }
  ) {
    return this.service.clockIn(id, body?.source, body?.note);
  }

  @Post('shifts/:id/clock-out')
  clockOut(@Param('id') id: string, @Body() body: { note?: string }) {
    return this.service.clockOut(id, body?.note);
  }

  @Post('shifts/:id/submit')
  submit(@Param('id') id: string) {
    return this.service.submitShift(id);
  }

  @Post('shifts/:id/approve')
  approve(@Param('id') id: string, @Body() body: { approverId: string; note?: string }) {
    return this.service.approveShift(id, body.approverId, body.note);
  }

  @Post('shifts/:id/reject')
  reject(@Param('id') id: string, @Body() body: { approverId: string; note?: string }) {
    return this.service.rejectShift(id, body.approverId, body.note);
  }

  // ---- Roles ----

  @Get('roles')
  listRoles(@Query('campgroundId') campgroundId: string) {
    return this.service.listRoles(campgroundId);
  }

  @Post('roles')
  upsertRole(
    @Body() body: { campgroundId: string; code: string; name: string; hourlyRate?: number; earningCode?: string; isActive?: boolean }
  ) {
    return this.service.upsertRole(body);
  }

  // ---- Overrides ----

  @Post('overrides')
  requestOverride(
    @Body() dto: {
      campgroundId: string;
      userId: string;
      type: "comp" | "void" | "discount";
      reason?: string;
      targetEntity?: string;
      targetId?: string;
      deltaAmount?: number;
      metadata?: any;
    }
  ) {
    return this.service.requestOverride(dto);
  }

  @Post('overrides/:id/decision')
  decideOverride(
    @Param('id') id: string,
    @Body() body: { approverId: string; status: "approved" | "rejected" | "cancelled"; note?: string }
  ) {
    return this.service.decideOverride(id, body.approverId, body.status, body.note);
  }

  @Get('overrides')
  listOverrides(
    @Query('campgroundId') campgroundId: string,
    @Query('status') status?: string
  ) {
    return this.service.listOverrides(campgroundId, status);
  }

  // ---- Payroll ----

  @Post('payroll/export')
  generateExport(
    @Body() dto: {
      campgroundId: string;
      periodStart: string;
      periodEnd: string;
      requestedById: string;
      provider?: "onpay" | "generic";
      format?: "csv" | "json";
    }
  ) {
    return this.payroll.generateExport({
      campgroundId: dto.campgroundId,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      requestedById: dto.requestedById,
      provider: dto.provider,
      format: dto.format
    });
  }

  // ---- Availability ----

  @Post('availability')
  setAvailability(@Body() dto: any) {
    return this.service.setAvailability(dto);
  }

  @Get('availability')
  getAvailability(
    @Query('campgroundId') campgroundId: string,
    @Query('userId') userId?: string
  ) {
    return this.service.getAvailability(campgroundId, userId);
  }

  // ---- Notifications ----

  @Post('notifications')
  sendNotification(
    @Body() dto: {
      campgroundId: string;
      userId: string | null;
      type: PushNotificationType;
      title: string;
      body: string;
      data?: any;
    }
  ) {
    return this.service.sendNotification(
      dto.campgroundId,
      dto.userId,
      dto.type,
      dto.title,
      dto.body,
      dto.data
    );
  }

  @Get('notifications/:userId')
  getNotifications(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string
  ) {
    return this.service.getNotifications(
      userId,
      limit ? parseInt(limit, 10) : undefined,
      unreadOnly === 'true'
    );
  }

  @Patch('notifications/:id/read')
  markNotificationRead(@Param('id') id: string) {
    return this.service.markNotificationRead(id);
  }

  @Post('notifications/:userId/read-all')
  markAllNotificationsRead(@Param('userId') userId: string) {
    return this.service.markAllNotificationsRead(userId);
  }

  // ---- Performance ----

  @Get('performance')
  getPerformance(
    @Query('campgroundId') campgroundId: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.service.getPerformance(
      campgroundId,
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  @Post('performance/calculate')
  calculatePerformance(
    @Body() dto: {
      campgroundId: string;
      userId: string;
      periodStart: string;
      periodEnd: string;
    }
  ) {
    return this.service.calculatePerformanceMetrics(
      dto.campgroundId,
      dto.userId,
      new Date(dto.periodStart),
      new Date(dto.periodEnd)
    );
  }
}

