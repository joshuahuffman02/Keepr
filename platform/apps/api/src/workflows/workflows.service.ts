import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowTrigger, WorkflowStatus, WorkflowExecutionStatus } from '@prisma/client';

interface CreateWorkflowDto {
  campgroundId: string;
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  triggerValue?: number;
  conditions?: Record<string, any>;
  status?: WorkflowStatus;
  priority?: number;
}

interface WorkflowStepDto {
  stepOrder: number;
  actionType: 'send_email' | 'send_sms' | 'wait' | 'condition' | 'webhook';
  config: Record<string, any>;
  isActive?: boolean;
}

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createWorkflow(dto: CreateWorkflowDto) {
    return this.prisma.communicationWorkflow.create({
      data: {
        campgroundId: dto.campgroundId,
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        triggerValue: dto.triggerValue,
        conditions: dto.conditions,
        status: dto.status ?? 'draft',
        priority: dto.priority ?? 100,
      },
    });
  }

  async listWorkflows(campgroundId: string, status?: WorkflowStatus) {
    return this.prisma.communicationWorkflow.findMany({
      where: {
        campgroundId,
        ...(status ? { status } : {}),
      },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        _count: { select: { executions: true } },
      },
      orderBy: { priority: 'asc' },
    });
  }

  async getWorkflow(id: string) {
    const workflow = await this.prisma.communicationWorkflow.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        executions: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async updateWorkflow(id: string, dto: Partial<CreateWorkflowDto>) {
    await this.getWorkflow(id);
    return this.prisma.communicationWorkflow.update({
      where: { id },
      data: dto,
    });
  }

  async deleteWorkflow(id: string) {
    await this.getWorkflow(id);
    return this.prisma.communicationWorkflow.delete({ where: { id } });
  }

  async addStep(workflowId: string, dto: WorkflowStepDto) {
    await this.getWorkflow(workflowId);
    return this.prisma.workflowStep.create({
      data: {
        workflowId,
        stepOrder: dto.stepOrder,
        actionType: dto.actionType,
        config: dto.config,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateStep(stepId: string, dto: Partial<WorkflowStepDto>) {
    return this.prisma.workflowStep.update({
      where: { id: stepId },
      data: dto,
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
    context: { reservationId?: string; guestId?: string; data?: Record<string, any> }
  ) {
    const workflow = await this.getWorkflow(workflowId);
    if (workflow.status !== 'active') {
      throw new BadRequestException('Workflow is not active');
    }

    return this.prisma.workflowExecution.create({
      data: {
        workflowId,
        reservationId: context.reservationId,
        guestId: context.guestId,
        status: 'pending',
        currentStep: 0,
        context: context.data,
      },
    });
  }

  /**
   * Process pending workflow executions
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingExecutions() {
    const pending = await this.prisma.workflowExecution.findMany({
      where: { status: { in: ['pending', 'running'] } },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
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
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    return results;
  }

  private async processExecution(execution: any) {
    const { workflow } = execution;
    const steps = workflow.steps.filter((s: any) => s.isActive);

    if (execution.currentStep >= steps.length) {
      // All steps completed
      return this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    }

    const step = steps[execution.currentStep];

    // Mark as running
    await this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: { status: 'running', startedAt: execution.startedAt ?? new Date() },
    });

    // Execute the step
    await this.executeStep(step, execution);

    // Move to next step
    return this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: { currentStep: execution.currentStep + 1 },
    });
  }

  private async executeStep(step: any, execution: any) {
    const config = step.config as Record<string, any>;

    switch (step.actionType) {
      case 'send_email':
        // Queue email (integrate with email service)
        this.logger.log(`Would send email: ${config.templateId} to ${execution.guestId}`);
        break;

      case 'send_sms':
        // Queue SMS
        this.logger.log(`Would send SMS to ${execution.guestId}`);
        break;

      case 'wait':
        // Schedule next execution after delay
        const delayMs = (config.delayMinutes ?? 60) * 60 * 1000;
        // In production, use a job queue with delay
        this.logger.log(`Would wait ${config.delayMinutes} minutes`);
        break;

      case 'webhook':
        // Call external webhook
        if (config.url) {
          try {
            await fetch(config.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                executionId: execution.id,
                reservationId: execution.reservationId,
                guestId: execution.guestId,
                context: execution.context,
              }),
            });
          } catch (e) {
            this.logger.error('Webhook failed:', e instanceof Error ? e.stack : e);
          }
        }
        break;

      case 'condition':
        // Evaluate condition and potentially skip steps
        this.logger.log('Would evaluate condition');
        break;
    }
  }

  /**
   * Check for workflows that should be triggered based on events
   */
  async checkTriggers(
    campgroundId: string,
    trigger: WorkflowTrigger,
    context: { reservationId?: string; guestId?: string }
  ) {
    const workflows = await this.prisma.communicationWorkflow.findMany({
      where: {
        campgroundId,
        trigger,
        status: 'active',
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

