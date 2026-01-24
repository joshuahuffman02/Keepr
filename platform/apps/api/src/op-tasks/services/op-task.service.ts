import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  OpTask,
  OpTaskState,
  OpSlaStatus,
  OpTriggerEvent,
  Prisma,
  GamificationEventCategory,
} from "@prisma/client";
import { randomUUID } from "crypto";
import {
  CreateOpTaskDto,
  UpdateOpTaskDto,
  OpTaskQueryDto,
  CreateOpTaskCommentDto,
} from "../dto/op-task.dto";
import { GamificationService } from "../../gamification/gamification.service";
import { OpGamificationService } from "./op-gamification.service";

type ChecklistTemplateItem = {
  id: string;
  text: string;
  required?: boolean;
  category?: string;
  estimatedMinutes?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeChecklistTemplate = (value: unknown): ChecklistTemplateItem[] => {
  if (!Array.isArray(value)) return [];
  const items: ChecklistTemplateItem[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== "string" || typeof item.text !== "string") continue;
    items.push({
      id: item.id,
      text: item.text,
      required: item.required === true ? true : undefined,
      category: typeof item.category === "string" ? item.category : undefined,
      estimatedMinutes:
        typeof item.estimatedMinutes === "number" ? item.estimatedMinutes : undefined,
    });
  }
  return items;
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return toJsonValue(value) ?? Prisma.JsonNull;
};

@Injectable()
export class OpTaskService {
  private readonly logger = new Logger(OpTaskService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => GamificationService))
    private gamificationService: GamificationService,
    @Inject(forwardRef(() => OpGamificationService))
    private opGamificationService: OpGamificationService,
  ) {}

  /**
   * Create a new task
   */
  async create(campgroundId: string, dto: CreateOpTaskDto, createdById: string): Promise<OpTask> {
    // If template provided, inherit defaults
    let templateChecklistItems: ChecklistTemplateItem[] = [];
    let slaMinutes: number | null = null;

    if (dto.templateId) {
      const template = await this.prisma.opTaskTemplate.findUnique({
        where: { id: dto.templateId },
      });
      if (template) {
        templateChecklistItems = normalizeChecklistTemplate(template.checklistTemplate);
        slaMinutes = template.slaMinutes;
      }
    }

    // Calculate SLA due time
    const slaDueAt = dto.slaDueAt
      ? new Date(dto.slaDueAt)
      : slaMinutes
        ? new Date(Date.now() + slaMinutes * 60 * 1000)
        : null;

    // Initialize checklist from template if not provided
    const checklist = dto.checklist
      ? dto.checklist
      : templateChecklistItems.length
        ? templateChecklistItems.map((item) => ({
            ...item,
            completed: false,
          }))
        : null;

    return this.prisma.opTask.create({
      data: {
        id: randomUUID(),
        campgroundId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? "medium",
        siteId: dto.siteId,
        reservationId: dto.reservationId,
        locationDescription: dto.locationDescription,
        assignedToUserId: dto.assignedToUserId,
        assignedToTeamId: dto.assignedToTeamId,
        slaDueAt,
        slaStatus: "on_track",
        checklist: toNullableJsonInput(checklist),
        checklistProgress: 0,
        notes: dto.notes,
        isBlocking: dto.isBlocking ?? false,
        templateId: dto.templateId,
        sourceEvent: OpTriggerEvent.manual,
        createdById,
        updatedAt: new Date(),
      },
      include: {
        Site: true,
        Reservation: { include: { Guest: true } },
        User_OpTask_assignedToUserIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        OpTeam: true,
        OpTaskTemplate: true,
      },
    });
  }

  /**
   * Find tasks with filters
   */
  async findMany(
    campgroundId: string,
    query: OpTaskQueryDto,
  ): Promise<{ tasks: OpTask[]; total: number }> {
    const where: Prisma.OpTaskWhereInput = {
      campgroundId,
      ...(query.categories?.length && { category: { in: query.categories } }),
      ...(query.states?.length && { state: { in: query.states } }),
      ...(query.priorities?.length && { priority: { in: query.priorities } }),
      ...(query.assignedToUserId && { assignedToUserId: query.assignedToUserId }),
      ...(query.assignedToTeamId && { assignedToTeamId: query.assignedToTeamId }),
      ...(query.siteId && { siteId: query.siteId }),
      ...(query.slaStatus && { slaStatus: query.slaStatus }),
      ...(query.dueBefore || query.dueAfter
        ? {
            slaDueAt: {
              ...(query.dueBefore && { lte: new Date(query.dueBefore) }),
              ...(query.dueAfter && { gte: new Date(query.dueAfter) }),
            },
          }
        : {}),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.opTask.findMany({
        where,
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        orderBy: [{ priority: "desc" }, { slaDueAt: "asc" }, { createdAt: "desc" }],
        include: {
          Site: true,
          Reservation: { include: { Guest: true } },
          User_OpTask_assignedToUserIdToUser: {
            select: { id: true, firstName: true, lastName: true },
          },
          OpTeam: true,
          OpTaskTemplate: true,
        },
      }),
      this.prisma.opTask.count({ where }),
    ]);

    return { tasks, total };
  }

  /**
   * Find a single task by ID
   */
  async findOne(id: string): Promise<OpTask> {
    const task = await this.prisma.opTask.findUnique({
      where: { id },
      include: {
        Site: true,
        Reservation: { include: { Guest: true } },
        User_OpTask_assignedToUserIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        OpTeam: { include: { OpTeamMember: { include: { User: true } } } },
        User_OpTask_completedByIdToUser: { select: { id: true, firstName: true, lastName: true } },
        User_OpTask_verifiedByIdToUser: { select: { id: true, firstName: true, lastName: true } },
        OpTaskTemplate: true,
        OpTaskTrigger: true,
        OpRecurrenceRule: true,
        OpTaskComment: {
          include: { User: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return task;
  }

  /**
   * Update a task
   */
  async update(id: string, dto: UpdateOpTaskDto, userId: string): Promise<OpTask> {
    const existing = await this.prisma.opTask.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Task not found");
    }

    // Track state changes
    const stateChanged = dto.state && dto.state !== existing.state;
    const isCompleting = stateChanged && dto.state === OpTaskState.completed;
    const isVerifying = stateChanged && dto.state === OpTaskState.verified;

    // Calculate checklist progress if checklist updated
    let checklistProgress = existing.checklistProgress;
    if (dto.checklist) {
      const total = dto.checklist.length;
      const completed = dto.checklist.filter((item) => item.completed).length;
      checklistProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    // Prepare update data
    const updateData: Prisma.OpTaskUncheckedUpdateInput = {
      state: dto.state,
      priority: dto.priority,
      title: dto.title,
      description: dto.description,
      assignedToUserId: dto.assignedToUserId,
      assignedToTeamId: dto.assignedToTeamId,
      slaDueAt: dto.slaDueAt ? new Date(dto.slaDueAt) : undefined,
      checklist: dto.checklist === undefined ? undefined : toNullableJsonInput(dto.checklist),
      photos: dto.photos === undefined ? undefined : toNullableJsonInput(dto.photos),
      notes: dto.notes,
      isBlocking: dto.isBlocking,
      outOfOrder: dto.outOfOrder,
      outOfOrderReason: dto.outOfOrderReason,
      outOfOrderUntil: dto.outOfOrderUntil ? new Date(dto.outOfOrderUntil) : undefined,
      checklistProgress,
      ...(isCompleting && { completedAt: new Date(), completedById: userId }),
      ...(isVerifying && { verifiedAt: new Date(), verifiedById: userId }),
      ...(dto.state === OpTaskState.in_progress &&
        !existing.startedAt && { startedAt: new Date() }),
      updatedAt: new Date(),
    };

    const updated = await this.prisma.opTask.update({
      where: { id },
      data: updateData,
      include: {
        Site: true,
        Reservation: { include: { Guest: true } },
        User_OpTask_assignedToUserIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        OpTeam: true,
        OpTaskTemplate: true,
      },
    });

    // Add system comment for state changes
    if (stateChanged) {
      await this.addSystemComment(id, userId, `Status changed to ${dto.state}`);
    }

    // Process gamification when task is completed
    if (isCompleting && existing.assignedToUserId) {
      const completingUserId = existing.assignedToUserId;
      const wasOnTime = existing.slaStatus !== OpSlaStatus.breached;
      const completionTimeMinutes = existing.startedAt
        ? Math.round((Date.now() - new Date(existing.startedAt).getTime()) / (1000 * 60))
        : undefined;

      // Process Operations gamification (badges, streaks, points)
      try {
        const opResult = await this.opGamificationService.processTaskCompletion(
          id,
          completingUserId,
          existing.campgroundId,
          wasOnTime,
          completionTimeMinutes,
        );
        this.logger.log(
          `Op gamification: +${opResult.pointsEarned} pts, ${opResult.newBadges.length} badges, ` +
            `streak=${opResult.streakUpdated}, levelUp=${opResult.levelUp}`,
        );
      } catch (error) {
        this.logger.error(`Op gamification error: ${error}`);
      }

      // Also record in general gamification system (for unified XP)
      try {
        await this.gamificationService.recordEvent({
          campgroundId: existing.campgroundId,
          userId: completingUserId,
          category: GamificationEventCategory.task,
          reason: `Completed task: ${existing.title}`,
          sourceType: "op_task",
          sourceId: id,
          eventKey: `op_task_complete:${id}`, // Prevent duplicate awards
        });
      } catch (error) {
        this.logger.error(`General gamification error: ${error}`);
      }
    }

    return updated;
  }

  /**
   * Delete a task (or cancel it)
   */
  async delete(id: string): Promise<void> {
    const existing = await this.prisma.opTask.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Task not found");
    }

    // Soft delete by marking as cancelled
    await this.prisma.opTask.update({
      where: { id },
      data: { state: OpTaskState.cancelled },
    });
  }

  /**
   * Add a comment to a task
   */
  async addComment(taskId: string, userId: string, dto: CreateOpTaskCommentDto) {
    const task = await this.prisma.opTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return this.prisma.opTaskComment.create({
      data: {
        id: randomUUID(),
        taskId,
        userId,
        content: dto.content,
        isSystemMessage: false,
        updatedAt: new Date(),
      },
      include: {
        User: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Add a system comment (for audit trail)
   */
  private async addSystemComment(taskId: string, userId: string, content: string) {
    return this.prisma.opTaskComment.create({
      data: {
        id: randomUUID(),
        taskId,
        userId,
        content,
        isSystemMessage: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Bulk update task state (for batch operations)
   */
  async bulkUpdateState(ids: string[], state: OpTaskState, userId: string): Promise<number> {
    const isCompleting = state === OpTaskState.completed;
    const isVerifying = state === OpTaskState.verified;

    const result = await this.prisma.opTask.updateMany({
      where: { id: { in: ids } },
      data: {
        state,
        ...(isCompleting && { completedAt: new Date(), completedById: userId }),
        ...(isVerifying && { verifiedAt: new Date(), verifiedById: userId }),
        ...(state === OpTaskState.in_progress && { startedAt: new Date() }),
      },
    });

    return result.count;
  }

  /**
   * Assign task to user or team
   */
  async assign(
    id: string,
    assignToUserId?: string,
    assignToTeamId?: string,
    userId?: string,
  ): Promise<OpTask> {
    const task = await this.prisma.opTask.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const updated = await this.prisma.opTask.update({
      where: { id },
      data: {
        assignedToUserId: assignToUserId ?? null,
        assignedToTeamId: assignToTeamId ?? null,
        state: task.state === OpTaskState.pending ? OpTaskState.assigned : task.state,
      },
      include: {
        User_OpTask_assignedToUserIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        OpTeam: true,
      },
    });

    // Add audit comment
    if (userId) {
      let assigneeName = "Unassigned";
      if (assignToUserId) {
        const user = await this.prisma.user.findUnique({
          where: { id: assignToUserId },
          select: { firstName: true, lastName: true },
        });
        assigneeName = user ? `${user.firstName} ${user.lastName}` : "Unassigned";
      } else if (assignToTeamId) {
        const team = await this.prisma.opTeam.findUnique({
          where: { id: assignToTeamId },
          select: { name: true },
        });
        assigneeName = team?.name ?? "Unassigned";
      }

      await this.addSystemComment(id, userId, `Assigned to ${assigneeName}`);
    }

    return updated;
  }

  /**
   * Get task statistics for a campground
   */
  async getStats(campgroundId: string) {
    const [byState, byCategory, bySlaStatus, todayCompleted, overdueCount] = await Promise.all([
      this.prisma.opTask.groupBy({
        by: ["state"],
        where: { campgroundId },
        _count: true,
      }),
      this.prisma.opTask.groupBy({
        by: ["category"],
        where: { campgroundId, state: { notIn: ["completed", "cancelled"] } },
        _count: true,
      }),
      this.prisma.opTask.groupBy({
        by: ["slaStatus"],
        where: { campgroundId, state: { notIn: ["completed", "cancelled"] } },
        _count: true,
      }),
      this.prisma.opTask.count({
        where: {
          campgroundId,
          state: OpTaskState.completed,
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.opTask.count({
        where: {
          campgroundId,
          state: { notIn: ["completed", "cancelled"] },
          slaDueAt: { lt: new Date() },
        },
      }),
    ]);

    return {
      byState: Object.fromEntries(byState.map((s) => [s.state, s._count])),
      byCategory: Object.fromEntries(byCategory.map((c) => [c.category, c._count])),
      bySlaStatus: Object.fromEntries(bySlaStatus.map((s) => [s.slaStatus, s._count])),
      todayCompleted,
      overdueCount,
    };
  }

  /**
   * Get tasks due today (for dashboard)
   */
  async getDueToday(campgroundId: string): Promise<OpTask[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.opTask.findMany({
      where: {
        campgroundId,
        state: { notIn: ["completed", "cancelled"] },
        slaDueAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { slaDueAt: "asc" },
      include: {
        Site: true,
        User_OpTask_assignedToUserIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        OpTeam: true,
      },
    });
  }

  /**
   * Get overdue tasks
   */
  async getOverdue(campgroundId: string): Promise<OpTask[]> {
    return this.prisma.opTask.findMany({
      where: {
        campgroundId,
        state: { notIn: ["completed", "cancelled"] },
        slaDueAt: { lt: new Date() },
      },
      orderBy: { slaDueAt: "asc" },
      include: {
        Site: true,
        User_OpTask_assignedToUserIdToUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        OpTeam: true,
      },
    });
  }

  /**
   * Get my assigned tasks (for staff mobile view)
   */
  async getMyTasks(campgroundId: string, userId: string): Promise<OpTask[]> {
    // Get user's team memberships
    const teamMemberships = await this.prisma.opTeamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = teamMemberships.map((m) => m.teamId);

    return this.prisma.opTask.findMany({
      where: {
        campgroundId,
        state: { notIn: ["completed", "cancelled"] },
        OR: [
          { assignedToUserId: userId },
          ...(teamIds.length > 0 ? [{ assignedToTeamId: { in: teamIds } }] : []),
        ],
      },
      orderBy: [{ priority: "desc" }, { slaDueAt: "asc" }],
      include: {
        Site: true,
        Reservation: { include: { Guest: true } },
        OpTaskTemplate: true,
      },
    });
  }
}
