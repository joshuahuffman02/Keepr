import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import { BackupService } from "./backup.service";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("campgrounds/:campgroundId/backup")
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Roles(UserRole.owner, UserRole.manager, UserRole.readonly)
  @RequireScope({ resource: "backup", action: "read" })
  @Get("status")
  status(@Param("campgroundId") campgroundId: string) {
    return this.backup.getStatus(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "backup", action: "write" })
  @Post("restore-sim")
  simulate(@Param("campgroundId") campgroundId: string) {
    return this.backup.simulateRestore(campgroundId);
  }
}
