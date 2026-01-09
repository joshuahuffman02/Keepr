import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationType } from '@prisma/client';
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { minutesBetween } from "./payroll.service";

interface CreateShiftDto {
  campgroundId: string;
  userId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role?: string;
  notes?: string;
  createdBy?: string;
}

interface CreateAvailabilityDto {
  campgroundId: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
}

interface OverrideRequestDto {
  campgroundId: string;
  userId: string;
  type: "comp" | "void" | "discount";
  reason?: string;
  targetEntity?: string;
  targetId?: string;
  deltaAmount?: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly emailService: EmailService
  ) {}
  private readonly logger = new Logger(StaffService.name);

  private calculateTotalMinutes(entries: { clockInAt: Date; clockOutAt?: Date | null }[]) {
    return entries.reduce((sum, entry) => sum + minutesBetween(entry), 0);
  }

  // ---- Shifts ----

  async createShift(dto: CreateShiftDto) {
    const start = new Date(`${dto.shiftDate}T${dto.startTime}`);
    const end = new Date(`${dto.shiftDate}T${dto.endTime}`);
    const scheduledMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

    return this.prisma.staffShift.create({
      data: {
        campgroundId: dto.campgroundId,
        userId: dto.userId,
        shiftDate: new Date(dto.shiftDate),
        startTime: start,
        endTime: end,
        scheduledMinutes,
        role: dto.role,
        notes: dto.notes,
        createdBy: dto.createdBy,
      },
    });
  }

  async listShifts(
    campgroundId: string,
    startDate: Date,
    endDate: Date,
    userId?: string,
    status?: string
  ) {
    return this.prisma.staffShift.findMany({
      where: {
        campgroundId,
        shiftDate: { gte: startDate, lte: endDate },
        ...(userId ? { userId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }],
    });
  }

  async updateShift(id: string, dto: Partial<CreateShiftDto>) {
    const existing = await this.prisma.staffShift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Shift not found');

    const newStart = dto.startTime
      ? new Date(`${dto.shiftDate || existing.shiftDate.toISOString().split('T')[0]}T${dto.startTime}`)
      : undefined;
    const newEnd = dto.endTime
      ? new Date(`${dto.shiftDate || existing.shiftDate.toISOString().split('T')[0]}T${dto.endTime}`)
      : undefined;

    return this.prisma.staffShift.update({
      where: { id },
      data: {
        startTime: newStart,
        endTime: newEnd,
        scheduledMinutes:
          newStart && newEnd
            ? Math.max(0, Math.round((newEnd.getTime() - newStart.getTime()) / 60000))
            : undefined,
        role: dto.role,
        notes: dto.notes,
      },
    });
  }

  async deleteShift(id: string) {
    return this.prisma.staffShift.delete({ where: { id } });
  }

  async clockIn(shiftId: string, source: "kiosk" | "mobile" | "web" | "manual" = "web", note?: string) {
    const shift = await this.prisma.staffShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException("Shift not found");

    const now = new Date();
    const entry = await (this.prisma as any).staffTimeEntry.create({
      data: {
        shiftId,
        campgroundId: shift.campgroundId,
        userId: shift.userId,
        clockInAt: now,
        source,
        note,
        status: "open"
      }
    });

    const updatedShift = await this.prisma.staffShift.update({
      where: { id: shiftId },
      data: {
        clockedInAt: shift.clockedInAt ?? now,
        status: "in_progress"
      }
    });

    return { shift: updatedShift, entry };
  }

  async clockOut(shiftId: string, note?: string) {
    const shift = await this.prisma.staffShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException("Shift not found");

    const openEntry = await (this.prisma as any).staffTimeEntry.findFirst({
      where: { shiftId, status: { in: ["open", "submitted"] }, clockOutAt: null },
      orderBy: { clockInAt: "desc" }
    });
    if (!openEntry) throw new BadRequestException("No open time entry for shift");

    const now = new Date();
    const updatedEntry = await (this.prisma as any).staffTimeEntry.update({
      where: { id: openEntry.id },
      data: { clockOutAt: now, status: "submitted", note: note ?? openEntry.note }
    });

    const entries = await (this.prisma as any).staffTimeEntry.findMany({
      where: { shiftId },
      orderBy: { clockInAt: "asc" }
    });

    const actualMinutes = this.calculateTotalMinutes(entries);

    const updatedShift = await this.prisma.staffShift.update({
      where: { id: shiftId },
      data: {
        clockedOutAt: now,
        actualMinutes,
        status: "submitted"
      }
    });

    return { shift: updatedShift, entry: updatedEntry, minutes: actualMinutes };
  }

  async approveShift(shiftId: string, approverId: string, note?: string) {
    const shift = await this.prisma.staffShift.findUnique({
      where: { id: shiftId },
      include: { timeEntries: true }
    });
    if (!shift) throw new NotFoundException("Shift not found");

    const minutes = this.calculateTotalMinutes(shift.timeEntries);
    const approvedAt = new Date();

    const approval = await (this.prisma as any).shiftApproval.create({
      data: {
        shiftId,
        approverId,
        status: "approved",
        note,
        approvedAt
      }
    });

    await this.prisma.staffShift.update({
      where: { id: shiftId },
      data: {
        status: "approved",
        actualMinutes: minutes,
        approvedAt,
        approvedById: approverId,
        approvalNote: note
      }
    });

    await (this.prisma as any).staffTimeEntry.updateMany({
      where: { shiftId },
      data: { status: "approved", approvedAt, approvedById: approverId }
    });

    return { approval, minutes };
  }

  async rejectShift(shiftId: string, approverId: string, note?: string) {
    const shift = await this.prisma.staffShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException("Shift not found");

    const rejectedAt = new Date();
    const approval = await (this.prisma as any).shiftApproval.create({
      data: { shiftId, approverId, status: "rejected", note, approvedAt: rejectedAt }
    });

    await this.prisma.staffShift.update({
      where: { id: shiftId },
      data: { status: "rejected", approvedAt: rejectedAt, approvedById: approverId, approvalNote: note }
    });

    await (this.prisma as any).staffTimeEntry.updateMany({
      where: { shiftId },
      data: { status: "rejected", approvedAt: rejectedAt, approvedById: approverId }
    });

    return { approval };
  }

  async submitShift(shiftId: string) {
    return this.prisma.staffShift.update({
      where: { id: shiftId },
      data: { status: "submitted" }
    });
  }

  // ---- Roles ----

  async upsertRole(dto: { campgroundId: string; code: string; name: string; hourlyRate?: number; earningCode?: string; isActive?: boolean }) {
    return (this.prisma as any).staffRole.upsert({
      where: {
        campgroundId_code: {
          campgroundId: dto.campgroundId,
          code: dto.code
        }
      },
      update: {
        name: dto.name,
        hourlyRate: dto.hourlyRate ?? undefined,
        earningCode: dto.earningCode ?? undefined,
        isActive: dto.isActive ?? true
      },
      create: {
        campgroundId: dto.campgroundId,
        code: dto.code,
        name: dto.name,
        hourlyRate: dto.hourlyRate ?? null,
        earningCode: dto.earningCode ?? null,
        isActive: dto.isActive ?? true
      }
    });
  }

  async listRoles(campgroundId: string) {
    return (this.prisma as any).staffRole.findMany({
      where: { campgroundId, isActive: true },
      orderBy: { code: "asc" }
    });
  }

  // ---- Overrides ----

  async requestOverride(dto: OverrideRequestDto) {
    const record = await (this.prisma as any).overrideRequest.create({
      data: {
        campgroundId: dto.campgroundId,
        userId: dto.userId,
        type: dto.type,
        reason: dto.reason,
        targetEntity: dto.targetEntity ?? null,
        targetId: dto.targetId ?? null,
        deltaAmount: dto.deltaAmount ?? null,
        metadata: dto.metadata ?? null,
        status: "pending"
      }
    });

    await this.audit.record({
      campgroundId: dto.campgroundId,
      actorId: dto.userId,
      action: "override.request",
      entity: dto.targetEntity ?? "override",
      entityId: record.id,
      after: record
    });

    return record;
  }

  async decideOverride(id: string, approverId: string, status: "approved" | "rejected" | "cancelled", note?: string) {
    const existing = await (this.prisma as any).overrideRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Override not found");

    const now = new Date();
    const updated = await (this.prisma as any).overrideRequest.update({
      where: { id },
      data: {
        approverId,
        status,
        approvedAt: status === "approved" ? now : null,
        rejectedAt: status === "rejected" ? now : null,
        reason: note ?? existing.reason
      }
    });

    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId: approverId,
      action: `override.${status}`,
      entity: existing.targetEntity ?? "override",
      entityId: existing.targetId ?? id,
      before: existing,
      after: updated
    });

    return updated;
  }

  async listOverrides(campgroundId: string, status?: string) {
    return (this.prisma as any).overrideRequest.findMany({
      where: { campgroundId, status: status ?? undefined },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  // ---- Availability ----

  async setAvailability(dto: CreateAvailabilityDto) {
    return this.prisma.staffAvailability.upsert({
      where: {
        campgroundId_userId_dayOfWeek: {
          campgroundId: dto.campgroundId,
          userId: dto.userId,
          dayOfWeek: dto.dayOfWeek,
        },
      },
      update: {
        startTime: dto.startTime,
        endTime: dto.endTime,
        isAvailable: dto.isAvailable ?? true,
      },
      create: {
        campgroundId: dto.campgroundId,
        userId: dto.userId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isAvailable: dto.isAvailable ?? true,
      },
    });
  }

  async getAvailability(campgroundId: string, userId?: string) {
    return this.prisma.staffAvailability.findMany({
      where: {
        campgroundId,
        ...(userId ? { userId } : {}),
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ userId: 'asc' }, { dayOfWeek: 'asc' }],
    });
  }

  // ---- Push Notifications ----

  async sendNotification(
    campgroundId: string,
    userId: string | null,
    type: PushNotificationType,
    title: string,
    body: string,
    data?: Record<string, any>
  ) {
    const pushEnabled = process.env.PUSH_NOTIFICATIONS_ENABLED === 'true';
    const fcmKey = process.env.FCM_SERVER_KEY;

    const notification = await this.prisma.pushNotification.create({
      data: {
        campgroundId,
        userId,
        type,
        title,
        body,
        data,
        sentAt: new Date(),
      },
    });

    // Delivery gating: only attempt if explicitly enabled and key present
    if (pushEnabled && fcmKey && userId) {
      try {
        // Fetch push subscriptions for the user
        const subs = await this.prisma.pushSubscription.findMany({
          where: { userId },
          select: { endpoint: true, keys: true }
        });

        // Minimal FCM-like payload; replace with real SDK as needed
        for (const sub of subs) {
          await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `key=${fcmKey}`
            },
            body: JSON.stringify({
              to: sub.endpoint,
              notification: { title, body },
              data
            })
          }).catch(() => {
            this.logger?.warn?.(`[Push] Failed to send to ${sub.endpoint}`);
          });
        }
      } catch (err) {
        this.logger?.error?.('[Push] Delivery failed', err as any);
      }
    } else {
      // Environment or opt-in not present; log only
      this.logger.log(`[Push] (noop) ${type}: ${title} to user ${userId ?? 'n/a'}`);
    }

    return notification;
  }

  async getNotifications(userId: string, limit = 50, unreadOnly = false) {
    return this.prisma.pushNotification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markNotificationRead(id: string) {
    return this.prisma.pushNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllNotificationsRead(userId: string) {
    return this.prisma.pushNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // ---- Performance Tracking ----

  async recordPerformance(
    campgroundId: string,
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    metrics: {
      tasksCompleted?: number;
      tasksSlaOnTime?: number;
      checkinsHandled?: number;
      avgTaskMinutes?: number;
      hoursWorked?: number;
      notes?: string;
    }
  ) {
    return this.prisma.staffPerformance.upsert({
      where: {
        campgroundId_userId_periodStart_periodEnd: {
          campgroundId,
          userId,
          periodStart,
          periodEnd,
        },
      },
      update: metrics,
      create: {
        campgroundId,
        userId,
        periodStart,
        periodEnd,
        ...metrics,
      },
    });
  }

  async getPerformance(campgroundId: string, userId?: string, startDate?: Date, endDate?: Date) {
    return this.prisma.staffPerformance.findMany({
      where: {
        campgroundId,
        ...(userId ? { userId } : {}),
        ...(startDate ? { periodStart: { gte: startDate } } : {}),
        ...(endDate ? { periodEnd: { lte: endDate } } : {}),
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { periodStart: 'desc' },
    });
  }

  /**
   * Calculate performance metrics for a staff member
   */
  async calculatePerformanceMetrics(campgroundId: string, userId: string, periodStart: Date, periodEnd: Date) {
    // Count completed tasks
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId: campgroundId,
        assignedToUserId: userId,
        state: 'done',
        updatedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    const tasksCompleted = tasks.length;
    const tasksSlaOnTime = tasks.filter(t => t.slaStatus === 'on_track').length;

    // Get shifts and calculate hours worked
    const shifts = await this.prisma.staffShift.findMany({
      where: {
        campgroundId,
        userId,
        shiftDate: { gte: periodStart, lte: periodEnd },
        clockedInAt: { not: null },
        clockedOutAt: { not: null },
      },
    });

    let hoursWorked = 0;
    for (const shift of shifts) {
      if (shift.actualMinutes != null) {
        hoursWorked += shift.actualMinutes / 60;
      } else if (shift.clockedInAt && shift.clockedOutAt) {
        hoursWorked += minutesBetween({ clockInAt: shift.clockedInAt, clockOutAt: shift.clockedOutAt }) / 60;
      }
    }

    return this.recordPerformance(campgroundId, userId, periodStart, periodEnd, {
      tasksCompleted,
      tasksSlaOnTime,
      hoursWorked: Math.round(hoursWorked * 10) / 10,
    });
  }

  // ---- Time Off ----

  async createTimeOffRequest(dto: {
    campgroundId: string;
    userId: string;
    type: "vacation" | "sick" | "personal" | "bereavement" | "jury_duty" | "unpaid" | "other";
    startDate: string;
    endDate: string;
    hoursRequested?: number;
    reason?: string;
  }) {
    return this.prisma.timeOffRequest.create({
      data: {
        campgroundId: dto.campgroundId,
        userId: dto.userId,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        hoursRequested: dto.hoursRequested,
        reason: dto.reason,
      },
      include: {
        User_TimeOffRequest_userIdToUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async listTimeOffRequests(
    campgroundId: string,
    options?: {
      userId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    return this.prisma.timeOffRequest.findMany({
      where: {
        campgroundId,
        ...(options?.userId ? { userId: options.userId } : {}),
        ...(options?.status ? { status: options.status as any } : {}),
        ...(options?.startDate ? { startDate: { gte: options.startDate } } : {}),
        ...(options?.endDate ? { endDate: { lte: options.endDate } } : {}),
      },
      include: {
        User_TimeOffRequest_userIdToUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        User_TimeOffRequest_reviewerIdToUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async reviewTimeOffRequest(
    requestId: string,
    reviewerId: string,
    status: "approved" | "rejected",
    note?: string
  ) {
    const request = await this.prisma.timeOffRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Time-off request not found');

    return this.prisma.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewerId,
        reviewerNote: note,
        reviewedAt: new Date(),
      },
      include: {
        User_TimeOffRequest_userIdToUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        User_TimeOffRequest_reviewerIdToUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async cancelTimeOffRequest(requestId: string, userId: string) {
    const request = await this.prisma.timeOffRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Time-off request not found');
    if (request.userId !== userId) throw new BadRequestException('Cannot cancel another user\'s request');
    if (request.status !== 'pending') throw new BadRequestException('Can only cancel pending requests');

    return this.prisma.timeOffRequest.update({
      where: { id: requestId },
      data: { status: 'cancelled' },
    });
  }

  // ---- Availability Overrides ----

  async setAvailabilityOverride(dto: {
    campgroundId: string;
    userId: string;
    date: string;
    isAvailable: boolean;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) {
    return this.prisma.availabilityOverride.upsert({
      where: {
        campgroundId_userId_date: {
          campgroundId: dto.campgroundId,
          userId: dto.userId,
          date: new Date(dto.date),
        },
      },
      update: {
        isAvailable: dto.isAvailable,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
      },
      create: {
        campgroundId: dto.campgroundId,
        userId: dto.userId,
        date: new Date(dto.date),
        isAvailable: dto.isAvailable,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
      },
    });
  }

  async deleteAvailabilityOverride(campgroundId: string, userId: string, date: string) {
    return this.prisma.availabilityOverride.delete({
      where: {
        campgroundId_userId_date: {
          campgroundId,
          userId,
          date: new Date(date),
        },
      },
    });
  }

  async getAvailabilityOverrides(
    campgroundId: string,
    options?: {
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    return this.prisma.availabilityOverride.findMany({
      where: {
        campgroundId,
        ...(options?.userId ? { userId: options.userId } : {}),
        ...(options?.startDate && options?.endDate
          ? { date: { gte: options.startDate, lte: options.endDate } }
          : {}),
      },
      include: {
        User: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  // ---- Breaks ----

  async startBreak(timeEntryId: string, type: "paid" | "unpaid" | "meal" | "rest", note?: string) {
    const timeEntry = await this.prisma.staffTimeEntry.findUnique({
      where: { id: timeEntryId },
      include: { breaks: { where: { endedAt: null } } },
    });

    if (!timeEntry) throw new NotFoundException('Time entry not found');
    if (timeEntry.clockOutAt) throw new BadRequestException('Cannot start break on clocked-out entry');
    if (timeEntry.breaks.length > 0) throw new BadRequestException('Already on a break');

    return this.prisma.staffBreak.create({
      data: {
        timeEntryId,
        type,
        startedAt: new Date(),
        note,
      },
    });
  }

  async endBreak(breakId: string) {
    const brk = await this.prisma.staffBreak.findUnique({ where: { id: breakId } });
    if (!brk) throw new NotFoundException('Break not found');
    if (brk.endedAt) throw new BadRequestException('Break already ended');

    const endedAt = new Date();
    const durationMins = Math.round((endedAt.getTime() - brk.startedAt.getTime()) / 60000);

    return this.prisma.staffBreak.update({
      where: { id: breakId },
      data: { endedAt, durationMins },
    });
  }

  async getActiveBreak(timeEntryId: string) {
    return this.prisma.staffBreak.findFirst({
      where: { timeEntryId, endedAt: null },
    });
  }

  async getBreaksForEntry(timeEntryId: string) {
    return this.prisma.staffBreak.findMany({
      where: { timeEntryId },
      orderBy: { startedAt: 'asc' },
    });
  }

  // ---- Overtime Config ----

  async getOvertimeConfig(campgroundId: string) {
    const config = await this.prisma.overtimeConfig.findUnique({
      where: { campgroundId },
    });

    return config || {
      campgroundId,
      weeklyThreshold: 40,
      dailyThreshold: null,
      overtimeMultiplier: 1.5,
      doubleTimeThreshold: null,
      doubleTimeMultiplier: null,
      weekStartDay: 0,
    };
  }

  async updateOvertimeConfig(params: {
    campgroundId: string;
    weeklyThreshold?: number;
    dailyThreshold?: number | null;
    overtimeMultiplier?: number;
    doubleTimeThreshold?: number | null;
    doubleTimeMultiplier?: number | null;
    weekStartDay?: number;
  }) {
    return this.prisma.overtimeConfig.upsert({
      where: { campgroundId: params.campgroundId },
      update: {
        weeklyThreshold: params.weeklyThreshold,
        dailyThreshold: params.dailyThreshold,
        overtimeMultiplier: params.overtimeMultiplier,
        doubleTimeThreshold: params.doubleTimeThreshold,
        doubleTimeMultiplier: params.doubleTimeMultiplier,
        weekStartDay: params.weekStartDay,
      },
      create: {
        campgroundId: params.campgroundId,
        weeklyThreshold: params.weeklyThreshold ?? 40,
        dailyThreshold: params.dailyThreshold,
        overtimeMultiplier: params.overtimeMultiplier ?? 1.5,
        doubleTimeThreshold: params.doubleTimeThreshold,
        doubleTimeMultiplier: params.doubleTimeMultiplier,
        weekStartDay: params.weekStartDay ?? 0,
      },
    });
  }

  /**
   * Calculate net worked minutes (gross time minus unpaid breaks)
   */
  calculateNetWorkedMinutes(clockInAt: Date, clockOutAt: Date | null, breaks: { type: string; durationMins: number | null }[]) {
    if (!clockOutAt) return 0;
    const grossMins = Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 60000);
    const unpaidBreakMins = breaks
      .filter((b) => b.type === 'unpaid' || b.type === 'meal')
      .reduce((sum, b) => sum + (b.durationMins || 0), 0);
    return Math.max(0, grossMins - unpaidBreakMins);
  }

  // ---- Shift Swaps ----

  async requestShiftSwap(dto: {
    campgroundId: string;
    requesterShiftId: string;
    requesterId: string;
    recipientUserId: string;
    note?: string;
  }) {
    // Verify the shift exists and belongs to the requester
    const shift = await this.prisma.staffShift.findUnique({
      where: { id: dto.requesterShiftId },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.userId !== dto.requesterId) {
      throw new BadRequestException('You can only swap your own shifts');
    }
    if (shift.status !== 'scheduled') {
      throw new BadRequestException('Can only swap scheduled shifts');
    }

    const swap = await this.prisma.shiftSwapRequest.create({
      data: {
        campgroundId: dto.campgroundId,
        requesterShiftId: dto.requesterShiftId,
        requesterId: dto.requesterId,
        recipientUserId: dto.recipientUserId,
        requesterNote: dto.note,
        status: 'pending_recipient',
      },
      include: {
        requesterShift: true,
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Send push notification to recipient
    await this.sendNotification(
      dto.campgroundId,
      dto.recipientUserId,
      'SHIFT_SWAP_REQUEST',
      'Shift Swap Request',
      `${swap.requester.firstName} ${swap.requester.lastName} wants to swap shifts with you`,
      { swapId: swap.id }
    );

    // Send email notification to recipient
    if (swap.recipient.email) {
      const campground = await this.prisma.campground.findUnique({
        where: { id: dto.campgroundId },
        select: { name: true },
      });

      const startTime = swap.requesterShift.startTime;
      const endTime = swap.requesterShift.endTime;

      await this.emailService.sendShiftSwapRequest({
        recipientEmail: swap.recipient.email,
        recipientName: `${swap.recipient.firstName} ${swap.recipient.lastName}`,
        requesterName: `${swap.requester.firstName} ${swap.requester.lastName}`,
        campgroundName: campground?.name || 'your campground',
        shiftDate: swap.requesterShift.shiftDate,
        shiftStartTime: startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        shiftEndTime: endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        role: swap.requesterShift.role || undefined,
        note: dto.note,
        actionUrl: `${process.env.WEB_URL || 'http://localhost:3000'}/campgrounds/${dto.campgroundId}/staff/swaps`,
      }).catch((err) => {
        this.logger.warn(`Failed to send shift swap request email: ${err.message}`);
      });
    }

    return swap;
  }

  async respondToSwapRequest(
    swapId: string,
    recipientId: string,
    accept: boolean,
    note?: string
  ) {
    const swap = await this.prisma.shiftSwapRequest.findUnique({
      where: { id: swapId },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true } },
        recipient: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!swap) throw new NotFoundException('Swap request not found');
    if (swap.recipientUserId !== recipientId) {
      throw new BadRequestException('Only the recipient can respond');
    }
    if (swap.status !== 'pending_recipient') {
      throw new BadRequestException('Swap is no longer pending recipient response');
    }

    const newStatus = accept ? 'pending_manager' : 'declined';
    const updated = await this.prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: newStatus,
        recipientNote: note,
        recipientRespondedAt: new Date(),
      },
      include: {
        requesterShift: true,
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Notify requester of response
    await this.sendNotification(
      swap.campgroundId,
      swap.requesterId,
      'SHIFT_SWAP_RESPONSE',
      accept ? 'Swap Request Accepted' : 'Swap Request Declined',
      `${swap.recipient.firstName} ${swap.recipient.lastName} has ${accept ? 'accepted' : 'declined'} your shift swap request`,
      { swapId: swap.id }
    );

    return updated;
  }

  async approveShiftSwap(swapId: string, managerId: string, approve: boolean, note?: string) {
    const swap = await this.prisma.shiftSwapRequest.findUnique({
      where: { id: swapId },
      include: {
        requesterShift: true,
        requester: { select: { id: true, firstName: true, lastName: true } },
        recipient: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!swap) throw new NotFoundException('Swap request not found');
    if (swap.status !== 'pending_manager') {
      throw new BadRequestException('Swap is not awaiting manager approval');
    }

    const newStatus = approve ? 'approved' : 'rejected';

    // If approved, actually swap the shift assignment
    if (approve) {
      await this.prisma.staffShift.update({
        where: { id: swap.requesterShiftId },
        data: { userId: swap.recipientUserId },
      });
    }

    const updated = await this.prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: newStatus,
        managerId,
        managerNote: note,
        managerRespondedAt: new Date(),
      },
      include: {
        requesterShift: true,
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify both parties via push notification
    const statusText = approve ? 'approved' : 'rejected';
    for (const userId of [swap.requesterId, swap.recipientUserId]) {
      await this.sendNotification(
        swap.campgroundId,
        userId,
        'SHIFT_SWAP_DECISION',
        `Shift Swap ${approve ? 'Approved' : 'Rejected'}`,
        `Manager has ${statusText} the shift swap request`,
        { swapId: swap.id }
      );
    }

    // Send email notifications to both parties
    const campground = await this.prisma.campground.findUnique({
      where: { id: swap.campgroundId },
      select: { name: true },
    });

    const startTime = swap.requesterShift.startTime;
    const endTime = swap.requesterShift.endTime;

    const emailNotifications = [
      { email: updated.requester.email, name: `${updated.requester.firstName} ${updated.requester.lastName}` },
      { email: updated.recipient.email, name: `${updated.recipient.firstName} ${updated.recipient.lastName}` },
    ].filter((n) => n.email);

    for (const recipient of emailNotifications) {
      await this.emailService.sendShiftSwapDecision({
        recipientEmail: recipient.email!,
        recipientName: recipient.name,
        approved: approve,
        campgroundName: campground?.name || 'your campground',
        shiftDate: swap.requesterShift.shiftDate,
        shiftStartTime: startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        shiftEndTime: endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        managerName: updated.manager ? `${updated.manager.firstName} ${updated.manager.lastName}` : undefined,
        note,
      }).catch((err) => {
        this.logger.warn(`Failed to send shift swap decision email: ${err.message}`);
      });
    }

    return updated;
  }

  async cancelSwapRequest(swapId: string, requesterId: string) {
    const swap = await this.prisma.shiftSwapRequest.findUnique({ where: { id: swapId } });
    if (!swap) throw new NotFoundException('Swap request not found');
    if (swap.requesterId !== requesterId) {
      throw new BadRequestException('Only the requester can cancel');
    }
    if (!['pending_recipient', 'pending_manager'].includes(swap.status)) {
      throw new BadRequestException('Cannot cancel a finalized swap');
    }

    return this.prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: 'cancelled' },
    });
  }

  async listSwapRequests(
    campgroundId: string,
    options?: {
      userId?: string;
      status?: string;
      role?: 'requester' | 'recipient' | 'any';
    }
  ) {
    const { userId, status, role = 'any' } = options || {};

    let userFilter = {};
    if (userId) {
      if (role === 'requester') {
        userFilter = { requesterId: userId };
      } else if (role === 'recipient') {
        userFilter = { recipientUserId: userId };
      } else {
        userFilter = { OR: [{ requesterId: userId }, { recipientUserId: userId }] };
      }
    }

    return this.prisma.shiftSwapRequest.findMany({
      where: {
        campgroundId,
        ...userFilter,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        requesterShift: true,
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- Schedule Templates ----

  async createScheduleTemplate(dto: {
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
  }) {
    return this.prisma.scheduleTemplate.create({
      data: {
        campgroundId: dto.campgroundId,
        name: dto.name,
        description: dto.description,
        createdById: dto.createdById,
        shifts: dto.shifts,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateScheduleTemplate(
    templateId: string,
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
    }
  ) {
    return this.prisma.scheduleTemplate.update({
      where: { id: templateId },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
        isRecurring: dto.isRecurring,
        recurringDay: dto.recurringDay,
        recurringWeeksAhead: dto.recurringWeeksAhead,
        shifts: dto.shifts,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async deleteScheduleTemplate(templateId: string) {
    return this.prisma.scheduleTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });
  }

  async listScheduleTemplates(campgroundId: string, includeInactive = false) {
    return this.prisma.scheduleTemplate.findMany({
      where: {
        campgroundId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getScheduleTemplate(templateId: string) {
    const template = await this.prisma.scheduleTemplate.findUnique({
      where: { id: templateId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async applyScheduleTemplate(
    templateId: string,
    weekStartDate: Date,
    createdBy: string
  ) {
    const template = await this.getScheduleTemplate(templateId);
    const shifts = template.shifts as Array<{
      dayOfWeek: number;
      roleCode?: string;
      startTime: string;
      endTime: string;
      userId?: string;
    }>;

    const createdShifts = [];

    for (const shiftDef of shifts) {
      if (!shiftDef.userId) continue; // Skip unassigned template shifts

      // Calculate the actual date based on dayOfWeek
      const shiftDate = new Date(weekStartDate);
      shiftDate.setDate(shiftDate.getDate() + shiftDef.dayOfWeek);

      const dateStr = shiftDate.toISOString().split('T')[0];
      const start = new Date(`${dateStr}T${shiftDef.startTime}`);
      const end = new Date(`${dateStr}T${shiftDef.endTime}`);
      const scheduledMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

      const shift = await this.prisma.staffShift.create({
        data: {
          campgroundId: template.campgroundId,
          userId: shiftDef.userId,
          shiftDate,
          startTime: start,
          endTime: end,
          scheduledMinutes,
          role: shiftDef.roleCode,
          createdBy,
        },
      });
      createdShifts.push(shift);
    }

    return {
      template,
      weekStartDate,
      createdShifts,
      count: createdShifts.length,
    };
  }

  async copyWeekSchedule(
    campgroundId: string,
    sourceWeekStart: Date,
    targetWeekStart: Date,
    createdBy: string
  ) {
    // Get all shifts from the source week
    const sourceWeekEnd = new Date(sourceWeekStart);
    sourceWeekEnd.setDate(sourceWeekEnd.getDate() + 6);

    const sourceShifts = await this.prisma.staffShift.findMany({
      where: {
        campgroundId,
        shiftDate: { gte: sourceWeekStart, lte: sourceWeekEnd },
      },
    });

    const daysDiff = Math.round(
      (targetWeekStart.getTime() - sourceWeekStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    const createdShifts = [];

    for (const shift of sourceShifts) {
      const newShiftDate = new Date(shift.shiftDate);
      newShiftDate.setDate(newShiftDate.getDate() + daysDiff);

      const newStart = new Date(shift.startTime);
      newStart.setDate(newStart.getDate() + daysDiff);

      const newEnd = new Date(shift.endTime);
      newEnd.setDate(newEnd.getDate() + daysDiff);

      const newShift = await this.prisma.staffShift.create({
        data: {
          campgroundId,
          userId: shift.userId,
          shiftDate: newShiftDate,
          startTime: newStart,
          endTime: newEnd,
          scheduledMinutes: shift.scheduledMinutes,
          role: shift.role,
          notes: shift.notes,
          createdBy,
        },
      });
      createdShifts.push(newShift);
    }

    return {
      sourceWeekStart,
      targetWeekStart,
      copiedCount: createdShifts.length,
      shifts: createdShifts,
    };
  }

  // ---- Timesheet Reports ----

  async getTimesheetReport(
    campgroundId: string,
    periodStart: Date,
    periodEnd: Date,
    options?: {
      userId?: string;
      groupBy?: 'user' | 'day' | 'role';
    }
  ) {
    const { userId, groupBy = 'user' } = options || {};

    // Get all time entries for the period
    const entries = await this.prisma.staffTimeEntry.findMany({
      where: {
        campgroundId,
        clockInAt: { gte: periodStart },
        clockOutAt: { lte: periodEnd },
        ...(userId ? { userId } : {}),
      },
      include: {
        User_StaffTimeEntry_userIdToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        StaffShift: { select: { id: true, role: true, shiftDate: true } },
        StaffBreak: true,
      },
      orderBy: { clockInAt: 'asc' },
    });

    // Get overtime config
    const otConfig = await this.getOvertimeConfig(campgroundId);

    // Calculate totals
    const report = {
      periodStart,
      periodEnd,
      totalEntries: entries.length,
      totalGrossMinutes: 0,
      totalNetMinutes: 0,
      totalBreakMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      doubleTimeMinutes: 0,
      byUser: {} as Record<string, {
        userId: string;
        name: string;
        entries: number;
        grossMinutes: number;
        netMinutes: number;
        breakMinutes: number;
        regularMinutes: number;
        overtimeMinutes: number;
      }>,
      entries: entries.map((e) => {
        const grossMins = e.clockOutAt
          ? Math.round((e.clockOutAt.getTime() - e.clockInAt.getTime()) / 60000)
          : 0;
        const breakMins = e.StaffBreak.reduce((sum, b) => sum + (b.durationMins || 0), 0);
        const netMins = this.calculateNetWorkedMinutes(e.clockInAt, e.clockOutAt, e.StaffBreak);

        return {
          id: e.id,
          userId: e.userId,
          userName: `${e.User_StaffTimeEntry_userIdToUser.firstName} ${e.User_StaffTimeEntry_userIdToUser.lastName}`,
          date: e.clockInAt.toISOString().split('T')[0],
          clockIn: e.clockInAt,
          clockOut: e.clockOutAt,
          role: e.StaffShift?.role,
          grossMinutes: grossMins,
          breakMinutes: breakMins,
          netMinutes: netMins,
          status: e.status,
        };
      }),
    };

    // Aggregate by user
    for (const entry of report.entries) {
      if (!report.byUser[entry.userId]) {
        report.byUser[entry.userId] = {
          userId: entry.userId,
          name: entry.userName,
          entries: 0,
          grossMinutes: 0,
          netMinutes: 0,
          breakMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
        };
      }
      const user = report.byUser[entry.userId];
      user.entries++;
      user.grossMinutes += entry.grossMinutes;
      user.netMinutes += entry.netMinutes;
      user.breakMinutes += entry.breakMinutes;

      report.totalGrossMinutes += entry.grossMinutes;
      report.totalNetMinutes += entry.netMinutes;
      report.totalBreakMinutes += entry.breakMinutes;
    }

    // Calculate OT per user based on weekly threshold
    const weeklyThresholdMins = (otConfig.weeklyThreshold ?? 40) * 60;
    for (const userId in report.byUser) {
      const user = report.byUser[userId];
      if (user.netMinutes > weeklyThresholdMins) {
        user.regularMinutes = weeklyThresholdMins;
        user.overtimeMinutes = user.netMinutes - weeklyThresholdMins;
      } else {
        user.regularMinutes = user.netMinutes;
        user.overtimeMinutes = 0;
      }
      report.regularMinutes += user.regularMinutes;
      report.overtimeMinutes += user.overtimeMinutes;
    }

    return report;
  }

  // ---- Recurring Template Processing ----

  /**
   * Get recurring templates that should run today
   */
  async getRecurringTemplatesForToday() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, etc.

    return this.prisma.scheduleTemplate.findMany({
      where: {
        isActive: true,
        isRecurring: true,
        recurringDay: dayOfWeek,
      },
      include: {
        campground: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Process all recurring templates that should run today.
   * Called by a scheduled cron job.
   */
  async processRecurringTemplates() {
    const templates = await this.getRecurringTemplatesForToday();
    const results: Array<{
      templateId: string;
      templateName: string;
      campgroundName: string;
      success: boolean;
      shiftsCreated: number;
      error?: string;
    }> = [];

    for (const template of templates) {
      try {
        // Calculate the target week start date
        const today = new Date();
        const weeksAhead = template.recurringWeeksAhead ?? 1;

        // Find the next Sunday (or configured week start)
        const nextWeekStart = new Date(today);
        const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
        nextWeekStart.setDate(today.getDate() + daysUntilSunday + (weeksAhead - 1) * 7);
        nextWeekStart.setHours(0, 0, 0, 0);

        // Check if we already applied for this week (prevent duplicates)
        if (template.lastAppliedAt) {
          const lastAppliedDate = new Date(template.lastAppliedAt);
          const daysSinceLastApplied = Math.floor(
            (today.getTime() - lastAppliedDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceLastApplied < 6) {
            // Already ran within the last week, skip
            this.logger.log(`Skipping template ${template.name} - already applied recently`);
            continue;
          }
        }

        // Apply the template
        const result = await this.applyScheduleTemplate(
          template.id,
          nextWeekStart,
          template.createdById // Use template creator as the "createdBy" for shifts
        );

        // Update lastAppliedAt
        await this.prisma.scheduleTemplate.update({
          where: { id: template.id },
          data: { lastAppliedAt: new Date() },
        });

        results.push({
          templateId: template.id,
          templateName: template.name,
          campgroundName: template.campground.name,
          success: true,
          shiftsCreated: result.count,
        });

        this.logger.log(
          `Applied recurring template "${template.name}" for ${template.campground.name}: ${result.count} shifts created`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          templateId: template.id,
          templateName: template.name,
          campgroundName: template.campground.name,
          success: false,
          shiftsCreated: 0,
          error: message,
        });
        this.logger.error(
          `Failed to apply recurring template "${template.name}": ${message}`
        );
      }
    }

    return {
      processedAt: new Date(),
      templatesProcessed: templates.length,
      results,
    };
  }

  /**
   * Toggle recurring scheduling for a template
   */
  async setTemplateRecurring(
    templateId: string,
    isRecurring: boolean,
    recurringDay?: number,
    recurringWeeksAhead?: number
  ) {
    const template = await this.getScheduleTemplate(templateId);

    return this.prisma.scheduleTemplate.update({
      where: { id: templateId },
      data: {
        isRecurring,
        recurringDay: isRecurring ? (recurringDay ?? 0) : null,
        recurringWeeksAhead: isRecurring ? (recurringWeeksAhead ?? 1) : null,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}

