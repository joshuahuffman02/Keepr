import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";
import { MaintenancePriority, MaintenanceStatus, type Prisma } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards";
import { ScopeGuard } from "../auth/guards/scope.guard";

@UseGuards(JwtAuthGuard, ScopeGuard)
@Controller("maintenance")
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  create(
    @Body()
    createMaintenanceDto: {
      campgroundId: string;
      siteId?: string;
      title: string;
      description?: string;
      priority?: MaintenancePriority;
      dueDate?: string;
      assignedTo?: string;
      isBlocking?: boolean;
      outOfOrder?: boolean;
      outOfOrderReason?: string;
      outOfOrderUntil?: string;
      checklist?: Prisma.InputJsonValue;
      photos?: Prisma.InputJsonValue;
      notes?: string;
      lockId?: string;
    },
  ) {
    return this.maintenanceService.create(createMaintenanceDto);
  }

  @Get()
  findAll(
    @Query("campgroundId") campgroundId: string,
    @Query("status") status?: MaintenanceStatus,
    @Query("siteId") siteId?: string,
    @Query("outOfOrder") outOfOrder?: string,
  ) {
    const outOfOrderBool =
      outOfOrder === "true" ? true : outOfOrder === "false" ? false : undefined;
    return this.maintenanceService.findAll(campgroundId, status, siteId, outOfOrderBool);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body()
    updateMaintenanceDto: {
      title?: string;
      description?: string;
      status?: MaintenanceStatus;
      priority?: MaintenancePriority;
      dueDate?: string;
      assignedTo?: string;
      assignedToTeamId?: string;
      isBlocking?: boolean;
      resolvedAt?: string;
      outOfOrder?: boolean;
      outOfOrderReason?: string;
      outOfOrderUntil?: string;
      checklist?: Prisma.InputJsonValue;
      photos?: Prisma.InputJsonValue;
      notes?: string;
    },
  ) {
    return this.maintenanceService.update(id, updateMaintenanceDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.maintenanceService.remove(id);
  }
}
