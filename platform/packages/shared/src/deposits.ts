import {
  DepositConfig,
  DepositConfigSchema,
  DepositRule,
  DepositScopeRule,
} from "./deposits.types";

type DepositContext = {
  total: number;
  nights: number;
  arrivalDate?: string | null;
  channel?: string | null;
  ratePlanId?: string | null;
  discountCodes?: string[] | null;
  siteTypeId?: string | null;
};

type DepositInput = DepositContext & {
  depositRule?: string | null;
  depositPercentage?: number | null;
  depositConfig?: DepositConfig | null | undefined;
};

const isBetweenMonthDay = (arrival: string, start: string, end: string) => {
  const pad = (v: number) => v.toString().padStart(2, "0");
  const toMd = (date: Date) => `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const arrMd = toMd(new Date(arrival));
  if (!start || !end) return false;
  if (start <= end) {
    return arrMd >= start && arrMd <= end;
  }
  // Season crosses year boundary (e.g., Nov-Feb)
  return arrMd >= start || arrMd <= end;
};

const matchesScope = (scope: DepositScopeRule, ctx: DepositContext) => {
  if (scope.channels?.length && ctx.channel && !scope.channels.includes(ctx.channel)) return false;
  if (scope.ratePlanIds?.length && ctx.ratePlanId && !scope.ratePlanIds.includes(ctx.ratePlanId))
    return false;
  if (scope.siteTypeIds?.length && ctx.siteTypeId && !scope.siteTypeIds.includes(ctx.siteTypeId))
    return false;
  if (scope.discountCodes?.length) {
    const codes = (ctx.discountCodes || []).map((c: string) => c.toLowerCase());
    const needed = scope.discountCodes.map((c: string) => c.toLowerCase());
    const found = needed.some((c: string) => codes.includes(c));
    if (!found) return false;
  }
  return true;
};

const computeRuleAmount = (rule: DepositRule, total: number, nights: number) => {
  if (rule.type === "none") return 0;
  if (rule.type === "full") return total;
  if (rule.type === "half") return total / 2;
  if (rule.type === "first_night" || rule.type === "first_night_fees") {
    return nights > 0 ? total / Math.max(nights, 1) : total;
  }
  if (rule.type === "percent_total") {
    const pct = rule.percent ?? 0;
    return (total * pct) / 100;
  }
  if (rule.type === "fixed_amount") {
    return (rule.fixedCents ?? 0) / 100;
  }
  return 0;
};

export const computeDepositDue = (input: DepositInput) => {
  const { depositConfig, depositRule, depositPercentage, total, nights } = input;

  const ctx: DepositContext = {
    total,
    nights,
    arrivalDate: input.arrivalDate,
    channel: input.channel,
    ratePlanId: input.ratePlanId,
    discountCodes: input.discountCodes,
    siteTypeId: input.siteTypeId,
  };

  const pickRuleFromConfig = (): DepositRule | null => {
    if (!depositConfig) return null;

    let rule = depositConfig.defaultRule;

    const scopeMatch = depositConfig.scopeRules?.find((scope) => matchesScope(scope, ctx));
    if (scopeMatch) rule = scopeMatch.rule;

    if (depositConfig.seasons && ctx.arrivalDate) {
      const arrivalDate = ctx.arrivalDate; // Narrow type for closure
      const seasonMatch = depositConfig.seasons.find((s) =>
        isBetweenMonthDay(arrivalDate, s.startMonthDay, s.endMonthDay),
      );
      if (seasonMatch) rule = seasonMatch.rule;
    }

    if (depositConfig.lengthTiers && ctx.nights) {
      const tierMatch = depositConfig.lengthTiers.find((tier) => {
        const minOk = tier.minNights ? ctx.nights >= tier.minNights : true;
        const maxOk = tier.maxNights ? ctx.nights <= tier.maxNights : true;
        return minOk && maxOk;
      });
      if (tierMatch) rule = tierMatch.rule;
    }

    return rule;
  };

  const configRule = depositConfig ? pickRuleFromConfig() : null;
  let amount = 0;

  if (depositConfig?.schedule && depositConfig.schedule.length) {
    // Use the first schedule entry for "due now"
    const first = depositConfig.schedule[0];
    if (first.amountType === "percent") {
      amount = (total * (first.value ?? 0)) / 100;
    } else if (first.amountType === "fixed_cents") {
      amount = (first.value ?? 0) / 100;
    } else if (first.amountType === "remaining") {
      amount = total;
    }
  } else if (configRule) {
    amount = computeRuleAmount(configRule, total, nights);
  } else {
    // Legacy fields fallback
    const normalized = (depositRule || "none").toLowerCase();
    if (normalized === "full") amount = total;
    else if (normalized === "half" || normalized === "percentage_50") amount = total / 2;
    else if (normalized === "first_night" || normalized === "first_night_fees")
      amount = nights > 0 ? total / Math.max(nights, 1) : total;
    else if (normalized === "percentage") amount = ((depositPercentage ?? 0) / 100) * total;
    else amount = 0;
  }

  return Math.max(0, Math.round(amount * 100) / 100);
};

export const parseDepositConfig = (config: unknown) => {
  if (!config) return null;
  try {
    return DepositConfigSchema.parse(config);
  } catch {
    return null;
  }
};
