import { z } from "zod";

export const DepositRuleSchema = z.object({
  type: z.enum([
    "none",
    "full",
    "half",
    "first_night",
    "first_night_fees",
    "percent_total",
    "fixed_amount",
  ]),
  percent: z.number().min(0).max(100).optional(),
  fixedCents: z.number().int().min(0).optional(),
  includeFees: z.boolean().optional(),
  refundable: z.boolean().optional(),
  refundWindowHours: z.number().int().min(0).optional().nullable(),
});

export const DepositScheduleEntrySchema = z.object({
  dueAt: z.enum(["booking", "before_arrival"]),
  daysBeforeArrival: z.number().int().min(0).optional(),
  amountType: z.enum(["percent", "fixed_cents", "remaining"]),
  value: z.number().min(0).optional(),
});

export const DepositTierSchema = z.object({
  minNights: z.number().int().min(1).optional(),
  maxNights: z.number().int().min(1).optional(),
  rule: DepositRuleSchema,
});

export const DepositSeasonSchema = z.object({
  label: z.string().optional(),
  startMonthDay: z.string(), // MM-DD
  endMonthDay: z.string(), // MM-DD
  rule: DepositRuleSchema,
});

export const DepositScopeRuleSchema = z.object({
  label: z.string().optional(),
  channels: z.array(z.string()).optional(),
  ratePlanIds: z.array(z.string()).optional(),
  discountCodes: z.array(z.string()).optional(),
  siteTypeIds: z.array(z.string()).optional(),
  rule: DepositRuleSchema,
});

export const DepositConfigSchema = z.object({
  version: z.literal(1),
  defaultRule: DepositRuleSchema,
  refundable: z.boolean().optional(),
  refundWindowHours: z.number().int().min(0).optional().nullable(),
  lengthTiers: z.array(DepositTierSchema).optional(),
  seasons: z.array(DepositSeasonSchema).optional(),
  scopeRules: z.array(DepositScopeRuleSchema).optional(),
  schedule: z.array(DepositScheduleEntrySchema).optional(),
  notes: z.string().optional(),
});

export type DepositConfig = z.infer<typeof DepositConfigSchema>;
export type DepositRule = z.infer<typeof DepositRuleSchema>;
export type DepositScheduleEntry = z.infer<typeof DepositScheduleEntrySchema>;
export type DepositTier = z.infer<typeof DepositTierSchema>;
export type DepositSeason = z.infer<typeof DepositSeasonSchema>;
export type DepositScopeRule = z.infer<typeof DepositScopeRuleSchema>;
