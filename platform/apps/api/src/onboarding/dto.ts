import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsNumber, IsObject, IsOptional, IsString, Min } from "class-validator";

export class CreateOnboardingInviteDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  campgroundId?: string;

  @IsOptional()
  @IsString()
  campgroundName?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  expiresInHours?: number;
}

export class StartOnboardingDto {
  @IsString()
  token!: string;
}

export class UpdateOnboardingStepDto {
  @IsString()
  step!: string;

  @IsObject()
  payload!: Record<string, any>;

  @IsOptional()
  @IsString()
  token?: string;
}

export class AccountProfileDto {
  @IsString()
  campgroundName!: string;

  @IsString()
  contactName!: string;

  @IsEmail()
  contactEmail!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class PaymentGatewayDto {
  @IsString()
  provider!: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  payoutSchedule?: string;
}

export class TaxesAndFeesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lodgingTaxRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  localTaxRate?: number;

  @IsOptional()
  @IsString()
  feeNotes?: string;
}

export class InventorySitesDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  siteCount!: number;

  @IsOptional()
  @IsString()
  primaryRigTypes?: string;

  @IsOptional()
  @IsBoolean()
  hasGroups?: boolean;
}

export class RatesAndFeesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseNightlyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositPercent?: number;

  @IsOptional()
  @IsString()
  addOnNotes?: string;
}

export class PoliciesDto {
  @IsOptional()
  @IsString()
  checkInTime?: string;

  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @IsOptional()
  @IsString()
  cancellationPolicy?: string;
}

export class CommunicationsTemplatesDto {
  @IsOptional()
  @IsBoolean()
  enableSms?: boolean;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  welcomeTemplate?: string;
}

export class PosHardwareDto {
  @IsOptional()
  @IsBoolean()
  hasTerminals?: boolean;

  @IsOptional()
  @IsBoolean()
  needsKiosk?: boolean;

  @IsOptional()
  @IsString()
  primaryProvider?: string;
}

export class ImportsDto {
  @IsOptional()
  @IsString()
  sourceSystem?: string;

  @IsOptional()
  @IsBoolean()
  needsDataMigration?: boolean;

  @IsOptional()
  @IsString()
  attachmentsHint?: string;
}
