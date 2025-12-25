import { IsString, IsInt, IsPositive, IsOptional, IsIn, Min } from "class-validator";
import { Type } from "class-transformer";

export class AddWalletCreditDto {
  @IsString()
  guestId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsIn(["campground", "organization", "global"])
  scopeType?: "campground" | "organization" | "global";

  @IsOptional()
  @IsString()
  scopeId?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class DebitWalletDto {
  @IsString()
  guestId!: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsString()
  referenceType!: string;

  @IsString()
  referenceId!: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class TransferToWalletDto {
  @IsString()
  guestId!: string;

  @IsString()
  reservationId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class WalletTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  walletId?: string;
}

export interface WalletBalance {
  walletId: string;
  guestId: string;
  campgroundId: string;
  scopeType: "campground" | "organization" | "global";
  scopeId: string | null;
  balanceCents: number;
  availableCents: number;
  currency: string;
  campgroundName?: string;
  campgroundSlug?: string;
}

export interface WalletTransaction {
  id: string;
  direction: string;
  amountCents: number;
  beforeBalanceCents: number;
  afterBalanceCents: number;
  referenceType: string;
  referenceId: string;
  reason: string | null;
  createdAt: Date;
}

export interface WalletCreditResult {
  walletId: string;
  balanceCents: number;
  transactionId: string;
}

export interface WalletDebitResult {
  walletId: string;
  balanceCents: number;
  transactionId: string;
}
