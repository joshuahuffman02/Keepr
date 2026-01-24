import { AnalyticsEventName } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

/**
 * Enhanced event tracking DTO for admin/staff actions
 * Includes additional context for staff usage analytics
 */
export class TrackAdminEventDto {
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

  // Admin-specific fields
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  page?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  pageTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  featureArea?: string; // reservations, pos, housekeeping, reports, etc.

  @IsOptional()
  @IsString()
  @MaxLength(64)
  actionType?: string; // create, update, delete, view, search, export

  @IsOptional()
  @IsString()
  @MaxLength(64)
  actionTarget?: string; // reservation, guest, payment, site, etc.

  @IsOptional()
  @IsString()
  @MaxLength(256)
  searchQuery?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeOnPageSecs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  scrollDepth?: number; // 0-100

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  userAgent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  browser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  os?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  screenSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  errorMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  errorCode?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for tracking session lifecycle events
 */
export class TrackSessionDto {
  @IsString()
  @MaxLength(128)
  sessionId!: string;

  @IsString()
  actorType!: "staff" | "guest" | "anonymous";

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  guestId?: string;

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
  @MaxLength(256)
  entryPage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  browser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  os?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  screenSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  utmCampaign?: string;
}

/**
 * DTO for updating session with heartbeat/end data
 */
export class UpdateSessionDto {
  @IsString()
  @MaxLength(128)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  currentPage?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pageViews?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  errors?: number;

  @IsOptional()
  @IsString({ each: true })
  pages?: string[];

  @IsOptional()
  @IsISO8601()
  endedAt?: string;
}

/**
 * DTO for tracking funnel progression
 */
export class TrackFunnelDto {
  @IsString()
  @MaxLength(128)
  sessionId!: string;

  @IsString()
  @MaxLength(64)
  funnelName!: string; // booking, checkin, payment, onboarding

  @IsInt()
  @Min(1)
  step!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  stepName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  campgroundId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  organizationId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for marking funnel completion or abandonment
 */
export class CompleteFunnelDto {
  @IsString()
  @MaxLength(128)
  sessionId!: string;

  @IsString()
  @MaxLength(64)
  funnelName!: string;

  @IsString()
  @MaxLength(64)
  campgroundId!: string;

  @IsOptional()
  @IsString()
  outcome!: "completed" | "abandoned";

  @IsOptional()
  @IsInt()
  @Min(1)
  abandonedStep?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  abandonReason?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for tracking feature usage
 */
export class TrackFeatureUsageDto {
  @IsString()
  @MaxLength(128)
  sessionId!: string;

  @IsString()
  @MaxLength(64)
  feature!: string; // pos, housekeeping, reports, ai_pricing, etc.

  @IsOptional()
  @IsString()
  @MaxLength(64)
  subFeature?: string; // pos.checkout, reports.revenue, etc.

  @IsString()
  @MaxLength(64)
  campgroundId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSecs?: number;

  @IsOptional()
  @IsString()
  outcome?: "success" | "failure" | "partial";

  @IsOptional()
  @IsString()
  @MaxLength(256)
  errorMessage?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
