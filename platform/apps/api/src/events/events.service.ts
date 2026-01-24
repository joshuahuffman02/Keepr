import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEventSchema } from "@keepr/shared";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

type EventWithChildren = Prisma.EventGetPayload<{
  include: {
    other_Event: true;
  };
}>;

type PublicEventBase = Omit<EventWithChildren, "other_Event"> & {
  children: EventWithChildren["other_Event"];
};

type RecurringEventInstance = PublicEventBase & {
  originalEventId: string;
  isRecurringInstance: true;
};

type PublicEvent = PublicEventBase | RecurringEventInstance;

const mapEventChildren = (event: EventWithChildren): PublicEventBase => {
  const { other_Event, ...rest } = event;
  return { ...rest, children: other_Event };
};

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(
    data: z.infer<typeof CreateEventSchema> & {
      parentEventId?: string;
      recurrenceDays?: number[];
      recurrenceEndDate?: string;
    },
  ) {
    return this.prisma.event.create({
      data: {
        id: randomUUID(),
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
        recurrenceDays: data.recurrenceDays ?? [],
      },
    });
  }

  async findAll(campgroundId: string, start?: string, end?: string) {
    const where: Prisma.EventWhereInput = { campgroundId };

    if (start && end) {
      where.startDate = {
        gte: new Date(start),
        lte: new Date(end),
      };
    }

    const events = await this.prisma.event.findMany({
      where,
      include: {
        other_Event: {
          where: { isCancelled: false },
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: { startDate: "asc" },
    });

    return events.map(mapEventChildren);
  }

  // Get all events for a holiday/themed weekend
  async findByParent(parentEventId: string) {
    return this.prisma.event.findMany({
      where: { parentEventId },
      orderBy: { startDate: "asc" },
    });
  }

  // Get public events with expanded recurring instances
  async findPublic(campgroundId: string, start: Date, end: Date) {
    const events = await this.prisma.event.findMany({
      where: {
        campgroundId,
        isPublished: true,
        isCancelled: false,
        OR: [
          // Non-recurring events in range
          {
            isRecurring: false,
            startDate: { gte: start, lte: end },
          },
          // Recurring events that overlap the range
          {
            isRecurring: true,
            startDate: { lte: end },
            OR: [{ recurrenceEndDate: null }, { recurrenceEndDate: { gte: start } }],
          },
        ],
      },
      include: {
        other_Event: {
          where: { isPublished: true, isCancelled: false },
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: { startDate: "asc" },
    });

    // Expand recurring events into individual instances
    const result: PublicEvent[] = [];
    for (const event of events.map(mapEventChildren)) {
      if (event.isRecurring && event.recurrenceDays.length > 0) {
        const instances = this.generateRecurringInstances(event, start, end);
        result.push(...instances);
      } else {
        result.push(event);
      }
    }

    return result.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  // Generate individual instances for recurring events
  private generateRecurringInstances(
    event: PublicEventBase,
    start: Date,
    end: Date,
  ): RecurringEventInstance[] {
    const instances: RecurringEventInstance[] = [];
    const recurrenceEnd = event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : end;
    const effectiveEnd = recurrenceEnd < end ? recurrenceEnd : end;

    const current = new Date(start);
    while (current <= effectiveEnd) {
      const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
      if (event.recurrenceDays.includes(dayOfWeek)) {
        instances.push({
          ...event,
          id: `${event.id}_${current.toISOString().split("T")[0]}`,
          originalEventId: event.id,
          startDate: new Date(current),
          endDate: event.endDate
            ? new Date(
                current.getTime() +
                  (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()),
              )
            : null,
          isRecurringInstance: true,
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return instances;
  }

  // Helper to format recurrence as human-readable string
  getRecurrenceDescription(recurrenceDays: number[]): string {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    if (recurrenceDays.length === 0) return "";
    if (recurrenceDays.length === 7) return "Daily";
    if (recurrenceDays.length === 2 && recurrenceDays.includes(0) && recurrenceDays.includes(6))
      return "Weekends";
    if (recurrenceDays.length === 5 && !recurrenceDays.includes(0) && !recurrenceDays.includes(6))
      return "Weekdays";
    if (recurrenceDays.length === 1) return `Every ${dayNames[recurrenceDays[0]]}`;

    return recurrenceDays.map((d) => shortDays[d]).join(", ");
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        other_Event: { orderBy: { startDate: "asc" } },
        Event: true,
      },
    });
    if (!event) throw new NotFoundException(`Event with ID ${id} not found`);
    const { other_Event, Event, ...rest } = event;
    return { ...rest, children: other_Event, parent: Event };
  }

  async update(
    id: string,
    data: Partial<z.infer<typeof CreateEventSchema>> & {
      parentEventId?: string | null;
      recurrenceDays?: number[];
      recurrenceEndDate?: string | null;
    },
  ) {
    const updateData: Prisma.EventUpdateInput = {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : data.endDate === null ? null : undefined,
      recurrenceEndDate: data.recurrenceEndDate
        ? new Date(data.recurrenceEndDate)
        : data.recurrenceEndDate === null
          ? null
          : undefined,
    };

    return this.prisma.event.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    return this.prisma.event.delete({ where: { id } });
  }
}
