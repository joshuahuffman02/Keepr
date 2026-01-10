import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) { }

  @Get("campgrounds/:campgroundId/summary")
  summary(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    const org = req.organizationId || undefined;
    return this.dashboard.summary(campgroundId, org);
  }
}
