import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { AdjustmentType, PricingRuleType, PricingStackMode } from "@prisma/client";

// Fallback enums in case @prisma/client enums are undefined at runtime (e.g. missing generate)
const PricingRuleTypeFallback: Record<string, string> = {
  season: "season",
  weekend: "weekend",
  holiday: "holiday",
  event: "event",
  demand: "demand",
};
const PricingStackModeFallback: Record<string, string> = {
  additive: "additive",
  max: "max",
  override: "override",
};
const AdjustmentTypeFallback: Record<string, string> = {
  percent: "percent",
  flat: "flat",
};

const PricingRuleTypeGuard = PricingRuleType ?? PricingRuleTypeFallback;
const PricingStackModeGuard = PricingStackMode ?? PricingStackModeFallback;
const AdjustmentTypeGuard = AdjustmentType ?? AdjustmentTypeFallback;

export class CreatePricingRuleV2Dto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(PricingRuleTypeGuard)
  type!: PricingRuleType;

  @IsInt()
  @Min(0)
  priority!: number;

  @IsEnum(PricingStackModeGuard)
  stackMode!: PricingStackMode;

  @IsEnum(AdjustmentTypeGuard)
  adjustmentType!: AdjustmentType;

  @IsNumber()
  adjustmentValue!: number;

  @IsOptional()
  @IsString()
  siteClassId?: string | null;

  @IsOptional()
  @IsString()
  calendarRefId?: string | null;

  @IsOptional()
  @IsString()
  demandBandId?: string | null;

  @IsOptional()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  dowMask?: number[];

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsInt()
  minRateCap?: number | null;

  @IsOptional()
  @IsInt()
  maxRateCap?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
