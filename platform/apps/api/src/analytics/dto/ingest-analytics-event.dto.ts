import { AnalyticsEventName } from "@prisma/client";
import { IsEnum, IsISO8601, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class IngestAnalyticsEventDto {
  @IsString()
  @MaxLength(128)
  sessionId!: string;

  @IsEnum(AnalyticsEventName)
  eventName!: AnalyticsEventName;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  campgroundId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  organizationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reservationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  siteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  siteClassId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  promotionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  imageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  abVariantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  page?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  referrerUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  region?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
