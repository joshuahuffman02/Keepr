import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";
import { TasksService } from "../tasks/tasks.service";
import { HousekeepingService } from "./housekeeping.service";
import { randomUUID } from "crypto";

@Injectable()
export class InspectionService {
  constructor(
    private prisma: PrismaService,
    private tasksService: TasksService,
    private housekeepingService: HousekeepingService,
  ) {}

  async submitInspection(data: {
    taskId: string;
    inspectorId: string;
    responses: Array<{ itemId: string; passed: boolean; notes?: string; photo?: string }>;
    notes?: string;
    photos?: string[];
  }) {
    const task = await this.tasksService.findOne(data.taskId);
    if (!task) throw new NotFoundException("Task not found");

    // Calculate inspection results
    const totalItems = data.responses.length;
    const passedItems = data.responses.filter((r) => r.passed).length;
    const failedItems = data.responses.filter((r) => !r.passed).map((r) => r.itemId);
    const score = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 100;

    // Determine overall result
    let overallResult: string;
    if (failedItems.length === 0) {
      overallResult = "passed";
    } else if (failedItems.length >= totalItems / 2) {
      overallResult = "failed";
    } else {
      overallResult = "partial";
    }

    const requiresReclean = overallResult === "failed";

    // Create inspection result
    const inspectionResult = await this.prisma.inspectionResult.create({
      data: {
        id: randomUUID(),
        taskId: data.taskId,
        inspectorId: data.inspectorId,
        responses: data.responses,
        overallResult,
        score,
        failedItems,
        requiresReclean,
        notes: data.notes,
        photos: data.photos ?? [],
      },
    });

    // Update task state based on inspection result
    if (overallResult === "passed") {
      await this.tasksService.update(data.taskId, { state: "done" });
      // Update site to vacant_inspected
      await this.housekeepingService.updateSiteHousekeepingStatus(task.siteId, "vacant_inspected");
    } else if (overallResult === "failed") {
      // Keep task in progress or create new cleaning task
      await this.housekeepingService.updateSiteHousekeepingStatus(task.siteId, "inspection_failed");
    } else {
      // Partial - update to pending_inspection for re-review
      await this.housekeepingService.updateSiteHousekeepingStatus(
        task.siteId,
        "pending_inspection",
      );
    }

    return inspectionResult;
  }

  async getInspectionsByTask(taskId: string) {
    return this.prisma.inspectionResult.findMany({
      where: { taskId },
      include: {
        User: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { completedAt: "desc" },
    });
  }

  async getInspectionById(id: string) {
    const inspection = await this.prisma.inspectionResult.findUnique({
      where: { id },
      include: {
        Task: true,
        User: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!inspection) throw new NotFoundException("Inspection not found");
    return inspection;
  }

  async getInspectionStats(campgroundId: string, dateRange?: { start: Date; end: Date }) {
    const where: Prisma.InspectionResultWhereInput = {
      Task: { tenantId: campgroundId },
    };

    if (dateRange) {
      where.completedAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const inspections = await this.prisma.inspectionResult.findMany({
      where,
      select: {
        overallResult: true,
        score: true,
        requiresReclean: true,
      },
    });

    const total = inspections.length;
    const passed = inspections.filter((i) => i.overallResult === "passed").length;
    const failed = inspections.filter((i) => i.overallResult === "failed").length;
    const partial = inspections.filter((i) => i.overallResult === "partial").length;
    const averageScore =
      total > 0 ? Math.round(inspections.reduce((sum, i) => sum + (i.score ?? 0), 0) / total) : 0;
    const recleanRate =
      total > 0
        ? Math.round((inspections.filter((i) => i.requiresReclean).length / total) * 100)
        : 0;

    return {
      total,
      passed,
      failed,
      partial,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      averageScore,
      recleanRate,
    };
  }

  async triggerReclean(inspectionId: string, createdBy: string) {
    const inspection = await this.getInspectionById(inspectionId);
    if (!inspection.requiresReclean) {
      throw new BadRequestException("This inspection does not require a reclean");
    }

    const task = inspection.Task;

    // Create a new cleaning task based on the failed inspection
    const newTask = await this.tasksService.create({
      tenantId: task.tenantId,
      type: "turnover",
      siteId: task.siteId,
      reservationId: task.reservationId ?? undefined,
      priority: "high",
      notes: `Reclean required after failed inspection. Failed items: ${inspection.failedItems.join(", ")}`,
      source: `reclean:${inspectionId}`,
      createdBy,
    });

    // Update site status
    await this.housekeepingService.updateSiteHousekeepingStatus(task.siteId, "vacant_dirty");

    return newTask;
  }
}
