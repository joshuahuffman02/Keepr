import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OpTaskTemplate, OpTaskCategory, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { CreateOpTaskTemplateDto, UpdateOpTaskTemplateDto } from "../dto/op-task.dto";

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
export class OpTemplateService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new task template
   */
  async create(campgroundId: string, dto: CreateOpTaskTemplateDto): Promise<OpTaskTemplate> {
    return this.prisma.opTaskTemplate.create({
      data: {
        id: randomUUID(),
        campgroundId,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        priority: dto.priority ?? "medium",
        checklistTemplate: toNullableJsonInput(dto.checklistTemplate ?? []),
        suppliesNeeded: toNullableJsonInput(dto.suppliesNeeded ?? []),
        estimatedMinutes: dto.estimatedMinutes,
        slaMinutes: dto.slaMinutes,
        defaultTeamId: dto.defaultTeamId,
        defaultAssigneeId: dto.defaultAssigneeId,
        siteClassIds: dto.siteClassIds ?? [],
        siteIds: dto.siteIds ?? [],
        xpValue: dto.xpValue ?? 10,
        isActive: true,
        updatedAt: new Date(),
      },
      include: {
        OpTeam: true,
        User: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Find all templates for a campground
   */
  async findAll(
    campgroundId: string,
    options?: {
      category?: OpTaskCategory;
      isActive?: boolean;
    },
  ): Promise<OpTaskTemplate[]> {
    return this.prisma.opTaskTemplate.findMany({
      where: {
        campgroundId,
        ...(options?.category && { category: options.category }),
        ...(options?.isActive !== undefined && { isActive: options.isActive }),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        OpTeam: true,
        User: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { OpTask: true, OpTaskTrigger: true, OpRecurrenceRule: true } },
      },
    });
  }

  /**
   * Find a single template by ID
   */
  async findOne(id: string): Promise<OpTaskTemplate> {
    const template = await this.prisma.opTaskTemplate.findUnique({
      where: { id },
      include: {
        OpTeam: true,
        User: { select: { id: true, firstName: true, lastName: true } },
        OpTaskTrigger: { where: { isActive: true } },
        OpRecurrenceRule: { where: { isActive: true } },
        _count: { select: { OpTask: true } },
      },
    });

    if (!template) {
      throw new NotFoundException("Template not found");
    }

    return template;
  }

  /**
   * Update a template
   */
  async update(id: string, dto: UpdateOpTaskTemplateDto): Promise<OpTaskTemplate> {
    const existing = await this.prisma.opTaskTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Template not found");
    }

    return this.prisma.opTaskTemplate.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.checklistTemplate !== undefined && {
          checklistTemplate: toNullableJsonInput(dto.checklistTemplate),
        }),
        ...(dto.suppliesNeeded !== undefined && {
          suppliesNeeded: toNullableJsonInput(dto.suppliesNeeded),
        }),
        ...(dto.estimatedMinutes !== undefined && { estimatedMinutes: dto.estimatedMinutes }),
        ...(dto.slaMinutes !== undefined && { slaMinutes: dto.slaMinutes }),
        ...(dto.defaultTeamId !== undefined && { defaultTeamId: dto.defaultTeamId }),
        ...(dto.defaultAssigneeId !== undefined && { defaultAssigneeId: dto.defaultAssigneeId }),
        ...(dto.siteClassIds !== undefined && { siteClassIds: dto.siteClassIds }),
        ...(dto.siteIds !== undefined && { siteIds: dto.siteIds }),
        ...(dto.xpValue !== undefined && { xpValue: dto.xpValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      },
      include: {
        OpTeam: true,
        User: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Delete a template (soft delete by deactivating)
   */
  async delete(id: string): Promise<void> {
    const existing = await this.prisma.opTaskTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { OpTaskTrigger: true, OpRecurrenceRule: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException("Template not found");
    }

    // Check if template is in use
    const activeConnections =
      (existing._count?.OpTaskTrigger ?? 0) + (existing._count?.OpRecurrenceRule ?? 0);

    if (activeConnections > 0) {
      throw new ConflictException(
        "Cannot delete template with active triggers or recurrence rules. Deactivate them first.",
      );
    }

    await this.prisma.opTaskTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Duplicate a template
   */
  async duplicate(id: string, newName?: string): Promise<OpTaskTemplate> {
    const original = await this.prisma.opTaskTemplate.findUnique({
      where: { id },
    });

    if (!original) {
      throw new NotFoundException("Template not found");
    }

    return this.prisma.opTaskTemplate.create({
      data: {
        id: randomUUID(),
        campgroundId: original.campgroundId,
        name: newName ?? `${original.name} (Copy)`,
        description: original.description,
        category: original.category,
        priority: original.priority,
        checklistTemplate: toNullableJsonInput(original.checklistTemplate ?? []),
        suppliesNeeded: toNullableJsonInput(original.suppliesNeeded ?? []),
        estimatedMinutes: original.estimatedMinutes,
        slaMinutes: original.slaMinutes,
        defaultTeamId: original.defaultTeamId,
        defaultAssigneeId: original.defaultAssigneeId,
        siteClassIds: original.siteClassIds,
        siteIds: original.siteIds,
        xpValue: original.xpValue,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get starter templates for new campgrounds
   */
  getStarterTemplates(): CreateOpTaskTemplateDto[] {
    return [
      {
        name: "Cabin Turnover",
        description: "Full turnover cleaning after guest checkout",
        category: "turnover",
        priority: "high",
        slaMinutes: 120, // 2 hours
        estimatedMinutes: 45,
        xpValue: 25,
        checklistTemplate: [
          { id: "ct-1", text: "Strip and remake beds with fresh linens", required: true },
          { id: "ct-2", text: "Vacuum/sweep all floors", required: true },
          { id: "ct-3", text: "Clean bathroom (toilet, sink, shower)", required: true },
          { id: "ct-4", text: "Wipe down all surfaces", required: true },
          { id: "ct-5", text: "Restock toiletries and supplies", required: true },
          { id: "ct-6", text: "Empty trash and recycling", required: true },
          { id: "ct-7", text: "Check for damages and report", required: true },
          { id: "ct-8", text: "Check appliances are working", required: false },
          { id: "ct-9", text: "Set thermostat to default", required: false },
        ],
      },
      {
        name: "RV Site Turnover",
        description: "Quick site cleanup after RV departure",
        category: "turnover",
        priority: "medium",
        slaMinutes: 60, // 1 hour
        estimatedMinutes: 15,
        xpValue: 10,
        checklistTemplate: [
          { id: "rv-1", text: "Rake and clean pad area", required: true },
          { id: "rv-2", text: "Check and clean fire ring", required: true },
          { id: "rv-3", text: "Verify hookups are capped and clean", required: true },
          { id: "rv-4", text: "Check picnic table condition", required: true },
          { id: "rv-5", text: "Report any damage or issues", required: true },
        ],
      },
      {
        name: "Daily Bathroom Cleaning",
        description: "Routine cleaning of public restroom facilities",
        category: "housekeeping",
        priority: "medium",
        slaMinutes: 30,
        estimatedMinutes: 20,
        xpValue: 15,
        checklistTemplate: [
          { id: "br-1", text: "Clean and sanitize toilets", required: true },
          { id: "br-2", text: "Clean sinks and mirrors", required: true },
          { id: "br-3", text: "Mop floors", required: true },
          { id: "br-4", text: "Restock paper products", required: true },
          { id: "br-5", text: "Restock soap dispensers", required: true },
          { id: "br-6", text: "Empty trash bins", required: true },
          { id: "br-7", text: "Check for maintenance issues", required: false },
        ],
      },
      {
        name: "Deep Bathroom Clean",
        description: "Weekly deep cleaning of restroom facilities",
        category: "housekeeping",
        priority: "low",
        slaMinutes: 90,
        estimatedMinutes: 45,
        xpValue: 20,
        checklistTemplate: [
          { id: "dbc-1", text: "Complete daily cleaning checklist first", required: true },
          { id: "dbc-2", text: "Scrub shower walls and floors", required: true },
          { id: "dbc-3", text: "Clean all vents and exhaust fans", required: true },
          { id: "dbc-4", text: "Wash walls and partitions", required: true },
          { id: "dbc-5", text: "Clean light fixtures", required: false },
          { id: "dbc-6", text: "Check and replace any damaged fixtures", required: false },
        ],
      },
      {
        name: "Pool Daily Maintenance",
        description: "Daily pool water testing and maintenance",
        category: "pool",
        priority: "high",
        slaMinutes: 60,
        estimatedMinutes: 30,
        xpValue: 15,
        checklistTemplate: [
          { id: "pool-1", text: "Test water chemistry (pH, chlorine)", required: true },
          { id: "pool-2", text: "Record readings in log", required: true },
          { id: "pool-3", text: "Skim surface for debris", required: true },
          { id: "pool-4", text: "Check pump and filter operation", required: true },
          { id: "pool-5", text: "Inspect pool area for safety hazards", required: true },
          { id: "pool-6", text: "Organize furniture and equipment", required: false },
        ],
      },
      {
        name: "Garbage Collection",
        description: "Daily garbage and recycling collection route",
        category: "grounds",
        priority: "medium",
        slaMinutes: 120,
        estimatedMinutes: 60,
        xpValue: 15,
        checklistTemplate: [
          { id: "gc-1", text: "Collect all site garbage cans", required: true },
          { id: "gc-2", text: "Collect recycling bins", required: true },
          { id: "gc-3", text: "Empty common area bins", required: true },
          { id: "gc-4", text: "Check dumpster levels", required: true },
          { id: "gc-5", text: "Report any overflowing or damaged bins", required: false },
        ],
      },
      {
        name: "Check-in Prep",
        description: "Prepare for guest arrival",
        category: "front_desk",
        priority: "high",
        slaMinutes: 30,
        estimatedMinutes: 10,
        xpValue: 10,
        checklistTemplate: [
          { id: "cip-1", text: "Verify payment status", required: true },
          { id: "cip-2", text: "Check site assignment is ready", required: true },
          { id: "cip-3", text: "Prepare welcome packet", required: true },
          { id: "cip-4", text: "Note any special requests", required: true },
          { id: "cip-5", text: "Confirm gate code/key ready", required: false },
        ],
      },
    ];
  }

  /**
   * Seed starter templates for a campground
   */
  async seedStarterTemplates(campgroundId: string): Promise<OpTaskTemplate[]> {
    const starters = this.getStarterTemplates();
    const created: OpTaskTemplate[] = [];

    for (const template of starters) {
      const existing = await this.prisma.opTaskTemplate.findFirst({
        where: { campgroundId, name: template.name },
      });

      if (!existing) {
        const newTemplate = await this.create(campgroundId, template);
        created.push(newTemplate);
      }
    }

    return created;
  }
}
