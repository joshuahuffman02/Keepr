import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, WorkflowTrigger, WorkflowStatus, WorkflowExecutionStatus } from "@prisma/client";

export interface CreateWorkflowDto {
  campgroundId: string;
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  triggerValue?: number;
  conditions?: Record<string, unknown>;
  status?: WorkflowStatus;
  priority?: number;
}

export interface WorkflowStepDto {
  stepOrder: number;
  actionType: "send_email" | "send_sms" | "wait" | "condition" | "webhook";
  config: Record<string, unknown>;
  isActive?: boolean;
}

type WorkflowExecutionWithSteps = Prisma.WorkflowExecutionGetPayload<{
  include: { CommunicationWorkflow: { include: { WorkflowStep: true } } };
}>;

type WorkflowStepRecord = {
  actionType: string;
  config: unknown;
  isActive: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is Prisma.InputJsonValue => {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
};

const toJsonInput = (value: unknown): Prisma.InputJsonValue | undefined =>
  isJsonValue(value) ? value : undefined;

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createWorkflow(dto: CreateWorkflowDto) {
    const conditions = dto.conditions ? toJsonInput(dto.conditions) : undefined;
    if (dto.conditions && !conditions) {
      throw new BadRequestException("Workflow conditions must be JSON-serializable");
    }

    return this.prisma.communicationWorkflow.create({
      data: {
        id: randomUUID(),
        campgroundId: dto.campgroundId,
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        triggerValue: dto.triggerValue,
        conditions,
        status: dto.status ?? "draft",
        priority: dto.priority ?? 100,
        updatedAt: new Date(),
      },
    });
  }

  async listWorkflows(campgroundId: string, status?: WorkflowStatus) {
    const workflows = await this.prisma.communicationWorkflow.findMany({
      where: {
        campgroundId,
        ...(status ? { status } : {}),
      },
      include: {
        WorkflowStep: { orderBy: { stepOrder: "asc" } },
        _count: { select: { WorkflowExecution: true } },
      },
      orderBy: { priority: "asc" },
    });

    return workflows.map(({ WorkflowStep, _count, ...workflow }) => ({
      ...workflow,
      steps: WorkflowStep,
      _count: { executions: _count.WorkflowExecution },
    }));
  }

  async getWorkflow(id: string) {
    const workflow = await this.prisma.communicationWorkflow.findUnique({
      where: { id },
      include: {
        WorkflowStep: { orderBy: { stepOrder: "asc" } },
        WorkflowExecution: { take: 10, orderBy: { createdAt: "desc" } },
      },
    });
    if (!workflow) throw new NotFoundException("Workflow not found");
    const { WorkflowStep, WorkflowExecution, ...rest } = workflow;
    return {
      ...rest,
      steps: WorkflowStep,
      executions: WorkflowExecution,
    };
  }

  async updateWorkflow(id: string, dto: Partial<CreateWorkflowDto>) {
    await this.getWorkflow(id);
    const conditions = dto.conditions ? toJsonInput(dto.conditions) : undefined;
    if (dto.conditions && !conditions) {
      throw new BadRequestException("Workflow conditions must be JSON-serializable");
    }

    const data: Prisma.CommunicationWorkflowUpdateInput = {
      name: dto.name,
      description: dto.description,
      trigger: dto.trigger,
      triggerValue: dto.triggerValue,
      conditions,
      status: dto.status,
      priority: dto.priority,
      updatedAt: new Date(),
    };

    return this.prisma.communicationWorkflow.update({
      where: { id },
      data,
    });
  }

  async deleteWorkflow(id: string) {
    await this.getWorkflow(id);
    return this.prisma.communicationWorkflow.delete({ where: { id } });
  }

  async addStep(workflowId: string, dto: WorkflowStepDto) {
    await this.getWorkflow(workflowId);
    const config = toJsonInput(dto.config);
    if (!config) {
      throw new BadRequestException("Workflow step config must be JSON-serializable");
    }
    return this.prisma.workflowStep.create({
      data: {
        id: randomUUID(),
        workflowId,
        stepOrder: dto.stepOrder,
        actionType: dto.actionType,
        config,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateStep(stepId: string, dto: Partial<WorkflowStepDto>) {
    const config = dto.config ? toJsonInput(dto.config) : undefined;
    if (dto.config && !config) {
      throw new BadRequestException("Workflow step config must be JSON-serializable");
    }

    const data: Prisma.WorkflowStepUpdateInput = {
      stepOrder: dto.stepOrder,
      actionType: dto.actionType,
      config,
      isActive: dto.isActive,
    };

    return this.prisma.workflowStep.update({
      where: { id: stepId },
      data,
    });
  }

  async deleteStep(stepId: string) {
    return this.prisma.workflowStep.delete({ where: { id: stepId } });
  }

  /**
   * Trigger a workflow execution for a reservation/guest
   */
  async triggerWorkflow(
    workflowId: string,
    context: { reservationId?: string; guestId?: string; data?: Record<string, unknown> },
  ) {
    const workflow = await this.getWorkflow(workflowId);
    if (workflow.status !== "active") {
      throw new BadRequestException("Workflow is not active");
    }

    const contextData = context.data ? toJsonInput(context.data) : undefined;
    if (context.data && !contextData) {
      throw new BadRequestException("Workflow context must be JSON-serializable");
    }

    return this.prisma.workflowExecution.create({
      data: {
        id: randomUUID(),
        workflowId,
        reservationId: context.reservationId,
        guestId: context.guestId,
        status: "pending",
        currentStep: 0,
        context: contextData,
      },
    });
  }

  /**
   * Process pending workflow executions
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingExecutions() {
    const pending = await this.prisma.workflowExecution.findMany({
      where: { status: { in: ["pending", "running"] } },
      include: {
        CommunicationWorkflow: {
          include: { WorkflowStep: { orderBy: { stepOrder: "asc" } } },
        },
      },
      take: 100,
    });

    const results = [];

    for (const execution of pending) {
      try {
        const result = await this.processExecution(execution);
        results.push(result);
      } catch (error) {
        await this.prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }

    return results;
  }

  private async processExecution(execution: WorkflowExecutionWithSteps) {
    const workflow = execution.CommunicationWorkflow;
    const steps = workflow.WorkflowStep.filter((step) => step.isActive);

    if (execution.currentStep >= steps.length) {
      // All steps completed
      return this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });
    }

    const step = steps[execution.currentStep];

    // Mark as running
    await this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: { status: "running", startedAt: execution.startedAt ?? new Date() },
    });

    // Execute the step
    await this.executeStep(step, execution);

    // Move to next step
    return this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: { currentStep: execution.currentStep + 1 },
    });
  }

  private async executeStep(step: WorkflowStepRecord, execution: WorkflowExecutionWithSteps) {
    const config = isRecord(step.config) ? step.config : {};

    switch (step.actionType) {
      case "send_email":
        // Queue email (integrate with email service)
        this.logger.log(`Would send email: ${config.templateId} to ${execution.guestId}`);
        break;

      case "send_sms":
        // Queue SMS
        this.logger.log(`Would send SMS to ${execution.guestId}`);
        break;

      case "wait":
        // Schedule next execution after delay
        const delayMinutes = typeof config.delayMinutes === "number" ? config.delayMinutes : 60;
        const delayMs = delayMinutes * 60 * 1000;
        // In production, use a job queue with delay
        this.logger.log(`Would wait ${delayMinutes} minutes`);
        break;

      case "webhook":
        // Call external webhook
        const url = typeof config.url === "string" ? config.url : "";
        if (url) {
          try {
            await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                executionId: execution.id,
                reservationId: execution.reservationId,
                guestId: execution.guestId,
                context: execution.context,
              }),
            });
          } catch (e) {
            this.logger.error("Webhook failed:", e instanceof Error ? e.stack : e);
          }
        }
        break;

      case "condition":
        // Evaluate condition and potentially skip steps
        this.logger.log("Would evaluate condition");
        break;
    }
  }

  /**
   * Check for workflows that should be triggered based on events
   */
  async checkTriggers(
    campgroundId: string,
    trigger: WorkflowTrigger,
    context: { reservationId?: string; guestId?: string },
  ) {
    const workflows = await this.prisma.communicationWorkflow.findMany({
      where: {
        campgroundId,
        trigger,
        status: "active",
      },
    });

    const executions = [];
    for (const workflow of workflows) {
      const execution = await this.triggerWorkflow(workflow.id, context);
      executions.push(execution);
    }

    return executions;
  }
}
