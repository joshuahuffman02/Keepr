import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsEnum,
  IsNumber,
  IsDateString,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import {
  SeasonalStatus,
  RenewalIntent,
  SeasonalPaymentMethod,
  SeasonalBillingFrequency,
  SeasonalDiscountCondition,
  SeasonalDiscountType,
  SeasonalIncentiveType,
} from ".prisma/client";

// ==================== SEASONAL GUEST DTOs ====================

export class CreateSeasonalGuestDto {
  @IsString()
  campgroundId: string;

  @IsString()
  guestId: string;

  @IsInt()
  firstSeasonYear: number;

  @IsOptional()
  @IsString()
  currentSiteId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSites?: string[];

  @IsOptional()
  @IsEnum(SeasonalPaymentMethod)
  preferredPaymentMethod?: SeasonalPaymentMethod;

  @IsOptional()
  @IsBoolean()
  paysInFull?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPayEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  paymentDay?: number;

  @IsOptional()
  @IsBoolean()
  isMetered?: boolean;

  @IsOptional()
  @IsBoolean()
  meteredElectric?: boolean;

  @IsOptional()
  @IsBoolean()
  meteredWater?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateSeasonalGuestDto {
  @IsOptional()
  @IsString()
  currentSiteId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSites?: string[];

  @IsOptional()
  @IsEnum(SeasonalStatus)
  status?: SeasonalStatus;

  @IsOptional()
  @IsEnum(RenewalIntent)
  renewalIntent?: RenewalIntent;

  @IsOptional()
  @IsString()
  renewalNotes?: string;

  @IsOptional()
  @IsEnum(SeasonalPaymentMethod)
  preferredPaymentMethod?: SeasonalPaymentMethod;

  @IsOptional()
  @IsBoolean()
  paysInFull?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPayEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  paymentDay?: number;

  @IsOptional()
  @IsBoolean()
  isMetered?: boolean;

  @IsOptional()
  @IsBoolean()
  meteredElectric?: boolean;

  @IsOptional()
  @IsBoolean()
  meteredWater?: boolean;

  @IsOptional()
  @IsDateString()
  coiExpiresAt?: string;

  @IsOptional()
  @IsString()
  coiDocumentUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vehiclePlates?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  petCount?: number;

  @IsOptional()
  @IsString()
  petNotes?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateRenewalIntentDto {
  @IsEnum(RenewalIntent)
  intent: RenewalIntent;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ==================== PAYMENT DTOs ====================

export class RecordPaymentDto {
  @IsString()
  seasonalGuestId: string;

  @IsInt()
  seasonYear: number;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(SeasonalPaymentMethod)
  paymentMethod: SeasonalPaymentMethod;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  checkNumber?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ==================== RATE CARD DTOs ====================

export class CreateRateCardDto {
  @IsString()
  campgroundId: string;

  @IsString()
  name: string;

  @IsInt()
  seasonYear: number;

  @IsNumber()
  @Min(0)
  baseRate: number;

  @IsOptional()
  @IsEnum(SeasonalBillingFrequency)
  billingFrequency?: SeasonalBillingFrequency;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includedUtilities?: string[];

  @IsDateString()
  seasonStartDate: string;

  @IsDateString()
  seasonEndDate: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateRateCardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseRate?: number;

  @IsOptional()
  @IsEnum(SeasonalBillingFrequency)
  billingFrequency?: SeasonalBillingFrequency;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includedUtilities?: string[];

  @IsOptional()
  @IsDateString()
  seasonStartDate?: string;

  @IsOptional()
  @IsDateString()
  seasonEndDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateDiscountDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(SeasonalDiscountCondition)
  conditionType: SeasonalDiscountCondition;

  @IsOptional()
  @IsString()
  conditionValue?: string; // JSON string

  @IsEnum(SeasonalDiscountType)
  discountType: SeasonalDiscountType;

  @IsNumber()
  @Min(0)
  discountAmount: number;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class CreateIncentiveDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(SeasonalDiscountCondition)
  conditionType: SeasonalDiscountCondition;

  @IsOptional()
  @IsString()
  conditionValue?: string; // JSON string

  @IsEnum(SeasonalIncentiveType)
  incentiveType: SeasonalIncentiveType;

  @IsNumber()
  @Min(0)
  incentiveValue: number;

  @IsOptional()
  @IsString()
  incentiveDetails?: string; // JSON string
}

// ==================== PRICING PREVIEW DTOs ====================

export class PricingPreviewDto {
  @IsString()
  rateCardId: string;

  @IsBoolean()
  isMetered: boolean;

  @IsOptional()
  @IsEnum(SeasonalPaymentMethod)
  paymentMethod?: SeasonalPaymentMethod;

  @IsBoolean()
  paysInFull: boolean;

  @IsInt()
  @Min(0)
  tenureYears: number;

  @IsOptional()
  @IsDateString()
  commitDate?: string;

  @IsBoolean()
  isReturning: boolean;

  @IsOptional()
  @IsString()
  siteClassId?: string;

  @IsOptional()
  @IsBoolean()
  isReferral?: boolean;

  @IsOptional()
  @IsBoolean()
  isMilitary?: boolean;

  @IsOptional()
  @IsBoolean()
  isSenior?: boolean;
}

// ==================== BULK COMMUNICATION DTOs ====================

export class BulkMessageDto {
  @IsString()
  campgroundId: string;

  @IsArray()
  @IsString({ each: true })
  seasonalGuestIds: string[];

  @IsEnum(["email", "sms"])
  channel: "email" | "sms";

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body: string;

  @IsOptional()
  templateTokens?: Record<string, string>;
}

// ==================== QUERY DTOs ====================

export class SeasonalGuestQueryDto {
  @IsOptional()
  @IsString()
  status?: string; // Can be comma-separated

  @IsOptional()
  @IsString()
  renewalIntent?: string; // Can be comma-separated

  @IsOptional()
  @IsString()
  paymentStatus?: "current" | "past_due" | "paid_ahead";

  @IsOptional()
  @IsString()
  contractStatus?: "signed" | "pending" | "not_sent";

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  tenureMin?: string;

  @IsOptional()
  @IsString()
  tenureMax?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  offset?: string;
}
