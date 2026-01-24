import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  WorkflowsService,
  type CreateWorkflowDto,
  type WorkflowStepDto,
} from "./workflows.service";
import { WorkflowStatus } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards";

@Controller("workflows")
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private readonly service: WorkflowsService) {}

  @Post()
  createWorkflow(@Body() dto: CreateWorkflowDto) {
    return this.service.createWorkflow(dto);
  }

  @Get()
  listWorkflows(
    @Query("campgroundId") campgroundId: string,
    @Query("status") status?: WorkflowStatus,
  ) {
    return this.service.listWorkflows(campgroundId, status);
  }

  @Get(":id")
  getWorkflow(@Param("id") id: string) {
    return this.service.getWorkflow(id);
  }

  @Patch(":id")
  updateWorkflow(@Param("id") id: string, @Body() dto: Partial<CreateWorkflowDto>) {
    return this.service.updateWorkflow(id, dto);
  }

  @Delete(":id")
  deleteWorkflow(@Param("id") id: string) {
    return this.service.deleteWorkflow(id);
  }

  @Post(":workflowId/steps")
  addStep(@Param("workflowId") workflowId: string, @Body() dto: WorkflowStepDto) {
    return this.service.addStep(workflowId, dto);
  }

  @Patch("steps/:stepId")
  updateStep(@Param("stepId") stepId: string, @Body() dto: Partial<WorkflowStepDto>) {
    return this.service.updateStep(stepId, dto);
  }

  @Delete("steps/:stepId")
  deleteStep(@Param("stepId") stepId: string) {
    return this.service.deleteStep(stepId);
  }

  @Post(":id/trigger")
  triggerWorkflow(
    @Param("id") id: string,
    @Body() context: { reservationId?: string; guestId?: string; data?: Record<string, unknown> },
  ) {
    return this.service.triggerWorkflow(id, context);
  }

  @Post("process")
  processPendingExecutions() {
    return this.service.processPendingExecutions();
  }
}
