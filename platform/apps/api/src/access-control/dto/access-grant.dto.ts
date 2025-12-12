import { AccessCredentialType, AccessProviderType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class GrantAccessDto {
  @IsString()
  provider!: AccessProviderType;

  @IsOptional()
  @IsString()
  credentialType?: AccessCredentialType;

  @IsOptional()
  @IsString()
  credentialValue?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;
}

export class RevokeAccessDto {
  @IsString()
  provider!: AccessProviderType;

  @IsOptional()
  @IsString()
  providerAccessId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AccessWebhookDto {
  @IsOptional()
  @IsString()
  signature?: string;
}
