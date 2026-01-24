import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { OperationsService } from "./operations.service";
import { JwtAuthGuard } from "../auth/guards";
import { CreateTaskDto, UpdateTaskDto } from "./dto/operations.dto";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";
import type { Request } from "express";

@UseGuards(JwtAuthGuard, ScopeGuard)
@RequireScope({ resource: "operations", action: "read" })
@Controller("operations")
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get("tasks")
  findAllTasks(
    @Query("campgroundId") campgroundId: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
  ) {
    if (!campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.findAllTasks(campgroundId, type, status);
  }

  @RequireScope({ resource: "operations", action: "write" })
  @Post("tasks")
  createTask(@Body() createTaskDto: CreateTaskDto, @Req() req: Request) {
    const { campgroundId, ...data } = createTaskDto;
    if (!campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.createTask(campgroundId, data, req?.user);
  }

  @RequireScope({ resource: "operations", action: "write" })
  @Patch("tasks/:id")
  updateTask(@Param("id") id: string, @Body() updateTaskDto: UpdateTaskDto, @Req() req: Request) {
    return this.operationsService.updateTask(id, updateTaskDto, req?.user);
  }

  @RequireScope({ resource: "operations", action: "write" })
  @Patch("sites/:id/housekeeping")
  updateSiteHousekeeping(
    @Param("id") id: string,
    @Body("status") status: string,
    @Req() req: Request,
  ) {
    return this.operationsService.updateSiteHousekeeping(id, status, req?.user);
  }

  @Get("stats/housekeeping")
  getHousekeepingStats(@Query("campgroundId") campgroundId: string) {
    if (!campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.getHousekeepingStats(campgroundId);
  }

  @Get("auto-tasking")
  getAutoTasking(@Query("campgroundId") campgroundId: string) {
    if (!campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.getAutoTasking(campgroundId);
  }

  @RequireScope({ resource: "operations", action: "write" })
  @Post("auto-tasking/trigger")
  triggerAutoTask(@Body() body: { campgroundId: string; trigger: string }, @Req() req: Request) {
    if (!body.campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.triggerAutoTask(body.campgroundId, body.trigger, req?.user);
  }

  @Get("checklists")
  listChecklists(@Query("campgroundId") campgroundId: string) {
    if (!campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.listChecklists(campgroundId);
  }

  @Get("reorders")
  listReorders(@Query("campgroundId") campgroundId: string) {
    if (!campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.listReorders(campgroundId);
  }

  @Get("copilot/suggestions")
  listSuggestions(@Query("campgroundId") campgroundId: string) {
    if (!campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.listSuggestions(campgroundId);
  }

  @Get("ops-health")
  getOpsHealth(@Query("campgroundId") campgroundId: string) {
    if (!campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.getOpsHealth(campgroundId);
  }

  @RequireScope({ resource: "operations", action: "write" })
  @Post("ops-health/alert")
  sendOpsHealthAlert(
    @Body() body: { campgroundId: string; channel?: string; target?: string; message?: string },
    @Req() req: Request,
  ) {
    if (!body.campgroundId) throw new ForbiddenException("campgroundId is required");
    return this.operationsService.sendOpsHealthAlert(
      body.campgroundId,
      body.channel,
      body.target,
      body.message,
      req?.user,
    );
  }
}
