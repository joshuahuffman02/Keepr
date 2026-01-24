import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  Activity,
  ActivitySession,
  ActivityBooking,
  ActivityRecurrencePattern,
  Prisma,
} from "@prisma/client";
import {
  CreateActivityDto,
  CreateSessionDto,
  GenerateSessionsDto,
  GenerateSessionsPreview,
  RecurrencePatternType,
} from "./dto/activities.dto";
import {
  addDays,
  addWeeks,
  addMonths,
  format,
  getDay,
  parse,
  isWeekend,
  eachDayOfInterval,
  startOfDay,
} from "date-fns";

type ActivityWaitlistEntry = {
  id: string;
  guestName: string;
  partySize: number;
  contact?: string;
  addedAt: string;
};

type CapacityRecord = {
  capacity: number;
  booked: number;
  waitlistEnabled: boolean;
  waitlist: ActivityWaitlistEntry[];
  lastUpdated: string;
};

type CapacitySnapshot = {
  activityId: string;
  capacity: number;
  booked: number;
  remaining: number;
  waitlistEnabled: boolean;
  waitlistCount: number;
  overage: boolean;
  overageAmount: number;
  lastUpdated: string;
};

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  private capacityStore: Record<string, CapacityRecord> = {
    "demo-activity": {
      capacity: 20,
      booked: 18,
      waitlistEnabled: true,
      waitlist: [
        {
          id: "wl-1",
          guestName: "Jordan Creek",
          partySize: 2,
          contact: "jordan@example.com",
          addedAt: new Date().toISOString(),
        },
      ],
      lastUpdated: new Date().toISOString(),
    },
  };

  private ensureCapacityRecord(activityId: string): CapacityRecord {
    if (!this.capacityStore[activityId]) {
      this.capacityStore[activityId] = {
        capacity: 16,
        booked: 8,
        waitlistEnabled: true,
        waitlist: [],
        lastUpdated: new Date().toISOString(),
      };
    }
    return this.capacityStore[activityId];
  }

  private toSnapshot(activityId: string, record: CapacityRecord): CapacitySnapshot {
    const remaining = Math.max(record.capacity - record.booked, 0);
    const overageAmount = Math.max(record.booked - record.capacity, 0);
    return {
      activityId,
      capacity: record.capacity,
      booked: record.booked,
      remaining,
      waitlistEnabled: record.waitlistEnabled,
      waitlistCount: record.waitlist.length,
      overage: overageAmount > 0,
      overageAmount,
      lastUpdated: record.lastUpdated,
    };
  }

  async getCapacitySnapshot(activityId: string): Promise<CapacitySnapshot> {
    const record = this.ensureCapacityRecord(activityId);
    return this.toSnapshot(activityId, record);
  }

  async updateCapacitySettings(
    activityId: string,
    payload: { capacity?: number; waitlistEnabled?: boolean; booked?: number },
  ): Promise<CapacitySnapshot> {
    const record = this.ensureCapacityRecord(activityId);
    if (payload.capacity !== undefined) {
      if (payload.capacity < 1) throw new BadRequestException("Capacity must be at least 1");
      record.capacity = payload.capacity;
    }
    if (payload.booked !== undefined) {
      record.booked = Math.max(0, payload.booked);
    }
    if (payload.waitlistEnabled !== undefined) {
      record.waitlistEnabled = payload.waitlistEnabled;
    }
    record.lastUpdated = new Date().toISOString();
    return this.toSnapshot(activityId, record);
  }

  async addWaitlistEntry(
    activityId: string,
    entry: { guestName: string; partySize?: number; contact?: string },
  ): Promise<{ entry: ActivityWaitlistEntry; snapshot: CapacitySnapshot }> {
    const record = this.ensureCapacityRecord(activityId);
    if (!record.waitlistEnabled) {
      throw new BadRequestException("Waitlist is disabled for this activity");
    }
    const newEntry: ActivityWaitlistEntry = {
      id: `wl-${Date.now()}`,
      guestName: entry.guestName,
      partySize: Math.max(1, entry.partySize || 1),
      contact: entry.contact,
      addedAt: new Date().toISOString(),
    };
    record.waitlist.unshift(newEntry);
    record.lastUpdated = new Date().toISOString();
    return { entry: newEntry, snapshot: this.toSnapshot(activityId, record) };
  }

  private trackBookingImpact(activityId: string, quantity: number) {
    const record = this.ensureCapacityRecord(activityId);
    record.booked += quantity;
    record.lastUpdated = new Date().toISOString();
  }

  private trackCancellationImpact(activityId: string, quantity: number) {
    const record = this.ensureCapacityRecord(activityId);
    record.booked = Math.max(0, record.booked - quantity);
    record.lastUpdated = new Date().toISOString();
  }

  // Activities
  async createActivity(
    campgroundId: string,
    data: Omit<CreateActivityDto, "campgroundId">,
  ): Promise<Activity> {
    const { duration, capacity, ...rest } = data;
    if (duration === undefined) {
      throw new BadRequestException("Duration is required");
    }
    if (capacity === undefined) {
      throw new BadRequestException("Capacity is required");
    }
    return this.prisma.activity.create({
      data: {
        id: randomUUID(),
        ...rest,
        duration,
        capacity,
        campgroundId,
        updatedAt: new Date(),
      },
    });
  }

  async findAllActivities(campgroundId: string): Promise<Activity[]> {
    return this.prisma.activity.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findActivity(id: string): Promise<Activity> {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: { ActivitySession: true },
    });
    if (!activity) throw new NotFoundException("Activity not found");
    return activity;
  }

  async updateActivity(id: string, data: Prisma.ActivityUpdateInput): Promise<Activity> {
    return this.prisma.activity.update({
      where: { id },
      data,
    });
  }

  async deleteActivity(id: string): Promise<Activity> {
    return this.prisma.activity.delete({
      where: { id },
    });
  }

  // Sessions
  async createSession(activityId: string, data: CreateSessionDto): Promise<ActivitySession> {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException("Activity not found");

    return this.prisma.activitySession.create({
      data: {
        id: randomUUID(),
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        activityId,
        capacity: data.capacity ?? activity.capacity,
      },
    });
  }

  async findSessions(activityId: string): Promise<ActivitySession[]> {
    return this.prisma.activitySession.findMany({
      where: { activityId },
      orderBy: { startTime: "asc" },
      include: { ActivityBooking: true },
    });
  }

  // Bookings
  async createBooking(
    sessionId: string,
    guestId: string,
    quantity: number,
    reservationId?: string,
  ): Promise<ActivityBooking> {
    const session = await this.prisma.activitySession.findUnique({
      where: { id: sessionId },
      include: { Activity: true },
    });
    if (!session) throw new NotFoundException("Session not found");

    if (session.bookedCount + quantity > session.capacity) {
      throw new BadRequestException("Session capacity exceeded");
    }

    const totalAmount = session.Activity.price * quantity;

    const [booking, updatedSession] = await this.prisma.$transaction([
      this.prisma.activityBooking.create({
        data: {
          id: randomUUID(),
          sessionId,
          guestId,
          reservationId,
          quantity,
          totalAmount,
        },
      }),
      this.prisma.activitySession.update({
        where: { id: sessionId },
        data: { bookedCount: { increment: quantity } },
      }),
    ]);

    this.trackBookingImpact(session.activityId, quantity);
    return booking;
  }

  async cancelBooking(id: string): Promise<ActivityBooking> {
    const booking = await this.prisma.activityBooking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException("Booking not found");

    const session = await this.prisma.activitySession.findUnique({
      where: { id: booking.sessionId },
    });
    const [cancelledBooking] = await this.prisma.$transaction([
      this.prisma.activityBooking.update({
        where: { id },
        data: { status: "cancelled" },
      }),
      this.prisma.activitySession.update({
        where: { id: booking.sessionId },
        data: { bookedCount: { decrement: booking.quantity } },
      }),
    ]);

    if (session) {
      this.trackCancellationImpact(session.activityId, booking.quantity);
    }
    return cancelledBooking;
  }

  // ==================== BULK SESSION GENERATION ====================

  private readonly dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  /**
   * Preview sessions that would be generated (without creating them)
   */
  async previewGeneratedSessions(
    activityId: string,
    dto: GenerateSessionsDto,
  ): Promise<GenerateSessionsPreview> {
    const activity = await this.findActivity(activityId);
    const sessions = this.calculateSessionDates(dto, activity.duration);

    return {
      sessions: sessions.map((s) => ({
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        dayOfWeek: this.dayNames[getDay(s.startTime)],
        isWeekend: isWeekend(s.startTime),
      })),
      totalCount: sessions.length,
      patternDescription: this.describePattern(dto),
    };
  }

  /**
   * Generate sessions in bulk based on a recurrence pattern
   */
  async generateSessions(
    activityId: string,
    dto: GenerateSessionsDto,
  ): Promise<{ created: number; patternId?: string }> {
    const activity = await this.findActivity(activityId);
    const sessionDates = this.calculateSessionDates(dto, activity.duration);

    if (sessionDates.length === 0) {
      throw new BadRequestException("No sessions would be generated with the given parameters");
    }

    if (sessionDates.length > 365) {
      throw new BadRequestException("Cannot generate more than 365 sessions at once");
    }

    // Optionally save the pattern for future use
    let patternId: string | undefined;
    if (dto.savePattern) {
      const pattern = await this.prisma.activityRecurrencePattern.create({
        data: {
          id: randomUUID(),
          activityId,
          patternType: dto.patternType,
          daysOfWeek: dto.daysOfWeek || [],
          startTime: dto.startTime,
          endTime: dto.endTime || this.calculateEndTime(dto.startTime, activity.duration),
          validFrom: new Date(dto.startDate),
          validUntil: new Date(dto.endDate),
          capacity: dto.capacity,
          updatedAt: new Date(),
        },
      });
      patternId = pattern.id;
    }

    // Create all sessions
    const capacity = dto.capacity || activity.capacity;
    await this.prisma.activitySession.createMany({
      data: sessionDates.map((s) => ({
        id: randomUUID(),
        activityId,
        recurrencePatternId: patternId,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity,
        bookedCount: 0,
        status: "scheduled",
      })),
    });

    return { created: sessionDates.length, patternId };
  }

  /**
   * Calculate session dates based on pattern
   */
  private calculateSessionDates(
    dto: GenerateSessionsDto,
    activityDuration: number,
  ): Array<{ startTime: Date; endTime: Date }> {
    const startDate = startOfDay(new Date(dto.startDate));
    const endDate = startOfDay(new Date(dto.endDate));
    const endTimeStr = dto.endTime || this.calculateEndTime(dto.startTime, activityDuration);
    const sessions: Array<{ startTime: Date; endTime: Date }> = [];

    switch (dto.patternType) {
      case RecurrencePatternType.DAILY:
        return this.generateDailySessions(startDate, endDate, dto.startTime, endTimeStr);

      case RecurrencePatternType.WEEKLY:
        return this.generateWeeklySessions(
          startDate,
          endDate,
          dto.startTime,
          endTimeStr,
          dto.daysOfWeek || [],
          1,
        );

      case RecurrencePatternType.BIWEEKLY:
        return this.generateWeeklySessions(
          startDate,
          endDate,
          dto.startTime,
          endTimeStr,
          dto.daysOfWeek || [],
          2,
        );

      case RecurrencePatternType.MONTHLY:
        // For monthly, use daysOfWeek[0] as the day of week to repeat
        return this.generateMonthlySessions(
          startDate,
          endDate,
          dto.startTime,
          endTimeStr,
          dto.daysOfWeek?.[0],
        );

      default:
        return sessions;
    }
  }

  private generateDailySessions(
    startDate: Date,
    endDate: Date,
    startTime: string,
    endTime: string,
  ): Array<{ startTime: Date; endTime: Date }> {
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    return allDays.map((day) => ({
      startTime: this.combineDateAndTime(day, startTime),
      endTime: this.combineDateAndTime(day, endTime),
    }));
  }

  private generateWeeklySessions(
    startDate: Date,
    endDate: Date,
    startTime: string,
    endTime: string,
    daysOfWeek: number[],
    weekInterval: number,
  ): Array<{ startTime: Date; endTime: Date }> {
    if (daysOfWeek.length === 0) {
      throw new BadRequestException("At least one day of week must be selected for weekly pattern");
    }

    const sessions: Array<{ startTime: Date; endTime: Date }> = [];
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    // For biweekly, we need to track which week we're in
    let weekCounter = 0;
    let lastWeekStart: Date | null = null;

    for (const day of allDays) {
      const dayOfWeek = getDay(day);

      // Check if this is a new week (Sunday = 0)
      if (dayOfWeek === 0 && lastWeekStart) {
        weekCounter++;
      }
      if (dayOfWeek === 0) {
        lastWeekStart = day;
      }

      // Skip if not in the right week interval
      if (weekInterval > 1 && weekCounter % weekInterval !== 0) {
        continue;
      }

      if (daysOfWeek.includes(dayOfWeek)) {
        sessions.push({
          startTime: this.combineDateAndTime(day, startTime),
          endTime: this.combineDateAndTime(day, endTime),
        });
      }
    }

    return sessions;
  }

  private generateMonthlySessions(
    startDate: Date,
    endDate: Date,
    startTime: string,
    endTime: string,
    dayOfWeek?: number,
  ): Array<{ startTime: Date; endTime: Date }> {
    const sessions: Array<{ startTime: Date; endTime: Date }> = [];
    let current = startDate;

    while (current <= endDate) {
      // If specific day of week, find first occurrence in month
      if (dayOfWeek !== undefined) {
        const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
        let targetDay = firstOfMonth;

        while (getDay(targetDay) !== dayOfWeek) {
          targetDay = addDays(targetDay, 1);
        }

        if (targetDay >= startDate && targetDay <= endDate) {
          sessions.push({
            startTime: this.combineDateAndTime(targetDay, startTime),
            endTime: this.combineDateAndTime(targetDay, endTime),
          });
        }
      } else {
        // Same day of month
        const targetDay = new Date(current.getFullYear(), current.getMonth(), startDate.getDate());
        if (targetDay >= startDate && targetDay <= endDate) {
          sessions.push({
            startTime: this.combineDateAndTime(targetDay, startTime),
            endTime: this.combineDateAndTime(targetDay, endTime),
          });
        }
      }

      current = addMonths(current, 1);
    }

    return sessions;
  }

  private combineDateAndTime(date: Date, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;
  }

  private describePattern(dto: GenerateSessionsDto): string {
    const days = dto.daysOfWeek?.map((d) => this.dayNames[d]).join(", ") || "";

    switch (dto.patternType) {
      case RecurrencePatternType.DAILY:
        return `Daily at ${dto.startTime}`;
      case RecurrencePatternType.WEEKLY:
        return `Weekly on ${days} at ${dto.startTime}`;
      case RecurrencePatternType.BIWEEKLY:
        return `Every other week on ${days} at ${dto.startTime}`;
      case RecurrencePatternType.MONTHLY:
        return `Monthly on the first ${days || "day"} at ${dto.startTime}`;
      default:
        return "Custom schedule";
    }
  }

  // ==================== RECURRENCE PATTERNS ====================

  async getRecurrencePatterns(activityId: string): Promise<ActivityRecurrencePattern[]> {
    return this.prisma.activityRecurrencePattern.findMany({
      where: { activityId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteRecurrencePattern(patternId: string): Promise<void> {
    await this.prisma.activityRecurrencePattern.update({
      where: { id: patternId },
      data: { isActive: false },
    });
  }

  // ==================== BUNDLES ====================

  async createBundle(
    campgroundId: string,
    data: {
      name: string;
      description?: string;
      price: number;
      discountType?: string;
      discountValue?: number;
      activityIds: string[];
    },
  ) {
    const bundle = await this.prisma.activityBundle.create({
      data: {
        id: randomUUID(),
        campgroundId,
        name: data.name,
        description: data.description,
        price: data.price,
        discountType: data.discountType || "fixed",
        discountValue: data.discountValue,
        updatedAt: new Date(),
        ActivityBundleItem: {
          create: data.activityIds.map((activityId) => ({
            id: randomUUID(),
            activityId,
            quantity: 1,
          })),
        },
      },
      include: { ActivityBundleItem: { include: { Activity: true } } },
    });
    return bundle;
  }

  async findBundles(campgroundId: string) {
    return this.prisma.activityBundle.findMany({
      where: { campgroundId, isActive: true },
      include: { ActivityBundleItem: { include: { Activity: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateBundle(
    id: string,
    data: {
      name?: string;
      description?: string;
      price?: number;
      isActive?: boolean;
      activityIds?: string[];
    },
  ) {
    // If updating activities, delete and recreate items
    if (data.activityIds) {
      await this.prisma.activityBundleItem.deleteMany({
        where: { bundleId: id },
      });

      await this.prisma.activityBundleItem.createMany({
        data: data.activityIds.map((activityId) => ({
          id: randomUUID(),
          bundleId: id,
          activityId,
          quantity: 1,
        })),
      });
    }

    const { activityIds, ...updateData } = data;
    return this.prisma.activityBundle.update({
      where: { id },
      data: { ...updateData, updatedAt: new Date() },
      include: { ActivityBundleItem: { include: { Activity: true } } },
    });
  }

  async deleteBundle(id: string) {
    return this.prisma.activityBundle.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
