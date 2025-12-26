import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OpRecurrenceRule,
  OpRecurrencePattern,
  OpTask,
  OpTaskState,
  OpTriggerEvent,
} from '@prisma/client';
import {
  CreateOpRecurrenceRuleDto,
  UpdateOpRecurrenceRuleDto,
} from '../dto/op-task.dto';

@Injectable()
export class OpRecurrenceService {
  private readonly logger = new Logger(OpRecurrenceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new recurrence rule
   */
  async create(
    campgroundId: string,
    dto: CreateOpRecurrenceRuleDto,
  ): Promise<OpRecurrenceRule> {
    // Verify template exists
    const template = await this.prisma.opTaskTemplate.findFirst({
      where: { id: dto.templateId, campgroundId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Calculate next generation time
    const nextGenerationAt = this.calculateNextGeneration(
      dto.pattern,
      dto.daysOfWeek ?? [],
      dto.daysOfMonth ?? [],
      dto.generateAtHour ?? 6,
      dto.generateAtMinute ?? 0,
    );

    return this.prisma.opRecurrenceRule.create({
      data: {
        campgroundId,
        name: dto.name,
        templateId: dto.templateId,
        pattern: dto.pattern,
        daysOfWeek: dto.daysOfWeek ?? [],
        daysOfMonth: dto.daysOfMonth ?? [],
        generateAtHour: dto.generateAtHour ?? 6,
        generateAtMinute: dto.generateAtMinute ?? 0,
        siteClassIds: dto.siteClassIds ?? [],
        siteIds: dto.siteIds ?? [],
        locationFilter: dto.locationFilter,
        assignToTeamId: dto.assignToTeamId,
        assignToUserId: dto.assignToUserId,
        nextGenerationAt,
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
   * Find all recurrence rules for a campground
   */
  async findAll(
    campgroundId: string,
    options?: { pattern?: OpRecurrencePattern; isActive?: boolean },
  ): Promise<OpRecurrenceRule[]> {
    return this.prisma.opRecurrenceRule.findMany({
      where: {
        campgroundId,
        ...(options?.pattern && { pattern: options.pattern }),
        ...(options?.isActive !== undefined && { isActive: options.isActive }),
      },
      orderBy: [{ pattern: 'asc' }, { name: 'asc' }],
      include: {
        template: true,
        assignToTeam: true,
        assignToUser: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { tasks: true } },
      },
    });
  }

  /**
   * Find a single recurrence rule by ID
   */
  async findOne(id: string): Promise<OpRecurrenceRule> {
    const rule = await this.prisma.opRecurrenceRule.findUnique({
      where: { id },
      include: {
        template: true,
        assignToTeam: true,
        assignToUser: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { tasks: true } },
      },
    });

    if (!rule) {
      throw new NotFoundException('Recurrence rule not found');
    }

    return rule;
  }

  /**
   * Update a recurrence rule
   */
  async update(id: string, dto: UpdateOpRecurrenceRuleDto): Promise<OpRecurrenceRule> {
    const existing = await this.prisma.opRecurrenceRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Recurrence rule not found');
    }

    if (dto.templateId) {
      const template = await this.prisma.opTaskTemplate.findFirst({
        where: { id: dto.templateId, campgroundId: existing.campgroundId },
      });
      if (!template) {
        throw new NotFoundException('Template not found');
      }
    }

    // Recalculate next generation if schedule changed
    let nextGenerationAt = existing.nextGenerationAt;
    if (dto.pattern || dto.daysOfWeek || dto.daysOfMonth || dto.generateAtHour !== undefined) {
      nextGenerationAt = this.calculateNextGeneration(
        dto.pattern ?? existing.pattern,
        dto.daysOfWeek ?? existing.daysOfWeek,
        dto.daysOfMonth ?? existing.daysOfMonth,
        dto.generateAtHour ?? existing.generateAtHour,
        dto.generateAtMinute ?? existing.generateAtMinute,
      );
    }

    return this.prisma.opRecurrenceRule.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.templateId && { templateId: dto.templateId }),
        ...(dto.pattern && { pattern: dto.pattern }),
        ...(dto.daysOfWeek && { daysOfWeek: dto.daysOfWeek }),
        ...(dto.daysOfMonth && { daysOfMonth: dto.daysOfMonth }),
        ...(dto.generateAtHour !== undefined && { generateAtHour: dto.generateAtHour }),
        ...(dto.generateAtMinute !== undefined && { generateAtMinute: dto.generateAtMinute }),
        ...(dto.siteClassIds && { siteClassIds: dto.siteClassIds }),
        ...(dto.siteIds && { siteIds: dto.siteIds }),
        ...(dto.locationFilter !== undefined && { locationFilter: dto.locationFilter }),
        ...(dto.assignToTeamId !== undefined && { assignToTeamId: dto.assignToTeamId }),
        ...(dto.assignToUserId !== undefined && { assignToUserId: dto.assignToUserId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        nextGenerationAt,
      },
      include: {
        template: true,
        assignToTeam: true,
        assignToUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Delete a recurrence rule
   */
  async delete(id: string): Promise<void> {
    const existing = await this.prisma.opRecurrenceRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Recurrence rule not found');
    }

    await this.prisma.opRecurrenceRule.delete({ where: { id } });
  }

  /**
   * Cron job to process recurrence rules every 15 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processRecurrenceRules(): Promise<void> {
    this.logger.log('Processing recurrence rules...');

    const now = new Date();

    // Find rules that are due to generate
    const dueRules = await this.prisma.opRecurrenceRule.findMany({
      where: {
        isActive: true,
        nextGenerationAt: { lte: now },
      },
      include: {
        template: true,
        campground: { select: { timezone: true, seasonStart: true, seasonEnd: true } },
      },
    });

    this.logger.log(`Found ${dueRules.length} rules due for generation`);

    for (const rule of dueRules) {
      try {
        await this.generateTasksForRule(rule);
      } catch (error: unknown) {
        this.logger.error(`Failed to generate tasks for rule ${rule.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Generate tasks for a specific rule
   */
  async generateTasksForRule(
    rule: OpRecurrenceRule & { template: any; campground?: any },
  ): Promise<OpTask[]> {
    // Check seasonal rules
    if (rule.pattern === OpRecurrencePattern.seasonal) {
      const campground = rule.campground ?? await this.prisma.campground.findUnique({
        where: { id: rule.campgroundId },
        select: { seasonStart: true, seasonEnd: true },
      });

      if (campground?.seasonStart && campground?.seasonEnd) {
        const now = new Date();
        const seasonStart = new Date(campground.seasonStart);
        const seasonEnd = new Date(campground.seasonEnd);

        // Normalize to current year
        seasonStart.setFullYear(now.getFullYear());
        seasonEnd.setFullYear(now.getFullYear());

        if (now < seasonStart || now > seasonEnd) {
          this.logger.debug(`Rule ${rule.id} skipped - outside season`);
          // Still update next generation time
          await this.updateNextGeneration(rule);
          return [];
        }
      }
    }

    // Get sites to create tasks for
    const sites = await this.getSitesForRule(rule);
    const createdTasks: OpTask[] = [];

    // For location-based tasks (not site-specific)
    if (rule.locationFilter && sites.length === 0) {
      const task = await this.createTaskFromRule(rule, null, rule.locationFilter);
      if (task) createdTasks.push(task);
    }

    // For site-specific tasks
    for (const site of sites) {
      const task = await this.createTaskFromRule(rule, site.id, site.name);
      if (task) createdTasks.push(task);
    }

    // Update last/next generation times
    await this.updateNextGeneration(rule);

    this.logger.log(`Generated ${createdTasks.length} tasks for rule ${rule.id}`);
    return createdTasks;
  }

  /**
   * Create a single task from a recurrence rule
   */
  private async createTaskFromRule(
    rule: OpRecurrenceRule & { template: any },
    siteId: string | null,
    locationDesc?: string,
  ): Promise<OpTask | null> {
    // Check if task already exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await this.prisma.opTask.findFirst({
      where: {
        recurrenceRuleId: rule.id,
        siteId: siteId,
        locationDescription: locationDesc,
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    if (existing) {
      this.logger.debug(`Task already exists for rule ${rule.id} today, skipping`);
      return null;
    }

    // Calculate SLA due time
    const slaDueAt = rule.template.slaMinutes
      ? new Date(Date.now() + rule.template.slaMinutes * 60 * 1000)
      : null;

    return this.prisma.opTask.create({
      data: {
        campgroundId: rule.campgroundId,
        category: rule.template.category,
        title: siteId
          ? `${rule.template.name} - ${locationDesc}`
          : rule.template.name,
        description: rule.template.description,
        priority: rule.template.priority,
        siteId: siteId,
        locationDescription: siteId ? undefined : locationDesc,
        assignedToUserId: rule.assignToUserId ?? rule.template.defaultAssigneeId,
        assignedToTeamId: rule.assignToTeamId ?? rule.template.defaultTeamId,
        slaDueAt,
        slaStatus: 'on_track',
        checklist: rule.template.checklistTemplate
          ? (rule.template.checklistTemplate as any[]).map((item) => ({
              ...item,
              completed: false,
            }))
          : null,
        checklistProgress: 0,
        templateId: rule.templateId,
        recurrenceRuleId: rule.id,
        sourceEvent: OpTriggerEvent.manual,
        createdById: 'system',
        state: rule.assignToUserId || rule.assignToTeamId
          ? OpTaskState.assigned
          : OpTaskState.pending,
      },
    });
  }

  /**
   * Get sites that match the rule's filters
   */
  private async getSitesForRule(
    rule: OpRecurrenceRule,
  ): Promise<Array<{ id: string; name: string }>> {
    // If location filter is set, this is a non-site task
    if (rule.locationFilter) {
      return [];
    }

    // If specific sites are set, use those
    if (rule.siteIds.length > 0) {
      return this.prisma.site.findMany({
        where: {
          id: { in: rule.siteIds },
          campgroundId: rule.campgroundId,
          isActive: true,
        },
        select: { id: true, name: true },
      });
    }

    // If site classes are set, get all sites in those classes
    if (rule.siteClassIds.length > 0) {
      return this.prisma.site.findMany({
        where: {
          siteClassId: { in: rule.siteClassIds },
          campgroundId: rule.campgroundId,
          isActive: true,
        },
        select: { id: true, name: true },
      });
    }

    // No filters = no site-specific tasks (likely a location-based task)
    return [];
  }

  /**
   * Update the next generation time for a rule
   */
  private async updateNextGeneration(rule: OpRecurrenceRule): Promise<void> {
    const nextGenerationAt = this.calculateNextGeneration(
      rule.pattern,
      rule.daysOfWeek,
      rule.daysOfMonth,
      rule.generateAtHour,
      rule.generateAtMinute,
    );

    await this.prisma.opRecurrenceRule.update({
      where: { id: rule.id },
      data: {
        lastGeneratedAt: new Date(),
        nextGenerationAt,
      },
    });
  }

  /**
   * Calculate the next generation time based on pattern
   */
  private calculateNextGeneration(
    pattern: OpRecurrencePattern,
    daysOfWeek: number[],
    daysOfMonth: number[],
    hour: number,
    minute: number,
  ): Date {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);

    // If today's time has passed, start from tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    switch (pattern) {
      case OpRecurrencePattern.daily:
        // Already set to next occurrence
        break;

      case OpRecurrencePattern.weekly:
        if (daysOfWeek.length > 0) {
          // Find next matching day of week
          while (!daysOfWeek.includes(next.getDay())) {
            next.setDate(next.getDate() + 1);
          }
        }
        break;

      case OpRecurrencePattern.biweekly:
        if (daysOfWeek.length > 0) {
          // Find next matching day of week, then skip a week
          while (!daysOfWeek.includes(next.getDay())) {
            next.setDate(next.getDate() + 1);
          }
          // Check if we need to skip a week (simplified logic)
          const weekNum = Math.floor(next.getDate() / 7);
          if (weekNum % 2 === 1) {
            next.setDate(next.getDate() + 7);
          }
        }
        break;

      case OpRecurrencePattern.monthly:
        if (daysOfMonth.length > 0) {
          // Find next matching day of month
          const currentDay = next.getDate();
          const nextDay = daysOfMonth.find((d) => d >= currentDay);
          if (nextDay) {
            next.setDate(nextDay);
          } else {
            // Move to next month
            next.setMonth(next.getMonth() + 1);
            next.setDate(Math.min(daysOfMonth[0], this.getDaysInMonth(next)));
          }
        }
        break;

      case OpRecurrencePattern.seasonal:
        // Same as daily but will be filtered by season check
        break;
    }

    return next;
  }

  /**
   * Get number of days in a month
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Get suggested recurrence rules
   */
  getSuggestedRules(): Partial<CreateOpRecurrenceRuleDto>[] {
    return [
      {
        name: 'Daily Bathroom Cleaning',
        pattern: OpRecurrencePattern.daily,
        generateAtHour: 7,
        locationFilter: 'Bathhouse A',
      },
      {
        name: 'Weekly Deep Clean (Mon/Fri)',
        pattern: OpRecurrencePattern.weekly,
        daysOfWeek: [1, 5], // Monday and Friday
        generateAtHour: 6,
      },
      {
        name: 'Daily Garbage Collection',
        pattern: OpRecurrencePattern.daily,
        generateAtHour: 8,
      },
      {
        name: 'Pool Daily Check',
        pattern: OpRecurrencePattern.seasonal,
        generateAtHour: 7,
        locationFilter: 'Pool Area',
      },
    ];
  }

  /**
   * Manually trigger generation for a rule (for testing)
   */
  async triggerGeneration(id: string): Promise<OpTask[]> {
    const rule = await this.prisma.opRecurrenceRule.findUnique({
      where: { id },
      include: { template: true, campground: true },
    });

    if (!rule) {
      throw new NotFoundException('Recurrence rule not found');
    }

    return this.generateTasksForRule(rule);
  }
}
