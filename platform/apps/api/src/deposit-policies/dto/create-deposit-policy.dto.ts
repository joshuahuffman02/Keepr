import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { DepositApplyTo, DepositDueTiming, DepositStrategy } from "@prisma/client";

// Guarded enums to avoid runtime undefined when prisma client enums are missing
const DepositStrategyFallback = { first_night: "first_night", percent: "percent", fixed: "fixed" };
const DepositApplyToFallback = {
  lodging_only: "lodging_only",
  lodging_plus_fees: "lodging_plus_fees",
};
const DepositDueTimingFallback = { at_booking: "at_booking", before_arrival: "before_arrival" };

const DepositStrategyGuard = DepositStrategy ?? DepositStrategyFallback;
const DepositApplyToGuard = DepositApplyTo ?? DepositApplyToFallback;
const DepositDueTimingGuard = DepositDueTiming ?? DepositDueTimingFallback;

export class CreateDepositPolicyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(DepositStrategyGuard)
  strategy!: DepositStrategy;

  @IsInt()
  value!: number;

  @IsOptional()
  @IsInt()
  minCap?: number | null;

  @IsOptional()
  @IsInt()
  maxCap?: number | null;

  @IsEnum(DepositApplyToGuard)
  applyTo!: DepositApplyTo;

  @IsEnum(DepositDueTimingGuard)
  dueTiming!: DepositDueTiming;

  @IsOptional()
  @IsString()
  siteClassId?: string | null;

  @IsOptional()
  @IsString()
  retryPlanId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
