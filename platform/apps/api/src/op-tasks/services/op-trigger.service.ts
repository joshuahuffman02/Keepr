import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  OpTaskTrigger,
  OpTriggerEvent,
  OpTask,
  Reservation,
  Site,
  OpTaskState,
  Prisma,
} from "@prisma/client";
import type { OpTaskTemplate } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  CreateOpTaskTriggerDto,
  UpdateOpTaskTriggerDto,
  TriggerConditionsDto,
} from "../dto/op-task.dto";

type TriggerWithTemplate = OpTaskTrigger & { OpTaskTemplate: OpTaskTemplate };

type ChecklistTemplateItem = {
  id: string;
  text: string;
  required?: boolean;
  category?: string;
  estimatedMinutes?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

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

const normalizeTriggerConditions = (value: unknown): TriggerConditionsDto | null => {
  if (!isRecord(value)) return null;
  const conditions: TriggerConditionsDto = {};

  if (isStringArray(value.siteClassIds)) conditions.siteClassIds = value.siteClassIds;
  if (isStringArray(value.siteIds)) conditions.siteIds = value.siteIds;
  if (typeof value.minNights === "number") conditions.minNights = value.minNights;
  if (typeof value.maxNights === "number") conditions.maxNights = value.maxNights;
  if (typeof value.hasPets === "boolean") conditions.hasPets = value.hasPets;
  if (typeof value.stayType === "string") conditions.stayType = value.stayType;

  return Object.keys(conditions).length > 0 ? conditions : null;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "Unknown error";

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
export class OpTriggerService {
  private readonly logger = new Logger(OpTriggerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new trigger
   */
  async create(campgroundId: string, dto: CreateOpTaskTriggerDto): Promise<OpTaskTrigger> {
    // Verify template exists and belongs to campground
    const template = await this.prisma.opTaskTemplate.findFirst({
      where: { id: dto.templateId, campgroundId },
    });
    if (!template) {
      throw new NotFoundException("Template not found");
    }

    return this.prisma.opTaskTrigger.create({
      data: {
        id: randomUUID(),
        campgroundId,
        name: dto.name,
        triggerEvent: dto.triggerEvent,
        templateId: dto.templateId,
        conditions: toNullableJsonInput(dto.conditions ?? {}),
        slaOffsetMinutes: dto.slaOffsetMinutes ?? 0,
        assignToTeamId: dto.assignToTeamId,
        assignToUserId: dto.assignToUserId,
        isActive: true,
        updatedAt: new Date(),
      },
      include: {
        OpTaskTemplate: true,
        OpTeam: true,
        User: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Find all triggers for a campground
   */
  async findAll(
    campgroundId: string,
    options?: { triggerEvent?: OpTriggerEvent; isActive?: boolean },
  ): Promise<OpTaskTrigger[]> {
    return this.prisma.opTaskTrigger.findMany({
      where: {
        campgroundId,
        ...(options?.triggerEvent && { triggerEvent: options.triggerEvent }),
        ...(options?.isActive !== undefined && { isActive: options.isActive }),
      },
      orderBy: [{ triggerEvent: "asc" }, { name: "asc" }],
      include: {
        OpTaskTemplate: true,
        OpTeam: true,
        User: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { OpTask: true } },
      },
    });
  }

  /**
   * Find a single trigger by ID
   */
  async findOne(id: string): Promise<OpTaskTrigger> {
    const trigger = await this.prisma.opTaskTrigger.findUnique({
      where: { id },
      include: {
        OpTaskTemplate: true,
        OpTeam: true,
        User: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { OpTask: true } },
      },
    });

    if (!trigger) {
      throw new NotFoundException("Trigger not found");
    }

    return trigger;
  }

  /**
   * Update a trigger
   */
  async update(id: string, dto: UpdateOpTaskTriggerDto): Promise<OpTaskTrigger> {
    const existing = await this.prisma.opTaskTrigger.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Trigger not found");
    }

    if (dto.templateId) {
      const template = await this.prisma.opTaskTemplate.findFirst({
        where: { id: dto.templateId, campgroundId: existing.campgroundId },
      });
      if (!template) {
        throw new NotFoundException("Template not found");
      }
    }

    return this.prisma.opTaskTrigger.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.triggerEvent && { triggerEvent: dto.triggerEvent }),
        ...(dto.templateId && { templateId: dto.templateId }),
        ...(dto.conditions !== undefined && {
          conditions: toNullableJsonInput(dto.conditions ?? {}),
        }),
        ...(dto.slaOffsetMinutes !== undefined && { slaOffsetMinutes: dto.slaOffsetMinutes }),
        ...(dto.assignToTeamId !== undefined && { assignToTeamId: dto.assignToTeamId }),
        ...(dto.assignToUserId !== undefined && { assignToUserId: dto.assignToUserId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      },
      include: {
        OpTaskTemplate: true,
        OpTeam: true,
        User: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Delete a trigger
   */
  async delete(id: string): Promise<void> {
    const existing = await this.prisma.opTaskTrigger.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Trigger not found");
    }

    await this.prisma.opTaskTrigger.delete({ where: { id } });
  }

  /**
   * Execute triggers for a specific event
   * This is called by event listeners when reservation events occur
   */
  async executeTriggers(
    campgroundId: string,
    event: OpTriggerEvent,
    context: TriggerContext,
  ): Promise<OpTask[]> {
    // Find all active triggers for this event
    const triggers = await this.prisma.opTaskTrigger.findMany({
      where: {
        campgroundId,
        triggerEvent: event,
        isActive: true,
      },
      include: { OpTaskTemplate: true },
    });

    if (triggers.length === 0) {
      this.logger.debug(`No triggers found for event ${event} in campground ${campgroundId}`);
      return [];
    }

    const createdTasks: OpTask[] = [];

    for (const trigger of triggers) {
      try {
        // Check if conditions are met
        const conditions = normalizeTriggerConditions(trigger.conditions);
        if (!this.checkConditions(conditions, context)) {
          this.logger.debug(`Trigger ${trigger.id} conditions not met, skipping`);
          continue;
        }

        const template = trigger.OpTaskTemplate;
        // Calculate SLA due time
        const slaDueAt = this.calculateSlaDueTime(trigger, context);

        const checklistItems = normalizeChecklistTemplate(template.checklistTemplate);
        const checklist = checklistItems.length
          ? checklistItems.map((item) => ({
              ...item,
              completed: false,
            }))
          : null;

        // Create the task
        const task = await this.prisma.opTask.create({
          data: {
            id: randomUUID(),
            campgroundId,
            category: template.category,
            title: this.interpolateTitle(template.name, context),
            description: template.description,
            priority: template.priority,
            siteId: context.siteId,
            reservationId: context.reservationId,
            assignedToUserId: trigger.assignToUserId ?? template.defaultAssigneeId,
            assignedToTeamId: trigger.assignToTeamId ?? template.defaultTeamId,
            slaDueAt,
            slaStatus: "on_track",
            checklist: toNullableJsonInput(checklist),
            checklistProgress: 0,
            templateId: trigger.templateId,
            triggerId: trigger.id,
            sourceEvent: event,
            createdById: context.userId ?? "system",
            state:
              trigger.assignToUserId || trigger.assignToTeamId
                ? OpTaskState.assigned
                : OpTaskState.pending,
            updatedAt: new Date(),
          },
        });

        createdTasks.push(task);
        this.logger.log(`Created task ${task.id} from trigger ${trigger.id} for event ${event}`);
      } catch (error: unknown) {
        this.logger.error(`Failed to execute trigger ${trigger.id}: ${getErrorMessage(error)}`);
      }
    }

    return createdTasks;
  }

  /**
   * Check if trigger conditions are met
   */
  private checkConditions(
    conditions: TriggerConditionsDto | null,
    context: TriggerContext,
  ): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    // Site class filter
    if (conditions.siteClassIds?.length && context.siteClassId) {
      if (!conditions.siteClassIds.includes(context.siteClassId)) {
        return false;
      }
    }

    // Site filter
    if (conditions.siteIds?.length && context.siteId) {
      if (!conditions.siteIds.includes(context.siteId)) {
        return false;
      }
    }

    // Night count filters
    if (conditions.minNights && context.nights) {
      if (context.nights < conditions.minNights) {
        return false;
      }
    }
    if (conditions.maxNights && context.nights) {
      if (context.nights > conditions.maxNights) {
        return false;
      }
    }

    // Pet filter
    if (conditions.hasPets !== undefined && context.hasPets !== undefined) {
      if (conditions.hasPets !== context.hasPets) {
        return false;
      }
    }

    // Stay type filter
    if (conditions.stayType && context.stayType) {
      if (conditions.stayType !== context.stayType) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate SLA due time based on trigger offset and context
   */
  private calculateSlaDueTime(trigger: TriggerWithTemplate, context: TriggerContext): Date {
    // Get reference time based on event type
    let referenceTime: Date;

    switch (trigger.triggerEvent) {
      case OpTriggerEvent.reservation_checkout:
        referenceTime = context.departureDate ? new Date(context.departureDate) : new Date();
        break;
      case OpTriggerEvent.reservation_checkin:
        referenceTime = context.arrivalDate ? new Date(context.arrivalDate) : new Date();
        break;
      default:
        referenceTime = new Date();
    }

    // Apply offset (can be negative for tasks due before the event)
    const offsetMs = (trigger.slaOffsetMinutes ?? 0) * 60 * 1000;
    const slaFromOffset = new Date(referenceTime.getTime() + offsetMs);

    // If template has SLA minutes, use whichever is sooner
    if (trigger.OpTaskTemplate.slaMinutes) {
      const slaFromTemplate = new Date(Date.now() + trigger.OpTaskTemplate.slaMinutes * 60 * 1000);
      return slaFromOffset < slaFromTemplate ? slaFromOffset : slaFromTemplate;
    }

    return slaFromOffset;
  }

  /**
   * Interpolate task title with context values
   */
  private interpolateTitle(templateName: string, context: TriggerContext): string {
    let title = templateName;

    if (context.siteName) {
      title = `${title} - ${context.siteName}`;
    }
    if (context.guestName) {
      title = `${title} (${context.guestName})`;
    }

    return title;
  }

  /**
   * Get suggested triggers for a campground
   */
  getSuggestedTriggers(): Partial<CreateOpTaskTriggerDto>[] {
    return [
      {
        name: "Checkout Cleaning",
        triggerEvent: OpTriggerEvent.reservation_checkout,
        slaOffsetMinutes: 120, // 2 hours after checkout
      },
      {
        name: "Check-in Prep",
        triggerEvent: OpTriggerEvent.reservation_checkin,
        slaOffsetMinutes: -120, // 2 hours before check-in
      },
      {
        name: "Long-Stay Deep Clean",
        triggerEvent: OpTriggerEvent.reservation_checkout,
        conditions: { minNights: 14 },
        slaOffsetMinutes: 180, // 3 hours for deep clean
      },
    ];
  }
}

/**
 * Context passed to triggers during execution
 */
export interface TriggerContext {
  reservationId?: string;
  siteId?: string;
  siteClassId?: string;
  siteName?: string;
  guestName?: string;
  userId?: string;
  arrivalDate?: Date;
  departureDate?: Date;
  nights?: number;
  hasPets?: boolean;
  stayType?: string;
}
