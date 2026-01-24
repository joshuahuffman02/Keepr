import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Task, TaskState } from "@prisma/client";

export interface TaskBundle {
  siteId: string;
  siteNumber: string; // from included site
  bundlePriority: number; // calculated from task priorities
  slaStatus: "on_track" | "at_risk" | "breached";
  taskCount: number;
  tasks: Task[];
}

@Injectable()
export class TaskBundlerService {
  constructor(private readonly prisma: PrismaService) {}

  async getBundles(tenantId: string): Promise<TaskBundle[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId,
        state: "pending",
        siteId: { not: "" }, // exclude tasks without sites if any
      },
      include: {
        // We'll need site info for display
        // Assuming 'site' relation exists on Task model based on schema review,
        // though typically it might be manual if not defined in Prisma relation.
        // Let's check schema relations. The schema snippet showed `siteId` but didn't show the relation line explicitly in the snippet.
        // However, usually `siteId` implies a relation. We will assume standard relations or fetch separately if needed.
        // Actually, snippet showed: siteId String ... but relation lines were truncated.
        // Let's assume we can't include site directly or just fetch raw for now to be safe,
        // OR better, we fetch sites for these tasks.
      },
      orderBy: { slaDueAt: "asc" },
    });

    // Group by siteId
    const bundles: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!bundles[task.siteId]) {
        bundles[task.siteId] = [];
      }
      bundles[task.siteId].push(task);
    }

    // Enhance with site details (mocked or fetched)
    // To match the requirement "Group pending housekeeping tasks", we need ensuring we actually have site info.
    // Let's fetch the unique site IDs.
    const siteIds = Object.keys(bundles);
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, siteNumber: true },
    });
    const siteMap = new Map(sites.map((s) => [s.id, s]));

    const result: TaskBundle[] = [];

    for (const [siteId, groupedTasks] of Object.entries(bundles)) {
      const site = siteMap.get(siteId);
      const siteNumber = site?.siteNumber || "Unknown";

      // Calculate bundle aggregate SLA status
      // Priority: breached > at_risk > on_track
      let bundleSla: "on_track" | "at_risk" | "breached" = "on_track";
      if (groupedTasks.some((t) => t.slaStatus === "breached")) {
        bundleSla = "breached";
      } else if (groupedTasks.some((t) => t.slaStatus === "at_risk")) {
        bundleSla = "at_risk";
      }

      // Calculate bundle priority (simple integer mapping)
      // critical=4, high=3, med=2, low=1
      const priorityWeights: Record<string, number> = {
        critical: 4,
        high: 3,
        med: 2,
        low: 1,
      };

      const maxPriority = groupedTasks.reduce((max, t) => {
        const p = t.priority ? priorityWeights[t.priority] || 1 : 1;
        return p > max ? p : max;
      }, 0);

      result.push({
        siteId,
        siteNumber,
        bundlePriority: maxPriority,
        slaStatus: bundleSla,
        taskCount: groupedTasks.length,
        tasks: groupedTasks,
      });
    }

    // Sort bundles: Breached first, then by priority desc
    return result.sort((a, b) => {
      const slaWeight = { breached: 3, at_risk: 2, on_track: 1 };
      if (slaWeight[a.slaStatus] !== slaWeight[b.slaStatus]) {
        return slaWeight[b.slaStatus] - slaWeight[a.slaStatus];
      }
      return b.bundlePriority - a.bundlePriority;
    });
  }
}
