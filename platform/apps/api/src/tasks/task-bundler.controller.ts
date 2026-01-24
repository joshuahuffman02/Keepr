import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards"; // Assuming standard guard exists
import { TaskBundlerService } from "./task-bundler.service";
import type { Request } from "express";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getUserTenantId = (user: unknown): string | null => {
  if (!isRecord(user)) return null;
  const campgroundId = user.campgroundId;
  if (typeof campgroundId === "string") return campgroundId;
  const tenantId = user.tenantId;
  if (typeof tenantId === "string") return tenantId;
  return null;
};

@UseGuards(JwtAuthGuard)
@Controller("tasks/bundles")
export class TaskBundlerController {
  constructor(private readonly bundler: TaskBundlerService) {}

  @Get()
  async getBundles(@Req() req: Request) {
    const tenantId = getUserTenantId(req.user);

    // Fallback if not strictly defined on user
    if (!tenantId) {
      // For development/scaffolding, might throw or return empty
      return [];
    }

    return this.bundler.getBundles(tenantId);
  }
}
