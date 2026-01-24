import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

export interface LogAutonomousActionParams {
  campgroundId: string;
  actionType:
    | "auto_reply_sent"
    | "waitlist_auto_offered"
    | "site_released"
    | "price_adjusted"
    | "guest_notified"
    | "weather_alert_sent"
    | "phone_call_handled";
  entityType: string;
  entityId: string;
  description: string;
  details: Record<string, unknown>;
  confidence?: number;
  reasoning?: string;
  reversible?: boolean;
}

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
export class AiAutonomousActionService {
  private readonly logger = new Logger(AiAutonomousActionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an autonomous action for audit trail
   */
  async logAction(params: LogAutonomousActionParams) {
    try {
      const details = toJsonInput(params.details) ?? {};
      const action = await this.prisma.aiAutonomousAction.create({
        data: {
          id: randomUUID(),
          campgroundId: params.campgroundId,
          actionType: params.actionType,
          entityType: params.entityType,
          entityId: params.entityId,
          description: params.description,
          details,
          confidence: params.confidence,
          reasoning: params.reasoning,
          reversible: params.reversible ?? false,
          outcome: "success",
        },
      });

      this.logger.log(
        `Logged autonomous action: ${params.actionType} for ${params.entityType}/${params.entityId}`,
      );

      return action;
    } catch (error) {
      this.logger.error(`Failed to log autonomous action: ${error}`);
      throw error;
    }
  }

  /**
   * Get recent autonomous actions for a campground
   */
  async getRecentActions(
    campgroundId: string,
    options: {
      actionType?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const { actionType, limit = 50, startDate, endDate } = options;

    const where: Prisma.AiAutonomousActionWhereInput = { campgroundId };
    if (actionType) where.actionType = actionType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return this.prisma.aiAutonomousAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get action by ID
   */
  async getAction(id: string) {
    return this.prisma.aiAutonomousAction.findUnique({
      where: { id },
    });
  }

  /**
   * Reverse an autonomous action
   */
  async reverseAction(id: string, userId: string, reason: string) {
    const action = await this.prisma.aiAutonomousAction.findUnique({
      where: { id },
    });

    if (!action) {
      throw new NotFoundException("Action not found");
    }

    if (!action.reversible) {
      throw new BadRequestException("This action cannot be reversed");
    }

    if (action.reversedAt) {
      throw new BadRequestException("This action has already been reversed");
    }

    // Update the action record
    const updated = await this.prisma.aiAutonomousAction.update({
      where: { id },
      data: {
        reversedAt: new Date(),
        reversedById: userId,
        reversedReason: reason,
        outcome: "reversed",
      },
    });

    this.logger.log(`Action ${id} reversed by ${userId}: ${reason}`);

    return updated;
  }

  /**
   * Get summary of autonomous actions for dashboard
   */
  async getActionsSummary(campgroundId: string, periodDays: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const actions = await this.prisma.aiAutonomousAction.groupBy({
      by: ["actionType", "outcome"],
      where: {
        campgroundId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    // Transform into summary object
    const summary: Record<string, { total: number; success: number; reversed: number }> = {};

    for (const action of actions) {
      if (!summary[action.actionType]) {
        summary[action.actionType] = { total: 0, success: 0, reversed: 0 };
      }
      summary[action.actionType].total += action._count;
      if (action.outcome === "success") {
        summary[action.actionType].success += action._count;
      } else if (action.outcome === "reversed") {
        summary[action.actionType].reversed += action._count;
      }
    }

    return summary;
  }

  /**
   * Update action outcome
   */
  async updateOutcome(
    id: string,
    outcome: "success" | "partial" | "failed",
    outcomeDetails?: string,
  ) {
    return this.prisma.aiAutonomousAction.update({
      where: { id },
      data: {
        outcome,
        outcomeDetails,
      },
    });
  }
}
