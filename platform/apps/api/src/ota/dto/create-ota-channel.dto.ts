import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateOtaChannelDto {
  @IsString()
  name!: string;

  @IsString()
  provider!: string;

  @IsOptional()
  @IsString()
  status?: string; // disabled | pull | two_way

  @IsOptional()
  @IsNumber()
  rateMultiplier?: number;

  @IsOptional()
  @IsString()
  defaultStatus?: string; // confirmed | pending

  @IsOptional()
  @IsBoolean()
  sendEmailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  ignoreSiteRestrictions?: boolean;

  @IsOptional()
  @IsBoolean()
  ignoreCategoryRestrictions?: boolean;

  @IsOptional()
  @IsString()
  feeMode?: string; // absorb | pass_through

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
