import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskType, SiteType, TaskState } from '@prisma/client';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class HousekeepingService {
  constructor(
    private prisma: PrismaService,
    private tasksService: TasksService,
  ) {}

  // ==================== CLEANING TASK TEMPLATES ====================

  async createTemplate(data: {
    campgroundId: string;
    taskType: TaskType;
    siteType?: SiteType;
    name: string;
    estimatedMinutes: number;
    checklist: any;
    suppliesNeeded?: any;
    priority?: number;
    slaMinutes?: number;
    requiresInspection?: boolean;
  }) {
    return this.prisma.cleaningTaskTemplate.create({
      data: {
        campgroundId: data.campgroundId,
        taskType: data.taskType,
        siteType: data.siteType,
        name: data.name,
        estimatedMinutes: data.estimatedMinutes,
        checklist: data.checklist,
        suppliesNeeded: data.suppliesNeeded,
        priority: data.priority ?? 100,
        slaMinutes: data.slaMinutes,
        requiresInspection: data.requiresInspection ?? false,
        isActive: true,
      },
    });
  }

  async findAllTemplates(campgroundId: string, filters?: { taskType?: TaskType; siteType?: SiteType; isActive?: boolean }) {
    return this.prisma.cleaningTaskTemplate.findMany({
      where: {
        campgroundId,
        taskType: filters?.taskType,
        siteType: filters?.siteType,
        isActive: filters?.isActive,
      },
      orderBy: [{ taskType: 'asc' }, { priority: 'asc' }],
    });
  }

  async findTemplateById(id: string) {
    const template = await this.prisma.cleaningTaskTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async updateTemplate(id: string, data: Partial<{
    name: string;
    estimatedMinutes: number;
    checklist: any;
    suppliesNeeded: any;
    priority: number;
    slaMinutes: number;
    requiresInspection: boolean;
    isActive: boolean;
  }>) {
    return this.prisma.cleaningTaskTemplate.update({
      where: { id },
      data,
    });
  }

  async deleteTemplate(id: string) {
    return this.prisma.cleaningTaskTemplate.delete({ where: { id } });
  }

  // ==================== CLEANING ZONES ====================

  async createZone(data: {
    campgroundId: string;
    name: string;
    zoneType: string;
    parentZoneId?: string;
    primaryTeamId?: string;
    color?: string;
  }) {
    return this.prisma.cleaningZone.create({
      data: {
        campgroundId: data.campgroundId,
        name: data.name,
        zoneType: data.zoneType,
        parentZoneId: data.parentZoneId,
        primaryTeamId: data.primaryTeamId,
        color: data.color,
      },
    });
  }

  async findAllZones(campgroundId: string) {
    return this.prisma.cleaningZone.findMany({
      where: { campgroundId },
      include: {
        childZones: true,
        parentZone: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findZoneById(id: string) {
    const zone = await this.prisma.cleaningZone.findUnique({
      where: { id },
      include: { childZones: true, parentZone: true },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }

  async updateZone(id: string, data: Partial<{
    name: string;
    zoneType: string;
    parentZoneId: string;
    primaryTeamId: string;
    color: string;
  }>) {
    return this.prisma.cleaningZone.update({
      where: { id },
      data,
    });
  }

  async deleteZone(id: string) {
    return this.prisma.cleaningZone.delete({ where: { id } });
  }

  // ==================== SITE HOUSEKEEPING STATUS ====================

  async updateSiteHousekeepingStatus(siteId: string, status: string) {
    return this.prisma.site.update({
      where: { id: siteId },
      data: { housekeepingStatus: status },
    });
  }

  async getSitesByHousekeepingStatus(campgroundId: string, status?: string) {
    return this.prisma.site.findMany({
      where: {
        campgroundId,
        isActive: true,
        housekeepingStatus: status,
      },
      include: {
        siteClass: true,
        structureAttributes: true,
      },
      orderBy: [{ zone: 'asc' }, { siteNumber: 'asc' }],
    });
  }

  async getHousekeepingStats(campgroundId: string) {
    const sites = await this.prisma.site.findMany({
      where: { campgroundId, isActive: true },
      select: { housekeepingStatus: true },
    });

    const stats: Record<string, number> = {};
    for (const site of sites) {
      const status = site.housekeepingStatus;
      stats[status] = (stats[status] || 0) + 1;
    }

    return {
      total: sites.length,
      byStatus: stats,
    };
  }

  // ==================== TASK CREATION FROM TEMPLATES ====================

  async createTaskFromTemplate(data: {
    templateId: string;
    tenantId: string;
    siteId: string;
    reservationId?: string;
    assignedToUserId?: string;
    assignedToTeamId?: string;
    notes?: string;
    createdBy: string;
  }) {
    const template = await this.findTemplateById(data.templateId);

    // Calculate SLA due time from template
    const slaDueAt = template.slaMinutes
      ? new Date(Date.now() + template.slaMinutes * 60 * 1000).toISOString()
      : undefined;

    const task = await this.tasksService.create({
      tenantId: data.tenantId,
      type: template.taskType,
      siteId: data.siteId,
      reservationId: data.reservationId,
      priority: String(template.priority),
      slaDueAt,
      checklist: template.checklist,
      assignedToUserId: data.assignedToUserId,
      assignedToTeamId: data.assignedToTeamId,
      notes: data.notes,
      source: `template:${data.templateId}`,
      createdBy: data.createdBy,
    });

    // Update the task with templateId reference
    await this.prisma.task.update({
      where: { id: task.id },
      data: { templateId: data.templateId },
    });

    // Update site housekeeping status
    await this.updateSiteHousekeepingStatus(data.siteId, 'cleaning_in_progress');

    return task;
  }

  // ==================== DAILY HOUSEKEEPING SCHEDULE ====================

  async generateDailySchedule(campgroundId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all checkouts for this date
    const checkouts = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        departureDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['confirmed', 'checked_in'] },
      },
      include: {
        site: true,
        guest: true,
      },
    });

    // Find all checkins for this date
    const checkins = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        arrivalDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['confirmed', 'pending'] },
      },
      include: {
        site: true,
        guest: true,
      },
    });

    // Find stayover reservations (occupied rooms that need service)
    const stayovers = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        arrivalDate: { lt: startOfDay },
        departureDate: { gt: endOfDay },
        status: 'checked_in',
      },
      include: {
        site: true,
      },
    });

    // Calculate turnovers (checkout followed by checkin on same site)
    const checkoutSiteIds = new Set(checkouts.map(r => r.siteId));
    const checkinSiteIds = new Set(checkins.map(r => r.siteId));
    const turnovers = [...checkoutSiteIds].filter(id => checkinSiteIds.has(id));

    // Identify priority units (early arrivals, VIPs)
    const priorityCheckins = checkins.filter(r =>
      r.earlyCheckInApproved || r.guest.vip
    );

    return {
      date: date.toISOString().split('T')[0],
      expectedCheckouts: checkouts.map(r => ({
        reservationId: r.id,
        siteId: r.siteId,
        siteName: r.site.name,
        guestName: `${r.guest.primaryFirstName} ${r.guest.primaryLastName}`,
        checkoutTime: r.lateCheckoutRequested ?? undefined,
      })),
      expectedCheckins: checkins.map(r => ({
        reservationId: r.id,
        siteId: r.siteId,
        siteName: r.site.name,
        guestName: `${r.guest.primaryFirstName} ${r.guest.primaryLastName}`,
        isVIP: r.guest.vip,
        isEarlyArrival: !!r.earlyCheckInApproved,
      })),
      stayoverServices: stayovers.length,
      totalTurnovers: turnovers.length,
      priorityUnits: priorityCheckins.map(r => r.siteId),
      summary: {
        checkouts: checkouts.length,
        checkins: checkins.length,
        turnovers: turnovers.length,
        stayovers: stayovers.length,
        priorityCount: priorityCheckins.length,
      },
    };
  }

  // ==================== WORKLOAD BALANCING ====================

  async getStaffWorkload(campgroundId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get tasks for today grouped by assignee
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId: campgroundId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const workload: Record<string, { total: number; completed: number; inProgress: number; pending: number }> = {};

    for (const task of tasks) {
      const userId = task.assignedToUserId || 'unassigned';
      if (!workload[userId]) {
        workload[userId] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
      }
      workload[userId].total++;
      if (task.state === 'done') workload[userId].completed++;
      else if (task.state === 'in_progress') workload[userId].inProgress++;
      else if (task.state === 'pending') workload[userId].pending++;
    }

    return workload;
  }
}
