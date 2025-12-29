import { Controller, Get, UseGuards } from "@nestjs/common";
import { PerfService } from "./perf.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
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

