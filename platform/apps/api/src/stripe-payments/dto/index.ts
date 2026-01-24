import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsIn,
  Min,
  ValidateNested,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";

// =============================================================================
// CUSTOMER DTOs
// =============================================================================

export class CreateCustomerDto {
  @IsString()
  guestId!: string;
}

// =============================================================================
// PAYMENT METHOD DTOs
// =============================================================================

export class CreateSetupIntentDto {
  @IsString()
  guestId!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class AttachPaymentMethodDto {
  @IsString()
  guestId!: string;

  @IsString()
  stripePaymentMethodId!: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  nickname?: string;
}

// =============================================================================
// TERMINAL LOCATION DTOs
// =============================================================================

export class TerminalAddressDto {
  @IsString()
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  postal_code!: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateTerminalLocationDto {
  @IsString()
  displayName!: string;

  @ValidateNested()
  @Type(() => TerminalAddressDto)
  address!: TerminalAddressDto;
}

// =============================================================================
// TERMINAL READER DTOs
// =============================================================================

export class RegisterTerminalReaderDto {
  @IsString()
  registrationCode!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  locationId?: string;
}

export class UpdateTerminalReaderDto {
  @IsString()
  label!: string;
}

// =============================================================================
// TERMINAL PAYMENT DTOs
// =============================================================================

export class CreateTerminalPaymentDto {
  @IsString()
  readerId!: string;

  @IsInt()
  @Min(50)
  amountCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  guestId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsBoolean()
  saveCard?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class ProcessOnReaderDto {
  @IsString()
  readerId!: string;
}

// =============================================================================
// SAVED CARD CHARGE DTOs
// =============================================================================

export class ChargeSavedCardDto {
  @IsString()
  guestId!: string;

  @IsString()
  paymentMethodId!: string;

  @IsInt()
  @Min(50)
  amountCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class ChargeDefaultCardDto {
  @IsString()
  guestId!: string;

  @IsInt()
  @Min(50)
  amountCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

// =============================================================================
// REFUND DTOs
// =============================================================================

export class ProcessRefundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsIn(["duplicate", "fraudulent", "requested_by_customer"])
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";

  @IsOptional()
  @IsString()
  note?: string;
}
