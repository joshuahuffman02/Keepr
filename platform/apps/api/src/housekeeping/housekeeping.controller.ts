import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { HousekeepingService } from "./housekeeping.service";
import { InspectionService } from "./inspection.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { TaskType, SiteType, type Prisma } from "@prisma/client";

@Controller("housekeeping")
@UseGuards(JwtAuthGuard, ScopeGuard)
export class HousekeepingController {
  constructor(
    private housekeepingService: HousekeepingService,
    private inspectionService: InspectionService,
  ) {}

  // ==================== CLEANING TASK TEMPLATES ====================

  @Post("templates")
  createTemplate(
    @Body()
    body: {
      campgroundId: string;
      taskType: TaskType;
      siteType?: SiteType;
      name: string;
      estimatedMinutes: number;
      checklist: Prisma.InputJsonValue;
      suppliesNeeded?: Prisma.InputJsonValue;
      priority?: number;
      slaMinutes?: number;
      requiresInspection?: boolean;
    },
  ) {
    return this.housekeepingService.createTemplate(body);
  }

  @Get("templates")
  findAllTemplates(
    @Query("campgroundId") campgroundId: string,
    @Query("taskType") taskType?: TaskType,
    @Query("siteType") siteType?: SiteType,
    @Query("isActive") isActive?: string,
  ) {
    return this.housekeepingService.findAllTemplates(campgroundId, {
      taskType,
      siteType,
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
    });
  }

  @Get("templates/:id")
  findTemplateById(@Param("id") id: string) {
    return this.housekeepingService.findTemplateById(id);
  }

  @Patch("templates/:id")
  updateTemplate(
    @Param("id") id: string,
    @Body()
    body: Partial<{
      name: string;
      estimatedMinutes: number;
      checklist: Prisma.InputJsonValue;
      suppliesNeeded: Prisma.InputJsonValue;
      priority: number;
      slaMinutes: number;
      requiresInspection: boolean;
      isActive: boolean;
    }>,
  ) {
    return this.housekeepingService.updateTemplate(id, body);
  }

  @Delete("templates/:id")
  deleteTemplate(@Param("id") id: string) {
    return this.housekeepingService.deleteTemplate(id);
  }

  // ==================== CLEANING ZONES ====================

  @Post("zones")
  createZone(
    @Body()
    body: {
      campgroundId: string;
      name: string;
      zoneType: string;
      parentZoneId?: string;
      primaryTeamId?: string;
      color?: string;
    },
  ) {
    return this.housekeepingService.createZone(body);
  }

  @Get("zones")
  findAllZones(@Query("campgroundId") campgroundId: string) {
    return this.housekeepingService.findAllZones(campgroundId);
  }

  @Get("zones/:id")
  findZoneById(@Param("id") id: string) {
    return this.housekeepingService.findZoneById(id);
  }

  @Patch("zones/:id")
  updateZone(
    @Param("id") id: string,
    @Body()
    body: Partial<{
      name: string;
      zoneType: string;
      parentZoneId: string;
      primaryTeamId: string;
      color: string;
    }>,
  ) {
    return this.housekeepingService.updateZone(id, body);
  }

  @Delete("zones/:id")
  deleteZone(@Param("id") id: string) {
    return this.housekeepingService.deleteZone(id);
  }

  // ==================== SITE HOUSEKEEPING STATUS ====================

  @Patch("sites/:siteId/status")
  updateSiteStatus(@Param("siteId") siteId: string, @Body() body: { status: string }) {
    return this.housekeepingService.updateSiteHousekeepingStatus(siteId, body.status);
  }

  @Get("sites")
  getSitesByStatus(@Query("campgroundId") campgroundId: string, @Query("status") status?: string) {
    return this.housekeepingService.getSitesByHousekeepingStatus(campgroundId, status);
  }

  @Get("stats")
  getHousekeepingStats(@Query("campgroundId") campgroundId: string) {
    return this.housekeepingService.getHousekeepingStats(campgroundId);
  }

  // ==================== TASK CREATION FROM TEMPLATES ====================

  @Post("tasks/from-template")
  createTaskFromTemplate(
    @Body()
    body: {
      templateId: string;
      tenantId: string;
      siteId: string;
      reservationId?: string;
      assignedToUserId?: string;
      assignedToTeamId?: string;
      notes?: string;
      createdBy: string;
    },
  ) {
    return this.housekeepingService.createTaskFromTemplate(body);
  }

  // ==================== DAILY SCHEDULE ====================

  @Get("schedule/daily")
  getDailySchedule(@Query("campgroundId") campgroundId: string, @Query("date") dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    return this.housekeepingService.generateDailySchedule(campgroundId, date);
  }

  // ==================== WORKLOAD ====================

  @Get("workload")
  getStaffWorkload(@Query("campgroundId") campgroundId: string, @Query("date") dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    return this.housekeepingService.getStaffWorkload(campgroundId, date);
  }

  // ==================== INSPECTIONS ====================

  @Post("inspections")
  submitInspection(
    @Body()
    body: {
      taskId: string;
      inspectorId: string;
      responses: Array<{ itemId: string; passed: boolean; notes?: string; photo?: string }>;
      notes?: string;
      photos?: string[];
    },
  ) {
    return this.inspectionService.submitInspection(body);
  }

  @Get("inspections/task/:taskId")
  getInspectionsByTask(@Param("taskId") taskId: string) {
    return this.inspectionService.getInspectionsByTask(taskId);
  }

  @Get("inspections/:id")
  getInspectionById(@Param("id") id: string) {
    return this.inspectionService.getInspectionById(id);
  }

  @Get("inspections/stats")
  getInspectionStats(
    @Query("campgroundId") campgroundId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const dateRange =
      startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : undefined;
    return this.inspectionService.getInspectionStats(campgroundId, dateRange);
  }

  @Post("inspections/:id/reclean")
  triggerReclean(@Param("id") id: string, @Body() body: { createdBy: string }) {
    return this.inspectionService.triggerReclean(id, body.createdBy);
  }
}
