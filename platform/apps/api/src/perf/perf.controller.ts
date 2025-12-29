import { Controller, Get, UseGuards } from "@nestjs/common";
import { PerfService } from "./perf.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { PlatformRole } from "@prisma/client";

@Controller("ops/perf")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin)
export class PerfController {
  constructor(private readonly perfService: PerfService) {}

  @Get()
  getSnapshot() {
    return this.perfService.getSnapshot();
  }
}

