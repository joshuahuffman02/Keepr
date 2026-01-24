import { GamificationEventCategory, UserRole } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateGamificationSettingsDto {
  @IsString()
  campgroundId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  enabledRoles?: UserRole[];
}

export class AwardXpDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  targetUserId!: string;

  @IsEnum(GamificationEventCategory)
  category!: GamificationEventCategory;

  @IsOptional()
  @IsNumber()
  xp?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  eventKey?: string;

  @IsOptional()
  @IsString()
  membershipId?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpsertXpRuleDto {
  @IsString()
  campgroundId!: string;

  @IsEnum(GamificationEventCategory)
  category!: GamificationEventCategory;

  @IsOptional()
  @IsNumber()
  minXp?: number;

  @IsOptional()
  @IsNumber()
  maxXp?: number;

  @IsOptional()
  @IsNumber()
  defaultXp?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
