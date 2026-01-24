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
import { TasksService } from "./tasks.service";
import { TaskType, TaskState, SlaStatus } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Body()
    createTaskDto: {
      tenantId: string;
      type: TaskType;
      siteId: string;
      reservationId?: string;
      priority?: string;
      slaDueAt?: string;
      checklist?: unknown;
      assignedToUserId?: string;
      assignedToTeamId?: string;
      notes?: string;
      source?: string;
      createdBy: string;
    },
  ) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  findAll(
    @Query("tenantId") tenantId: string,
    @Query("siteId") siteId?: string,
    @Query("state") state?: TaskState,
    @Query("slaStatus") slaStatus?: SlaStatus,
    @Query("type") type?: TaskType,
    @Query("assignedToUserId") assignedToUserId?: string,
  ) {
    return this.tasksService.findAll(tenantId, {
      siteId,
      state,
      slaStatus,
      type,
      assignedToUserId,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body()
    updateTaskDto: {
      state?: TaskState;
      priority?: string;
      slaDueAt?: string;
      assignedToUserId?: string;
      assignedToTeamId?: string;
      checklist?: unknown;
      photos?: unknown;
      notes?: string;
    },
  ) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.tasksService.remove(id);
  }
}
