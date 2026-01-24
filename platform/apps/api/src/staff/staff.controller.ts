import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  StaffService,
  type CreateShiftDto,
  type CreateAvailabilityDto,
  type OverrideRequestDto,
} from "./staff.service";
import { PushNotificationType } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards";
import { PayrollService } from "./payroll.service";

@Controller("staff")
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(
    private readonly service: StaffService,
    private readonly payroll: PayrollService,
  ) {}

  // ---- Shifts ----

  @Post("shifts")
  createShift(@Body() dto: CreateShiftDto) {
    return this.service.createShift(dto);
  }

  @Get("shifts")
  listShifts(
    @Query("campgroundId") campgroundId: string,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("userId") userId?: string,
    @Query("status") status?: string,
  ) {
    return this.service.listShifts(
      campgroundId,
      new Date(startDate),
      new Date(endDate),
      userId,
      status,
    );
  }

  @Patch("shifts/:id")
  updateShift(@Param("id") id: string, @Body() dto: Partial<CreateShiftDto>) {
    return this.service.updateShift(id, dto);
  }

  @Delete("shifts/:id")
  deleteShift(@Param("id") id: string) {
    return this.service.deleteShift(id);
  }

  @Post("shifts/:id/clock-in")
  clockIn(
    @Param("id") id: string,
    @Body() body: { source?: "kiosk" | "mobile" | "web" | "manual"; note?: string },
  ) {
    return this.service.clockIn(id, body?.source, body?.note);
  }

  @Post("shifts/:id/clock-out")
  clockOut(@Param("id") id: string, @Body() body: { note?: string }) {
    return this.service.clockOut(id, body?.note);
  }

  @Post("shifts/:id/submit")
  submit(@Param("id") id: string) {
    return this.service.submitShift(id);
  }

  @Post("shifts/:id/approve")
  approve(@Param("id") id: string, @Body() body: { approverId: string; note?: string }) {
    return this.service.approveShift(id, body.approverId, body.note);
  }

  @Post("shifts/:id/reject")
  reject(@Param("id") id: string, @Body() body: { approverId: string; note?: string }) {
    return this.service.rejectShift(id, body.approverId, body.note);
  }

  // ---- Roles ----

  @Get("roles")
  listRoles(@Query("campgroundId") campgroundId: string) {
    return this.service.listRoles(campgroundId);
  }

  @Post("roles")
  upsertRole(
    @Body()
    body: {
      campgroundId: string;
      code: string;
      name: string;
      hourlyRate?: number;
      earningCode?: string;
      isActive?: boolean;
    },
  ) {
    return this.service.upsertRole(body);
  }

  // ---- Overrides ----

  @Post("overrides")
  requestOverride(@Body() dto: OverrideRequestDto) {
    return this.service.requestOverride(dto);
  }

  @Post("overrides/:id/decision")
  decideOverride(
    @Param("id") id: string,
    @Body()
    body: { approverId: string; status: "approved" | "rejected" | "cancelled"; note?: string },
  ) {
    return this.service.decideOverride(id, body.approverId, body.status, body.note);
  }

  @Get("overrides")
  listOverrides(@Query("campgroundId") campgroundId: string, @Query("status") status?: string) {
    return this.service.listOverrides(campgroundId, status);
  }

  // ---- Payroll ----

  @Get("payroll/config")
  getPayrollConfig(@Query("campgroundId") campgroundId: string) {
    return this.payroll.getConfig(campgroundId);
  }

  @Post("payroll/config")
  updatePayrollConfig(
    @Body()
    dto: {
      campgroundId: string;
      provider: "onpay" | "generic" | "gusto" | "adp";
      companyId?: string;
    },
  ) {
    return this.payroll.updateConfig(dto);
  }

  @Get("payroll/exports")
  listPayrollExports(@Query("campgroundId") campgroundId: string, @Query("limit") limit?: string) {
    return this.payroll.listExports(campgroundId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get("payroll/exports/:id")
  getPayrollExport(@Param("id") id: string) {
    return this.payroll.getExport(id);
  }

  @Get("payroll/preview")
  previewPayroll(
    @Query("campgroundId") campgroundId: string,
    @Query("periodStart") periodStart: string,
    @Query("periodEnd") periodEnd: string,
    @Query("provider") provider?: "onpay" | "generic" | "gusto" | "adp",
  ) {
    return this.payroll.previewExport({
      campgroundId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      provider,
    });
  }

  @Post("payroll/export")
  generateExport(
    @Body()
    dto: {
      campgroundId: string;
      periodStart: string;
      periodEnd: string;
      requestedById: string;
      provider?: "onpay" | "generic" | "gusto" | "adp";
      format?: "csv" | "json";
    },
  ) {
    return this.payroll.generateExport({
      campgroundId: dto.campgroundId,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      requestedById: dto.requestedById,
      provider: dto.provider,
      format: dto.format,
    });
  }

  // ---- Availability ----

  @Post("availability")
  setAvailability(@Body() dto: CreateAvailabilityDto) {
    return this.service.setAvailability(dto);
  }

  @Get("availability")
  getAvailability(@Query("campgroundId") campgroundId: string, @Query("userId") userId?: string) {
    return this.service.getAvailability(campgroundId, userId);
  }

  // ---- Availability Overrides ----

  @Post("availability/override")
  setAvailabilityOverride(
    @Body()
    dto: {
      campgroundId: string;
      userId: string;
      date: string;
      isAvailable: boolean;
      startTime?: string;
      endTime?: string;
      reason?: string;
    },
  ) {
    return this.service.setAvailabilityOverride(dto);
  }

  @Delete("availability/override")
  deleteAvailabilityOverride(
    @Query("campgroundId") campgroundId: string,
    @Query("userId") userId: string,
    @Query("date") date: string,
  ) {
    return this.service.deleteAvailabilityOverride(campgroundId, userId, date);
  }

  @Get("availability/overrides")
  getAvailabilityOverrides(
    @Query("campgroundId") campgroundId: string,
    @Query("userId") userId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getAvailabilityOverrides(campgroundId, {
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // ---- Time Off ----

  @Post("time-off")
  createTimeOffRequest(
    @Body()
    dto: {
      campgroundId: string;
      userId: string;
      type: "vacation" | "sick" | "personal" | "bereavement" | "jury_duty" | "unpaid" | "other";
      startDate: string;
      endDate: string;
      hoursRequested?: number;
      reason?: string;
    },
  ) {
    return this.service.createTimeOffRequest(dto);
  }

  @Get("time-off")
  listTimeOffRequests(
    @Query("campgroundId") campgroundId: string,
    @Query("userId") userId?: string,
    @Query("status") status?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.listTimeOffRequests(campgroundId, {
      userId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Post("time-off/:id/review")
  reviewTimeOffRequest(
    @Param("id") id: string,
    @Body() body: { reviewerId: string; status: "approved" | "rejected"; note?: string },
  ) {
    return this.service.reviewTimeOffRequest(id, body.reviewerId, body.status, body.note);
  }

  @Post("time-off/:id/cancel")
  cancelTimeOffRequest(@Param("id") id: string, @Body() body: { userId: string }) {
    return this.service.cancelTimeOffRequest(id, body.userId);
  }

  // ---- Breaks ----

  @Post("time-entries/:id/breaks")
  startBreak(
    @Param("id") timeEntryId: string,
    @Body() body: { type: "paid" | "unpaid" | "meal" | "rest"; note?: string },
  ) {
    return this.service.startBreak(timeEntryId, body.type, body.note);
  }

  @Patch("breaks/:id/end")
  endBreak(@Param("id") breakId: string) {
    return this.service.endBreak(breakId);
  }

  @Get("time-entries/:id/breaks")
  getBreaks(@Param("id") timeEntryId: string) {
    return this.service.getBreaksForEntry(timeEntryId);
  }

  @Get("time-entries/:id/active-break")
  getActiveBreak(@Param("id") timeEntryId: string) {
    return this.service.getActiveBreak(timeEntryId);
  }

  // ---- Overtime Config ----

  @Get("overtime/config")
  getOvertimeConfig(@Query("campgroundId") campgroundId: string) {
    return this.service.getOvertimeConfig(campgroundId);
  }

  @Post("overtime/config")
  updateOvertimeConfig(
    @Body()
    dto: {
      campgroundId: string;
      weeklyThreshold?: number;
      dailyThreshold?: number | null;
      overtimeMultiplier?: number;
      doubleTimeThreshold?: number | null;
      doubleTimeMultiplier?: number | null;
      weekStartDay?: number;
    },
  ) {
    return this.service.updateOvertimeConfig(dto);
  }

  // ---- Notifications ----

  @Post("notifications")
  sendNotification(
    @Body()
    dto: {
      campgroundId: string;
      userId: string | null;
      type: PushNotificationType;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
  ) {
    return this.service.sendNotification(
      dto.campgroundId,
      dto.userId,
      dto.type,
      dto.title,
      dto.body,
      dto.data,
    );
  }

  @Get("notifications/:userId")
  getNotifications(
    @Param("userId") userId: string,
    @Query("limit") limit?: string,
    @Query("unreadOnly") unreadOnly?: string,
  ) {
    return this.service.getNotifications(
      userId,
      limit ? parseInt(limit, 10) : undefined,
      unreadOnly === "true",
    );
  }

  @Patch("notifications/:id/read")
  markNotificationRead(@Param("id") id: string) {
    return this.service.markNotificationRead(id);
  }

  @Post("notifications/:userId/read-all")
  markAllNotificationsRead(@Param("userId") userId: string) {
    return this.service.markAllNotificationsRead(userId);
  }

  // ---- Performance ----

  @Get("performance")
  getPerformance(
    @Query("campgroundId") campgroundId: string,
    @Query("userId") userId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.service.getPerformance(
      campgroundId,
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Post("performance/calculate")
  calculatePerformance(
    @Body() dto: { campgroundId: string; userId: string; periodStart: string; periodEnd: string },
  ) {
    return this.service.calculatePerformanceMetrics(
      dto.campgroundId,
      dto.userId,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
    );
  }

  // ---- Shift Swaps ----

  @Post("swaps")
  requestSwap(
    @Body()
    dto: {
      campgroundId: string;
      requesterShiftId: string;
      requesterId: string;
      recipientUserId: string;
      note?: string;
    },
  ) {
    return this.service.requestShiftSwap(dto);
  }

  @Get("swaps")
  listSwaps(
    @Query("campgroundId") campgroundId: string,
    @Query("userId") userId?: string,
    @Query("status") status?: string,
    @Query("role") role?: "requester" | "recipient" | "any",
  ) {
    return this.service.listSwapRequests(campgroundId, { userId, status, role });
  }

  @Post("swaps/:id/respond")
  respondToSwap(
    @Param("id") id: string,
    @Body() body: { recipientId: string; accept: boolean; note?: string },
  ) {
    return this.service.respondToSwapRequest(id, body.recipientId, body.accept, body.note);
  }

  @Post("swaps/:id/approve")
  approveSwap(
    @Param("id") id: string,
    @Body() body: { managerId: string; approve: boolean; note?: string },
  ) {
    return this.service.approveShiftSwap(id, body.managerId, body.approve, body.note);
  }

  @Post("swaps/:id/cancel")
  cancelSwap(@Param("id") id: string, @Body() body: { requesterId: string }) {
    return this.service.cancelSwapRequest(id, body.requesterId);
  }

  // ---- Schedule Templates ----

  @Get("templates")
  listTemplates(
    @Query("campgroundId") campgroundId: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.service.listScheduleTemplates(campgroundId, includeInactive === "true");
  }

  @Get("templates/:id")
  getTemplate(@Param("id") id: string) {
    return this.service.getScheduleTemplate(id);
  }

  @Post("templates")
  createTemplate(
    @Body()
    dto: {
      campgroundId: string;
      name: string;
      description?: string;
      createdById: string;
      shifts: Array<{
        dayOfWeek: number;
        roleCode?: string;
        startTime: string;
        endTime: string;
        userId?: string;
      }>;
    },
  ) {
    return this.service.createScheduleTemplate(dto);
  }

  @Patch("templates/:id")
  updateTemplate(
    @Param("id") id: string,
    @Body()
    dto: {
      name?: string;
      description?: string;
      isActive?: boolean;
      isRecurring?: boolean;
      recurringDay?: number | null;
      recurringWeeksAhead?: number | null;
      shifts?: Array<{
        dayOfWeek: number;
        roleCode?: string;
        startTime: string;
        endTime: string;
        userId?: string;
      }>;
    },
  ) {
    return this.service.updateScheduleTemplate(id, dto);
  }

  @Delete("templates/:id")
  deleteTemplate(@Param("id") id: string) {
    return this.service.deleteScheduleTemplate(id);
  }

  @Post("templates/:id/apply")
  applyTemplate(
    @Param("id") id: string,
    @Body() body: { weekStartDate: string; createdBy: string },
  ) {
    return this.service.applyScheduleTemplate(id, new Date(body.weekStartDate), body.createdBy);
  }

  @Post("templates/:id/recurring")
  setTemplateRecurring(
    @Param("id") id: string,
    @Body()
    body: {
      isRecurring: boolean;
      recurringDay?: number;
      recurringWeeksAhead?: number;
    },
  ) {
    return this.service.setTemplateRecurring(
      id,
      body.isRecurring,
      body.recurringDay,
      body.recurringWeeksAhead,
    );
  }

  @Post("templates/process-recurring")
  processRecurringTemplates() {
    return this.service.processRecurringTemplates();
  }

  @Post("schedule/copy-week")
  copyWeek(
    @Body()
    dto: {
      campgroundId: string;
      sourceWeekStart: string;
      targetWeekStart: string;
      createdBy: string;
    },
  ) {
    return this.service.copyWeekSchedule(
      dto.campgroundId,
      new Date(dto.sourceWeekStart),
      new Date(dto.targetWeekStart),
      dto.createdBy,
    );
  }

  // ---- Reports ----

  @Get("reports/timesheet")
  getTimesheetReport(
    @Query("campgroundId") campgroundId: string,
    @Query("periodStart") periodStart: string,
    @Query("periodEnd") periodEnd: string,
    @Query("userId") userId?: string,
    @Query("groupBy") groupBy?: "user" | "day" | "role",
  ) {
    return this.service.getTimesheetReport(
      campgroundId,
      new Date(periodStart),
      new Date(periodEnd),
      { userId, groupBy },
    );
  }
}
