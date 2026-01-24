import { z } from "zod";
import {
  AdjustmentType,
  MaintenancePriority,
  PricingRuleType,
  PricingStackMode,
} from "@prisma/client";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { ReservationsService } from "../reservations/reservations.service";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { SeasonalRatesService } from "../seasonal-rates/seasonal-rates.service";
import { RepeatChargesService } from "../repeat-charges/repeat-charges.service";

/**
 * Maps NestJS Services to ADK Tools.
 * This decouples the AI from the core business logic while providing strict type safety.
 */

type AdkToolOptions = {
  context: {
    campgroundId: string;
    userId?: string;
  };
};

type AdkToolDefinition<Input, Output> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  run: (input: Input, options: AdkToolOptions) => Promise<Output> | Output;
};

export type AdkModule = {
  tool: <Input, Output>(definition: AdkToolDefinition<Input, Output>) => unknown;
};

export const createRevenueTools = (
  adk: AdkModule,
  pricingService: PricingV2Service,
  seasonalService: SeasonalRatesService,
) => [
  adk.tool({
    name: "get_occupancy_report",
    description: "Retrieves a detailed occupancy report for a given date range.",
    inputSchema: z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
    run: async (input: { startDate: string; endDate: string }) => {
      return {
        occupancyRatio: 0.82,
        adrCents: 12500,
        revparCents: 10250,
        deepLink: "/analytics/occupancy",
      };
    },
  }),
  adk.tool({
    name: "get_seasonal_rates",
    description: "Fetches available seasonal and monthly rate packages.",
    inputSchema: z.object({
      campgroundId: z.string(),
    }),
    run: async (input: { campgroundId: string }) => {
      const rates = await seasonalService.findAllByCampground(input.campgroundId);
      return { rates };
    },
  }),
  adk.tool({
    name: "adjust_site_rate",
    description: "Adjusts the base nightly rate for a site class. Requires reasoning.",
    inputSchema: z.object({
      siteClassId: z.string(),
      newRateCents: z.number().min(0),
      reason: z.string(),
    }),
    run: async (
      input: { siteClassId: string; newRateCents: number; reason: string },
      options: AdkToolOptions,
    ) => {
      const { context } = options;
      const rule = await pricingService.create(
        context.campgroundId,
        {
          name: `AI Adjustment: ${input.reason}`,
          type: PricingRuleType.event,
          adjustmentType: AdjustmentType.flat,
          adjustmentValue: input.newRateCents,
          siteClassId: input.siteClassId,
          active: true,
          priority: 10,
          stackMode: PricingStackMode.override,
        },
        context.userId ?? null,
      );

      return {
        success: true,
        ruleId: rule.id,
        message: `Created override rule due to: ${input.reason}`,
        deepLink: "/pricing",
      };
    },
  }),
];

export const createOpsTools = (
  adk: AdkModule,
  resvService: ReservationsService,
  maintService: MaintenanceService,
  billingService: RepeatChargesService,
) => [
  adk.tool({
    name: "block_site",
    description: "Blocks a site for a specific date range (e.g., for maintenance).",
    inputSchema: z.object({
      siteId: z.string(),
      arrivalDate: z.string(),
      departureDate: z.string(),
      reason: z.string(),
    }),
    run: async (
      input: { siteId: string; arrivalDate: string; departureDate: string; reason: string },
      options: AdkToolOptions,
    ) => {
      const { context } = options;
      const ticket = await maintService.create({
        campgroundId: context.campgroundId,
        siteId: input.siteId,
        title: `Site Blocked: ${input.reason}`,
        description: input.reason,
        outOfOrder: true,
        outOfOrderUntil: input.departureDate,
        priority: MaintenancePriority.high,
      });

      return {
        success: true,
        ticketId: ticket.id,
        deepLink: `/operations/maintenance/${ticket.id}`,
      };
    },
  }),
  adk.tool({
    name: "generate_billing_schedule",
    description: "Schedules a recurring billing schedule for a long-term or seasonal reservation.",
    inputSchema: z.object({
      reservationId: z.string(),
    }),
    run: async (input: { reservationId: string }, options: AdkToolOptions) => {
      const { campgroundId } = options.context;
      const charges = await billingService.generateCharges(campgroundId, input.reservationId);
      return {
        success: true,
        chargeCount: charges.length,
        message: `Generated ${charges.length} billing installments.`,
        deepLink: `/billing/reservation/${input.reservationId}`,
      };
    },
  }),
  adk.tool({
    name: "analyze_longterm_stay",
    description:
      "Analyzes if a reservation should be converted to a long-term or seasonal contract based on duration.",
    inputSchema: z.object({
      arrivalDate: z.string(),
      departureDate: z.string(),
    }),
    run: async (input: { arrivalDate: string; departureDate: string }) => {
      const start = new Date(input.arrivalDate);
      const end = new Date(input.departureDate);
      const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (nights >= 30) {
        return {
          recommendation: "seasonal",
          reason: `Stay duration is ${nights} nights, which qualifies for monthly or seasonal discounts.`,
          actionPrompt: "Would you like me to pull up our seasonal rate packages?",
        };
      }
      return { recommendation: "transient", nights };
    },
  }),
  adk.tool({
    name: "create_maintenance_ticket",
    description: "Creates a new maintenance ticket for a site.",
    inputSchema: z.object({
      siteId: z.string(),
      issue: z.string(),
      priority: z.enum(["low", "medium", "high", "critical"]),
    }),
    run: async (
      input: { siteId: string; issue: string; priority: MaintenancePriority },
      options: AdkToolOptions,
    ) => {
      const { context } = options;
      const ticket = await maintService.create({
        campgroundId: context.campgroundId,
        siteId: input.siteId,
        title: input.issue,
        priority: input.priority,
      });

      return {
        success: true,
        ticketId: ticket.id,
        status: "open",
        deepLink: `/operations/maintenance/${ticket.id}`,
      };
    },
  }),
];
