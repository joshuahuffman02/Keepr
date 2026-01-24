import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CreatePricingRuleDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @IsNotEmpty()
  ruleType!: "flat" | "percent" | "seasonal" | "dow";

  @IsOptional()
  @IsString()
  siteClassId?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsOptional()
  @IsNumber()
  percentAdjust?: number | null;

  @IsOptional()
  @IsInt()
  flatAdjust?: number | null;

  @IsOptional()
  @IsInt()
  minNights?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
