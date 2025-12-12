import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationType } from '@prisma/client';
import { AuditService } from "../audit/audit.service";
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
    private readonly audit: AuditService
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
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
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
        user: { select: { id: true, firstName: true, lastName: true } },
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
      console.log(`[Push] (noop) ${type}: ${title} to user ${userId ?? 'n/a'}`);
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
        user: { select: { id: true, firstName: true, lastName: true } },
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
}

