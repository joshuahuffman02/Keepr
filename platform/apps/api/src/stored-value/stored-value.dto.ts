import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsInt, IsOptional, IsPositive, IsString, IsIn } from "class-validator";

export class IssueStoredValueDto {
  @IsString()
  tenantId!: string; // or campgroundId if you scope that way

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsIn(["gift", "credit"])
  type!: "gift" | "credit";

  @IsOptional()
  codeOptions?: { pin?: string; generatePin?: boolean };

  @IsOptional()
  @IsBoolean()
  taxableLoad?: boolean;

  @IsOptional()
  @IsString()
  reloadAccountId?: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class RedeemStoredValueDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  pin?: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsBoolean()
  holdOnly?: boolean;

  @IsString()
  referenceType!: string;

  @IsString()
  referenceId!: string;

  @IsOptional()
  @IsString()
  channel?: string;
}

export class ReloadStoredValueDto {
  @IsString()
  accountId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsBoolean()
  taxableLoad?: boolean;
}

export class RefundStoredValueDto {
  @IsString()
  accountId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class VoidStoredValueDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class AdjustStoredValueDto {
  @IsString()
  accountId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  deltaCents!: number;

  @IsString()
  reason!: string;
}

export class CaptureHoldDto {
  @IsString()
  holdId!: string;
}
