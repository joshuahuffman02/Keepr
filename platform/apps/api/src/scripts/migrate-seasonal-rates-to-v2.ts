import { PrismaClient, PricingRuleType, PricingStackMode, AdjustmentType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL
});
// @ts-ignore Prisma 7 adapter signature
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const hasFlag = (flag: string) => args.includes(flag);
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const dryRun = hasFlag("--dry-run");
const deactivate = hasFlag("--deactivate");
const campgroundId = getArg("--campground");

const buildCalendarRefId = (seasonalRateId: string, minNights?: number | null) => {
  const parts = [`seasonalRate:${seasonalRateId}`];
  if (minNights && minNights > 0) parts.push(`minNights:${minNights}`);
  return parts.join(";");
};

const calcPriority = (minNights?: number | null) => {
  if (!minNights || minNights <= 0) return 1000;
  return Math.max(1, 1000 - Math.min(minNights, 900));
};

async function main() {
  const seasonalRates = await prisma.seasonalRate.findMany({
    where: {
      isActive: true,
      ...(campgroundId ? { campgroundId } : {})
    },
    include: { SiteClass: true }
  });

  if (!seasonalRates.length) {
    console.log("No active seasonal rates found.");
    return;
  }

  const siteClassesByCampground = new Map<string, { id: string; defaultRate: number | null }[]>();
  let createdCount = 0;
  let skippedCount = 0;
  let rateCount = 0;

  for (const rate of seasonalRates) {
    rateCount += 1;
    let targetClasses: { id: string; defaultRate: number | null }[] = [];

    if (rate.siteClassId) {
      if (rate.siteClass) {
        targetClasses = [{ id: rate.siteClass.id, defaultRate: rate.siteClass.defaultRate }];
      } else {
        const fallback = await prisma.siteClass.findUnique({
          where: { id: rate.siteClassId },
          select: { id: true, defaultRate: true }
        });
        if (fallback) targetClasses = [fallback];
      }
    } else {
      if (!siteClassesByCampground.has(rate.campgroundId)) {
        const classes = await prisma.siteClass.findMany({
          where: { campgroundId: rate.campgroundId, isActive: true },
          select: { id: true, defaultRate: true }
        });
        siteClassesByCampground.set(rate.campgroundId, classes);
      }
      targetClasses = siteClassesByCampground.get(rate.campgroundId) ?? [];
    }

    if (!targetClasses.length) {
      console.log(`[skip] Seasonal rate ${rate.id} has no site classes to apply.`);
      skippedCount += 1;
      continue;
    }

    let migratedForRate = 0;

    for (const siteClass of targetClasses) {
      const baseRate = siteClass.defaultRate ?? 0;
      const adjustmentValue = rate.amount - baseRate;

      if (adjustmentValue === 0) {
        skippedCount += 1;
        continue;
      }

      const calendarRefId = buildCalendarRefId(rate.id, rate.minNights);
      const existing = await prisma.pricingRuleV2.findFirst({
        where: {
          campgroundId: rate.campgroundId,
          siteClassId: siteClass.id,
          type: PricingRuleType.season,
          calendarRefId
        }
      });

      if (existing) {
        skippedCount += 1;
        continue;
      }

      const data = {
        campgroundId: rate.campgroundId,
        siteClassId: siteClass.id,
        name: `Legacy Seasonal: ${rate.name}`,
        type: PricingRuleType.season,
        priority: calcPriority(rate.minNights),
        stackMode: PricingStackMode.override,
        adjustmentType: AdjustmentType.flat,
        adjustmentValue,
        startDate: rate.startDate,
        endDate: rate.endDate,
        dowMask: [] as number[],
        calendarRefId,
        active: rate.isActive,
        createdBy: "migration:seasonal"
      };

      if (dryRun) {
        console.log("[dry-run] create pricingRuleV2", data);
      } else {
        await prisma.pricingRuleV2.create({ data });
      }
      createdCount += 1;
      migratedForRate += 1;
    }

    if (deactivate && !dryRun && migratedForRate > 0) {
      await prisma.seasonalRate.update({ where: { id: rate.id }, data: { isActive: false } });
    }
  }

  console.log(`Processed ${rateCount} seasonal rate(s).`);
  console.log(`Created ${createdCount} pricing rule(s).`);
  console.log(`Skipped ${skippedCount} conversion(s).`);
  if (dryRun) {
    console.log("Dry run only; no changes were written.");
  }
  if (deactivate && !dryRun) {
    console.log("Migrated seasonal rates were deactivated.");
  }
}

main()
  .catch(err => {
    console.error("Migration failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
