import { IsArray, IsEmail, IsOptional, IsString } from "class-validator";

export class CreateSupportReportDto {
  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  steps?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  viewportWidth?: number;

  @IsOptional()
  viewportHeight?: number;

  @IsOptional()
  @IsString()
  roleFilter?: string;

  @IsArray()
  pinnedIds: string[] = [];

  @IsArray()
  recentIds: string[] = [];

  @IsOptional()
  rawContext?: unknown;

  @IsOptional()
  @IsString()
  campgroundId?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  ownershipRole?: string;
}
