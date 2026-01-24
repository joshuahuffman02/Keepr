import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  SeasonalDiscountCondition,
  SeasonalDiscountType,
  SeasonalIncentiveType,
  SeasonalBillingFrequency,
  SeasonalPaymentMethod,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";

export interface GuestPricingContext {
  isMetered: boolean;
  meteredElectric?: boolean;
  meteredWater?: boolean;
  paymentMethod?: SeasonalPaymentMethod;
  paysInFull: boolean;
  tenureYears: number;
  commitDate?: Date;
  isReturning: boolean;
  siteClassId?: string;
  isReferral?: boolean;
  isMilitary?: boolean;
  isSenior?: boolean;
}

export interface AppliedDiscount {
  discountId: string;
  name: string;
  amount: number;
  condition: SeasonalDiscountCondition;
  description?: string;
}

export interface EarnedIncentive {
  incentiveId: string;
  name: string;
  type: SeasonalIncentiveType;
  value: number;
  description: string;
  status: "pending" | "awarded" | "redeemed";
  awardedAt?: Date;
}

export interface PaymentScheduleItem {
  dueDate: Date;
  amount: number;
  description: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface PricingCalculation {
  baseRate: number;
  appliedDiscounts: AppliedDiscount[];
  totalDiscount: number;
  finalRate: number;
  earnedIncentives: EarnedIncentive[];
  paymentSchedule: PaymentScheduleItem[];
  billingFrequency: SeasonalBillingFrequency;
}

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class SeasonalPricingService {
  private readonly logger = new Logger(SeasonalPricingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate pricing for a seasonal guest based on rate card and guest context
   */
  async calculatePricing(
    rateCardId: string,
    guestContext: GuestPricingContext,
    overrideBillingFrequency?: SeasonalBillingFrequency,
  ): Promise<PricingCalculation> {
    const rateCard = await this.prisma.seasonalRateCard.findUnique({
      where: { id: rateCardId },
      include: {
        SeasonalDiscount: {
          where: { isActive: true },
          orderBy: { priority: "desc" },
        },
        SeasonalIncentive: {
          where: { isActive: true },
        },
      },
    });

    if (!rateCard) {
      throw new NotFoundException(`Rate card ${rateCardId} not found`);
    }

    const baseRate = rateCard.baseRate.toNumber();
    let runningTotal = baseRate;
    const appliedDiscounts: AppliedDiscount[] = [];
    const earnedIncentives: EarnedIncentive[] = [];

    // Evaluate each discount
    for (const discount of rateCard.SeasonalDiscount) {
      if (this.evaluateCondition(discount.conditionType, discount.conditionValue, guestContext)) {
        const amount = this.calculateDiscountAmount(
          discount.discountType,
          discount.discountAmount.toNumber(),
          runningTotal,
          rateCard.seasonStartDate,
          rateCard.seasonEndDate,
        );

        appliedDiscounts.push({
          discountId: discount.id,
          name: discount.name,
          amount,
          condition: discount.conditionType,
          description: discount.description || undefined,
        });

        // Apply discount to running total if stackable
        if (discount.stackable) {
          runningTotal -= amount;
        }
      }
    }

    // Ensure we don't go negative
    runningTotal = Math.max(0, runningTotal);

    // Evaluate incentives
    for (const incentive of rateCard.SeasonalIncentive) {
      if (this.evaluateCondition(incentive.conditionType, incentive.conditionValue, guestContext)) {
        earnedIncentives.push({
          incentiveId: incentive.id,
          name: incentive.name,
          type: incentive.incentiveType,
          value: incentive.incentiveValue.toNumber(),
          description: this.getIncentiveDescription(
            incentive.incentiveType,
            incentive.incentiveValue.toNumber(),
          ),
          status: "pending",
        });
      }
    }

    // Determine billing frequency
    const billingFrequency =
      overrideBillingFrequency ||
      (guestContext.paysInFull ? SeasonalBillingFrequency.seasonal : rateCard.billingFrequency);

    // Generate payment schedule
    const paymentSchedule = this.generatePaymentSchedule(
      runningTotal,
      billingFrequency,
      rateCard.seasonStartDate,
      rateCard.seasonEndDate,
    );

    return {
      baseRate,
      appliedDiscounts,
      totalDiscount: appliedDiscounts.reduce((sum, d) => sum + d.amount, 0),
      finalRate: runningTotal,
      earnedIncentives,
      paymentSchedule,
      billingFrequency,
    };
  }

  /**
   * Evaluate whether a discount/incentive condition is met
   */
  private evaluateCondition(
    type: SeasonalDiscountCondition,
    conditionValue: string | null,
    ctx: GuestPricingContext,
  ): boolean {
    try {
      const parsedValue = conditionValue ? JSON.parse(conditionValue) : {};

      switch (type) {
        case SeasonalDiscountCondition.metered_utilities:
          return ctx.isMetered;

        case SeasonalDiscountCondition.pay_in_full:
          return ctx.paysInFull;

        case SeasonalDiscountCondition.payment_method:
          const allowedMethods: string[] = parsedValue.methods || [];
          return ctx.paymentMethod ? allowedMethods.includes(ctx.paymentMethod) : false;

        case SeasonalDiscountCondition.early_bird:
          if (!ctx.commitDate || !parsedValue.deadline) return false;
          const deadline = new Date(parsedValue.deadline);
          return ctx.commitDate <= deadline;

        case SeasonalDiscountCondition.returning_guest:
          return ctx.isReturning;

        case SeasonalDiscountCondition.tenure_years:
          const minYears = parsedValue.minYears || 1;
          return ctx.tenureYears >= minYears;

        case SeasonalDiscountCondition.site_class:
          const allowedClasses: string[] = parsedValue.siteClassIds || [];
          return ctx.siteClassId ? allowedClasses.includes(ctx.siteClassId) : false;

        case SeasonalDiscountCondition.referral:
          return ctx.isReferral || false;

        case SeasonalDiscountCondition.military:
          return ctx.isMilitary || false;

        case SeasonalDiscountCondition.senior:
          return ctx.isSenior || false;

        case SeasonalDiscountCondition.custom:
          // Custom conditions need to be evaluated based on specific logic
          // For now, return false unless explicitly handled
          this.logger.warn(`Custom condition evaluation not implemented: ${conditionValue}`);
          return false;

        default:
          return false;
      }
    } catch (error) {
      this.logger.error(`Error evaluating condition ${type}: ${error}`);
      return false;
    }
  }

  /**
   * Calculate the actual discount amount based on type
   */
  private calculateDiscountAmount(
    type: SeasonalDiscountType,
    amount: number,
    baseAmount: number,
    seasonStart: Date,
    seasonEnd: Date,
  ): number {
    switch (type) {
      case SeasonalDiscountType.fixed_amount:
        return amount;

      case SeasonalDiscountType.percentage:
        return (baseAmount * amount) / 100;

      case SeasonalDiscountType.per_month:
        // Calculate number of months in season
        const months = this.getMonthsBetween(seasonStart, seasonEnd);
        return amount * months;

      default:
        return 0;
    }
  }

  /**
   * Get human-readable description for an incentive
   */
  private getIncentiveDescription(type: SeasonalIncentiveType, value: number): string {
    switch (type) {
      case SeasonalIncentiveType.guest_passes:
        return `$${value} in guest day passes`;
      case SeasonalIncentiveType.store_credit:
        return `$${value} store credit`;
      case SeasonalIncentiveType.free_nights:
        return `${value} free nights for next season`;
      case SeasonalIncentiveType.early_site_selection:
        return "Priority site selection for next season";
      case SeasonalIncentiveType.rate_lock:
        return "Rate locked for next season";
      case SeasonalIncentiveType.amenity_access:
        return `$${value} amenity credit`;
      case SeasonalIncentiveType.custom:
        return `Custom reward ($${value} value)`;
      default:
        return `Reward ($${value} value)`;
    }
  }

  /**
   * Generate payment schedule based on billing frequency
   */
  private generatePaymentSchedule(
    totalAmount: number,
    frequency: SeasonalBillingFrequency,
    seasonStart: Date,
    seasonEnd: Date,
  ): PaymentScheduleItem[] {
    const schedule: PaymentScheduleItem[] = [];
    const startDate = new Date(seasonStart);
    const endDate = new Date(seasonEnd);

    switch (frequency) {
      case SeasonalBillingFrequency.seasonal:
        // Single payment for full season
        schedule.push({
          dueDate: startDate,
          amount: totalAmount,
          description: "Full Season Payment",
          periodStart: startDate,
          periodEnd: endDate,
        });
        break;

      case SeasonalBillingFrequency.semi_annual:
        // Two payments
        const midPoint = new Date(startDate);
        midPoint.setMonth(
          midPoint.getMonth() + Math.floor(this.getMonthsBetween(startDate, endDate) / 2),
        );

        schedule.push({
          dueDate: startDate,
          amount: totalAmount / 2,
          description: "First Half Payment",
          periodStart: startDate,
          periodEnd: midPoint,
        });
        schedule.push({
          dueDate: midPoint,
          amount: totalAmount / 2,
          description: "Second Half Payment",
          periodStart: midPoint,
          periodEnd: endDate,
        });
        break;

      case SeasonalBillingFrequency.quarterly:
        // Four payments (or based on season length)
        const quarterMonths = Math.ceil(this.getMonthsBetween(startDate, endDate) / 4);
        let quarterStart = new Date(startDate);

        for (let i = 0; i < 4; i++) {
          const quarterEnd = new Date(quarterStart);
          quarterEnd.setMonth(quarterEnd.getMonth() + quarterMonths);
          if (quarterEnd > endDate) quarterEnd.setTime(endDate.getTime());

          if (quarterStart < endDate) {
            schedule.push({
              dueDate: new Date(quarterStart),
              amount: totalAmount / 4,
              description: `Q${i + 1} Payment`,
              periodStart: new Date(quarterStart),
              periodEnd: quarterEnd,
            });
          }

          quarterStart = new Date(quarterEnd);
        }
        break;

      case SeasonalBillingFrequency.biweekly:
        // Bi-weekly payments (every 2 weeks)
        const totalDays = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const biweeklyPeriods = Math.ceil(totalDays / 14);
        const biweeklyAmount = totalAmount / biweeklyPeriods;
        let biweeklyDate = new Date(startDate);

        for (let i = 0; i < biweeklyPeriods; i++) {
          const periodStart = new Date(biweeklyDate);
          const periodEnd = new Date(biweeklyDate);
          periodEnd.setDate(periodEnd.getDate() + 14);
          if (periodEnd > endDate) periodEnd.setTime(endDate.getTime());

          schedule.push({
            dueDate: new Date(biweeklyDate),
            amount: Math.round(biweeklyAmount * 100) / 100,
            description: `Bi-weekly Payment ${i + 1}`,
            periodStart,
            periodEnd,
          });

          biweeklyDate.setDate(biweeklyDate.getDate() + 14);
          if (biweeklyDate >= endDate) break;
        }
        break;

      case SeasonalBillingFrequency.semi_monthly:
        // Semi-monthly (1st and 15th of each month)
        const semiMonthlyMonths = this.getMonthsBetween(startDate, endDate);
        const semiMonthlyPeriods = semiMonthlyMonths * 2;
        const semiMonthlyAmount = totalAmount / semiMonthlyPeriods;
        let semiMonthlyDate = new Date(startDate);

        for (let month = 0; month < semiMonthlyMonths; month++) {
          // 1st of month payment
          const firstDate = new Date(
            semiMonthlyDate.getFullYear(),
            semiMonthlyDate.getMonth() + month,
            1,
          );
          if (firstDate >= startDate && firstDate <= endDate) {
            const firstEnd = new Date(firstDate.getFullYear(), firstDate.getMonth(), 15);
            schedule.push({
              dueDate: firstDate,
              amount: Math.round(semiMonthlyAmount * 100) / 100,
              description: `${firstDate.toLocaleString("default", { month: "short" })} 1st Payment`,
              periodStart: firstDate,
              periodEnd: firstEnd > endDate ? endDate : firstEnd,
            });
          }

          // 15th of month payment
          const fifteenthDate = new Date(
            semiMonthlyDate.getFullYear(),
            semiMonthlyDate.getMonth() + month,
            15,
          );
          if (fifteenthDate >= startDate && fifteenthDate <= endDate) {
            const fifteenthEnd = new Date(
              fifteenthDate.getFullYear(),
              fifteenthDate.getMonth() + 1,
              1,
            );
            schedule.push({
              dueDate: fifteenthDate,
              amount: Math.round(semiMonthlyAmount * 100) / 100,
              description: `${fifteenthDate.toLocaleString("default", { month: "short" })} 15th Payment`,
              periodStart: fifteenthDate,
              periodEnd: fifteenthEnd > endDate ? endDate : fifteenthEnd,
            });
          }
        }
        break;

      case SeasonalBillingFrequency.deposit_plus_monthly:
        // Deposit (typically 25-50%) upfront, then monthly payments for remainder
        const depositPercent = 0.25; // 25% deposit
        const depositAmount = totalAmount * depositPercent;
        const remainingAmount = totalAmount - depositAmount;
        const depositMonths = this.getMonthsBetween(startDate, endDate) - 1; // -1 because deposit covers first month
        const depositMonthlyAmount = remainingAmount / Math.max(1, depositMonths);

        // Deposit payment
        schedule.push({
          dueDate: startDate,
          amount: Math.round(depositAmount * 100) / 100,
          description: "Deposit Payment",
          periodStart: startDate,
          periodEnd: new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            startDate.getDate(),
          ),
        });

        // Monthly payments for remainder
        let depositDate = new Date(startDate);
        depositDate.setMonth(depositDate.getMonth() + 1);

        for (let i = 0; i < depositMonths && depositDate < endDate; i++) {
          const periodStart = new Date(depositDate);
          const periodEnd = new Date(depositDate);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          if (periodEnd > endDate) periodEnd.setTime(endDate.getTime());

          const monthName = depositDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          });

          schedule.push({
            dueDate: new Date(depositDate),
            amount: Math.round(depositMonthlyAmount * 100) / 100,
            description: monthName,
            periodStart,
            periodEnd,
          });

          depositDate.setMonth(depositDate.getMonth() + 1);
        }
        break;

      case SeasonalBillingFrequency.offseason_installments:
        // Payments during off-season (before season starts)
        // Typically Oct-Apr for a May-Sep season
        const offseasonMonths = 6; // 6 monthly payments before season
        const offseasonAmount = totalAmount / offseasonMonths;
        const offseasonStart = new Date(startDate);
        offseasonStart.setMonth(offseasonStart.getMonth() - offseasonMonths);

        for (let i = 0; i < offseasonMonths; i++) {
          const paymentDate = new Date(offseasonStart);
          paymentDate.setMonth(paymentDate.getMonth() + i);

          const monthName = paymentDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          });

          schedule.push({
            dueDate: paymentDate,
            amount: Math.round(offseasonAmount * 100) / 100,
            description: `${monthName} (Off-Season)`,
            periodStart: paymentDate,
            periodEnd: new Date(
              paymentDate.getFullYear(),
              paymentDate.getMonth() + 1,
              paymentDate.getDate(),
            ),
          });
        }
        break;

      case SeasonalBillingFrequency.custom:
        // Custom schedules need to be handled separately with manual schedule input
        // For now, fall back to monthly
        this.logger.warn("Custom billing frequency - falling back to monthly schedule");
      // Fall through to monthly...

      case SeasonalBillingFrequency.monthly:
      default:
        // Monthly payments
        const months = this.getMonthsBetween(startDate, endDate);
        const monthlyAmount = totalAmount / months;
        let currentDate = new Date(startDate);

        for (let i = 0; i < months; i++) {
          const periodStart = new Date(currentDate);
          const periodEnd = new Date(currentDate);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          if (periodEnd > endDate) periodEnd.setTime(endDate.getTime());

          const monthName = currentDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          });

          schedule.push({
            dueDate: new Date(currentDate),
            amount: Math.round(monthlyAmount * 100) / 100, // Round to cents
            description: monthName,
            periodStart,
            periodEnd,
          });

          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        break;
    }

    return schedule;
  }

  /**
   * Calculate number of months between two dates
   */
  private getMonthsBetween(start: Date, end: Date): number {
    const startDate = new Date(start);
    const endDate = new Date(end);

    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
    months += endDate.getMonth() - startDate.getMonth();

    // Add partial month if end date is past start day of month
    if (endDate.getDate() >= startDate.getDate()) {
      months += 1;
    }

    return Math.max(1, months);
  }

  /**
   * Apply pricing to a seasonal guest and create/update their pricing record
   */
  async applyPricingToGuest(
    seasonalGuestId: string,
    rateCardId: string,
    seasonYear: number,
    manualAdjustment?: { amount: number; reason: string; userId: string },
  ): Promise<void> {
    const seasonalGuest = await this.prisma.seasonalGuest.findUnique({
      where: { id: seasonalGuestId },
    });

    if (!seasonalGuest) {
      throw new NotFoundException(`Seasonal guest ${seasonalGuestId} not found`);
    }

    // Build guest context from seasonal guest record
    const guestContext: GuestPricingContext = {
      isMetered: seasonalGuest.isMetered,
      meteredElectric: seasonalGuest.meteredElectric,
      meteredWater: seasonalGuest.meteredWater,
      paymentMethod: seasonalGuest.preferredPaymentMethod || undefined,
      paysInFull: seasonalGuest.paysInFull,
      tenureYears: seasonalGuest.totalSeasons,
      isReturning: seasonalGuest.totalSeasons > 1,
    };

    // Calculate pricing
    const pricing = await this.calculatePricing(rateCardId, guestContext);

    // Apply manual adjustment if provided
    let finalRate = pricing.finalRate;
    if (manualAdjustment) {
      finalRate += manualAdjustment.amount;
    }

    // Upsert pricing record
    await this.prisma.seasonalGuestPricing.upsert({
      where: {
        seasonalGuestId_seasonYear: {
          seasonalGuestId,
          seasonYear,
        },
      },
      create: {
        id: randomUUID(),
        seasonalGuestId,
        rateCardId,
        seasonYear,
        baseRate: pricing.baseRate,
        totalDiscount: pricing.totalDiscount,
        finalRate,
        appliedDiscounts: toJsonValue(pricing.appliedDiscounts) ?? [],
        earnedIncentives: toJsonValue(pricing.earnedIncentives) ?? [],
        paymentSchedule: toJsonValue(pricing.paymentSchedule) ?? [],
        billingFrequency: pricing.billingFrequency,
        manualAdjustment: manualAdjustment?.amount,
        adjustmentReason: manualAdjustment?.reason,
        adjustmentBy: manualAdjustment?.userId,
        updatedAt: new Date(),
      },
      update: {
        rateCardId,
        baseRate: pricing.baseRate,
        totalDiscount: pricing.totalDiscount,
        finalRate,
        appliedDiscounts: toJsonValue(pricing.appliedDiscounts) ?? [],
        earnedIncentives: toJsonValue(pricing.earnedIncentives) ?? [],
        paymentSchedule: toJsonValue(pricing.paymentSchedule) ?? [],
        billingFrequency: pricing.billingFrequency,
        manualAdjustment: manualAdjustment?.amount,
        adjustmentReason: manualAdjustment?.reason,
        adjustmentBy: manualAdjustment?.userId,
      },
    });

    this.logger.log(
      `Applied pricing to seasonal guest ${seasonalGuestId} for season ${seasonYear}`,
    );
  }

  /**
   * Preview pricing for a potential seasonal guest (doesn't save)
   */
  async previewPricing(
    rateCardId: string,
    guestContext: GuestPricingContext,
  ): Promise<PricingCalculation> {
    return this.calculatePricing(rateCardId, guestContext);
  }
}
