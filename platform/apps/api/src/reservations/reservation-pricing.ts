import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PricingBreakdown, PricingV2Service } from "../pricing-v2/pricing-v2.service";

export type PricingV2Result = {
  nights: number;
  baseSubtotalCents: number;
  totalCents: number;
  rulesDeltaCents: number;
  pricingRuleVersion: string;
  appliedRules?: PricingBreakdown["appliedRules"];
};

export async function evaluatePricingV2(
  prisma: PrismaService,
  pricingV2Service: PricingV2Service,
  campgroundId: string,
  siteId: string,
  arrival: Date,
  departure: Date,
  occupancyPct?: number,
): Promise<PricingV2Result> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { SiteClass: true },
  });
  if (!site) throw new NotFoundException("Site not found");

  const defaultRate = site.SiteClass?.defaultRate ?? 0;
  const breakdown = await pricingV2Service.evaluate(
    campgroundId,
    site.siteClassId,
    defaultRate,
    arrival,
    departure,
    occupancyPct,
  );

  return {
    nights: breakdown.nights,
    baseSubtotalCents: breakdown.baseSubtotalCents,
    totalCents: breakdown.totalBeforeTaxCents,
    rulesDeltaCents: breakdown.adjustmentsCents + breakdown.demandAdjustmentCents,
    pricingRuleVersion: breakdown.pricingRuleVersion,
    appliedRules: breakdown.appliedRules,
  };
}
