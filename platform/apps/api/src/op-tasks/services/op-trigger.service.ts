import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OpTaskTrigger,
  OpTriggerEvent,
  OpTask,
  Reservation,
  Site,
  OpTaskState,
} from '@prisma/client';
import {
  CreateOpTaskTriggerDto,
  UpdateOpTaskTriggerDto,
  TriggerConditionsDto,
} from '../dto/op-task.dto';

@Injectable()
export class OpTriggerService {
  private readonly logger = new Logger(OpTriggerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new trigger
   */
  async create(
    campgroundId: string,
    dto: CreateOpTaskTriggerDto,
  ): Promise<OpTaskTrigger> {
    // Verify template exists and belongs to campground
    const template = await this.prisma.opTaskTemplate.findFirst({
      where: { id: dto.templateId, campgroundId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.opTaskTrigger.create({
      data: {
        campgroundId,
        name: dto.name,
        triggerEvent: dto.triggerEvent,
        templateId: dto.templateId,
        conditions: dto.conditions ?? {},
        slaOffsetMinutes: dto.slaOffsetMinutes ?? 0,
        assignToTeamId: dto.assignToTeamId,
        assignToUserId: dto.assignToUserId,
        isActive: true,
      },
      include: {
        template: true,
        assignToTeam: true,
        assignToUser: { select: { id: true, firstName: true, lastName: true } },
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
      orderBy: [{ triggerEvent: 'asc' }, { name: 'asc' }],
      include: {
        template: true,
        assignToTeam: true,
        assignToUser: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { tasks: true } },
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
        template: true,
        assignToTeam: true,
        assignToUser: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { tasks: true } },
      },
    });

    if (!trigger) {
      throw new NotFoundException('Trigger not found');
    }

    return trigger;
  }

  /**
   * Update a trigger
   */
  async update(id: string, dto: UpdateOpTaskTriggerDto): Promise<OpTaskTrigger> {
    const existing = await this.prisma.opTaskTrigger.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Trigger not found');
    }

    if (dto.templateId) {
      const template = await this.prisma.opTaskTemplate.findFirst({
        where: { id: dto.templateId, campgroundId: existing.campgroundId },
      });
      if (!template) {
        throw new NotFoundException('Template not found');
      }
    }

    return this.prisma.opTaskTrigger.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.triggerEvent && { triggerEvent: dto.triggerEvent }),
        ...(dto.templateId && { templateId: dto.templateId }),
        ...(dto.conditions !== undefined && { conditions: dto.conditions ?? {} }),
        ...(dto.slaOffsetMinutes !== undefined && { slaOffsetMinutes: dto.slaOffsetMinutes }),
        ...(dto.assignToTeamId !== undefined && { assignToTeamId: dto.assignToTeamId }),
        ...(dto.assignToUserId !== undefined && { assignToUserId: dto.assignToUserId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        template: true,
        assignToTeam: true,
        assignToUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Delete a trigger
   */
  async delete(id: string): Promise<void> {
    const existing = await this.prisma.opTaskTrigger.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Trigger not found');
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
      include: { template: true },
    });

    if (triggers.length === 0) {
      this.logger.debug(`No triggers found for event ${event} in campground ${campgroundId}`);
      return [];
    }

    const createdTasks: OpTask[] = [];

    for (const trigger of triggers) {
      try {
        // Check if conditions are met
        if (!this.checkConditions(trigger.conditions as TriggerConditionsDto, context)) {
          this.logger.debug(`Trigger ${trigger.id} conditions not met, skipping`);
          continue;
        }

        // Calculate SLA due time
        const slaDueAt = this.calculateSlaDueTime(trigger, context);

        // Create the task
        const task = await this.prisma.opTask.create({
          data: {
            campgroundId,
            category: trigger.template.category,
            title: this.interpolateTitle(trigger.template.name, context),
            description: trigger.template.description,
            priority: trigger.template.priority,
            siteId: context.siteId,
            reservationId: context.reservationId,
            assignedToUserId: trigger.assignToUserId ?? trigger.template.defaultAssigneeId,
            assignedToTeamId: trigger.assignToTeamId ?? trigger.template.defaultTeamId,
            slaDueAt,
            slaStatus: 'on_track',
            checklist: trigger.template.checklistTemplate
              ? (trigger.template.checklistTemplate as any[]).map((item) => ({
                  ...item,
                  completed: false,
                }))
              : null,
            checklistProgress: 0,
            templateId: trigger.templateId,
            triggerId: trigger.id,
            sourceEvent: event,
            createdById: context.userId ?? 'system',
            state: trigger.assignToUserId || trigger.assignToTeamId
              ? OpTaskState.assigned
              : OpTaskState.pending,
          },
        });

        createdTasks.push(task);
        this.logger.log(`Created task ${task.id} from trigger ${trigger.id} for event ${event}`);
      } catch (error) {
        this.logger.error(`Failed to execute trigger ${trigger.id}: ${error.message}`);
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
  private calculateSlaDueTime(
    trigger: OpTaskTrigger & { template: any },
    context: TriggerContext,
  ): Date {
    // Get reference time based on event type
    let referenceTime: Date;

    switch (trigger.triggerEvent) {
      case OpTriggerEvent.reservation_checkout:
        referenceTime = context.departureDate
          ? new Date(context.departureDate)
          : new Date();
        break;
      case OpTriggerEvent.reservation_checkin:
        referenceTime = context.arrivalDate
          ? new Date(context.arrivalDate)
          : new Date();
        break;
      default:
        referenceTime = new Date();
    }

    // Apply offset (can be negative for tasks due before the event)
    const offsetMs = (trigger.slaOffsetMinutes ?? 0) * 60 * 1000;
    const slaFromOffset = new Date(referenceTime.getTime() + offsetMs);

    // If template has SLA minutes, use whichever is sooner
    if (trigger.template.slaMinutes) {
      const slaFromTemplate = new Date(
        Date.now() + trigger.template.slaMinutes * 60 * 1000,
      );
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
        name: 'Checkout Cleaning',
        triggerEvent: OpTriggerEvent.reservation_checkout,
        slaOffsetMinutes: 120, // 2 hours after checkout
      },
      {
        name: 'Check-in Prep',
        triggerEvent: OpTriggerEvent.reservation_checkin,
        slaOffsetMinutes: -120, // 2 hours before check-in
      },
      {
        name: 'Long-Stay Deep Clean',
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
