import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TaskType, TaskState, SlaStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Compute SLA status based on current time vs due date
   */
  computeSlaStatus(slaDueAt: Date | null, state: TaskState): SlaStatus {
    if (!slaDueAt || state === "done" || state === "failed" || state === "expired") {
      return "on_track";
    }
    const now = Date.now();
    const due = slaDueAt.getTime();
    const remaining = due - now;

    if (remaining < 0) return "breached";
    // At risk if less than 30% of original window remains
    const totalWindow = due - (due - 24 * 60 * 60 * 1000); // assume 24h window for simplicity
    if (remaining < totalWindow * 0.3) return "at_risk";
    return "on_track";
  }

  async create(data: {
    tenantId: string;
    type: TaskType;
    siteId: string;
    reservationId?: string;
    priority?: string;
    slaDueAt?: string;
    checklist?: unknown;
    assignedToUserId?: string;
    assignedToTeamId?: string;
    notes?: string;
    source?: string;
    createdBy: string;
  }) {
    const slaDueAt = data.slaDueAt ? new Date(data.slaDueAt) : null;
    const slaStatus = this.computeSlaStatus(slaDueAt, "pending");
    const checklist = toJsonValue(data.checklist);

    return this.prisma.task.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        type: data.type,
        state: "pending",
        priority: data.priority,
        siteId: data.siteId,
        reservationId: data.reservationId,
        assignedToUserId: data.assignedToUserId,
        assignedToTeamId: data.assignedToTeamId,
        slaDueAt,
        slaStatus,
        checklist,
        notes: data.notes,
        source: data.source,
        createdBy: data.createdBy,
        updatedAt: new Date(),
      },
    });
  }

  async findAll(
    tenantId: string,
    filters?: {
      siteId?: string;
      state?: TaskState;
      slaStatus?: SlaStatus;
      type?: TaskType;
      assignedToUserId?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(filters?.limit ?? 100, 500);
    const offset = filters?.offset ?? 0;

    return this.prisma.task.findMany({
      where: {
        tenantId,
        siteId: filters?.siteId,
        state: filters?.state,
        slaStatus: filters?.slaStatus,
        type: filters?.type,
        assignedToUserId: filters?.assignedToUserId,
      },
      orderBy: [{ slaDueAt: "asc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string) {
    return this.prisma.task.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: {
      state?: TaskState;
      priority?: string;
      slaDueAt?: string;
      assignedToUserId?: string;
      assignedToTeamId?: string;
      checklist?: unknown;
      photos?: unknown;
      notes?: string;
    },
  ) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Task not found");

    const slaDueAt = data.slaDueAt ? new Date(data.slaDueAt) : existing.slaDueAt;
    const state = data.state ?? existing.state;
    const slaStatus = this.computeSlaStatus(slaDueAt, state);

    const checklist = toJsonValue(data.checklist);
    const photos = toJsonValue(data.photos);
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        state,
        priority: data.priority,
        slaDueAt,
        slaStatus,
        assignedToUserId: data.assignedToUserId,
        assignedToTeamId: data.assignedToTeamId,
        checklist,
        photos,
        notes: data.notes,
      },
    });

    // If turnover task completed, mark site ready on reservation
    if (updated.type === "turnover" && updated.state === "done" && updated.reservationId) {
      await this.markSiteReady(updated.reservationId);
    }

    return updated;
  }

  async markSiteReady(reservationId: string) {
    const reservation = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        siteReady: true,
        siteReadyAt: new Date(),
      },
      include: {
        Guest: true,
        Campground: true,
        Site: true,
      },
    });

    // Create site-ready communication record
    try {
      await this.prisma.communication.create({
        data: {
          id: randomUUID(),
          campgroundId: reservation.campgroundId,
          guestId: reservation.guestId,
          reservationId: reservation.id,
          type: "email",
          subject: `Your site is ready at ${reservation.Campground.name}`,
          body: `Good news! Site ${reservation.Site.siteNumber} is now ready for your arrival.`,
          status: "queued",
          direction: "outbound",
        },
      });
    } catch (err) {
      this.logger.error("Failed to create site-ready communication:", err);
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException("Task not found");
    }

    return this.prisma.task.delete({ where: { id } });
  }

  /**
   * Cron job: update SLA statuses and expire overdue pending tasks
   */
  async sweepSlaStatuses() {
    const pendingTasks = await this.prisma.task.findMany({
      where: { state: { in: ["pending", "in_progress"] } },
    });

    for (const task of pendingTasks) {
      const newStatus = this.computeSlaStatus(task.slaDueAt, task.state);
      const shouldExpire =
        task.state === "pending" && task.slaDueAt && task.slaDueAt.getTime() < Date.now();

      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          slaStatus: newStatus,
          state: shouldExpire ? "expired" : task.state,
        },
      });
    }
  }
}
