import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { ReservationStatus, StayReasonPreset } from "@prisma/client";
import { Type } from "class-transformer";

export class PolicyAcceptanceDto {
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @IsBoolean()
  accepted!: boolean;

  @IsOptional()
  @IsString()
  signerName?: string;

  @IsOptional()
  @IsEmail()
  signerEmail?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  siteClassId?: string;

  @IsOptional()
  @IsBoolean()
  siteLocked?: boolean;

  @IsString()
  @IsNotEmpty()
  guestId!: string;

  @IsDateString()
  arrivalDate!: string;

  @IsDateString()
  departureDate!: string;

  @IsInt()
  @Min(0)
  adults!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @IsInt()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  balanceAmount?: number;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  baseSubtotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  feesAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  taxesAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountsAmount?: number;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  policyVersion?: string;

  @IsOptional()
  @IsString()
  checkInWindowStart?: string;

  @IsOptional()
  @IsString()
  checkInWindowEnd?: string;

  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  @IsOptional()
  @IsString()
  vehicleState?: string;

  @IsOptional()
  @IsString()
  rigType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rigLength?: number;

  @IsOptional()
  @IsBoolean()
  requiresAccessible?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredAmenities?: string[];

  @IsOptional()
  @IsString()
  stayReasonPreset?: StayReasonPreset;

  @IsOptional()
  @IsString()
  stayReasonOther?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsString()
  referralProgramId?: string;

  @IsOptional()
  @IsString()
  referralSource?: string;

  @IsOptional()
  @IsString()
  referralChannel?: string;

  @IsOptional()
  @IsString()
  holdId?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  updatedBy?: string;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  rvType?: string;

  @IsOptional()
  @IsString()
  seasonalRateId?: string;

  @IsOptional()
  @IsString()
  pricingType?: "transient" | "seasonal";

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  paymentNotes?: string;

  @IsOptional()
  @IsString()
  overrideReason?: string;

  @IsOptional()
  @IsString()
  overrideApprovedBy?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pets?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  petTypes?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyAcceptanceDto)
  policyAcceptances?: PolicyAcceptanceDto[];
}
