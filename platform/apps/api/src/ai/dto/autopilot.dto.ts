import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
  Min,
  Max,
  IsEnum,
} from "class-validator";

// ==================== CONFIG DTOs ====================

export class UpdateAutopilotConfigDto {
  // Auto-Reply
  @IsOptional()
  @IsBoolean()
  autoReplyEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(["draft", "auto"])
  autoReplyMode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  autoReplyConfidenceThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  autoReplyDelayMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  autoReplyExcludeCategories?: string[];

  @IsOptional()
  @IsBoolean()
  autoReplyAutoSendEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  autoReplyMaxDailyAutoSends?: number;

  // Smart Waitlist
  @IsOptional()
  @IsBoolean()
  smartWaitlistEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(["suggest", "auto"])
  smartWaitlistMode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  waitlistGuestValueWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  waitlistLikelihoodWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  waitlistSeasonalWeight?: number;

  @IsOptional()
  @IsBoolean()
  waitlistAutoOfferEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  waitlistAutoOfferMinScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  waitlistAutoOfferHoldMinutes?: number;

  // Anomaly Detection
  @IsOptional()
  @IsBoolean()
  anomalyDetectionEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(["realtime", "digest", "both"])
  anomalyAlertMode?: string;

  @IsOptional()
  @IsString()
  @IsEnum(["daily", "weekly"])
  anomalyDigestSchedule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  anomalyDigestTime?: string;

  @IsOptional()
  @IsString()
  @IsEnum(["low", "medium", "high"])
  anomalySensitivity?: string;

  @IsOptional()
  @IsBoolean()
  anomalyAutoFixEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  anomalyAutoFixCategories?: string[];

  // No-Show Prediction
  @IsOptional()
  @IsBoolean()
  noShowPredictionEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  noShowThreshold?: number;

  @IsOptional()
  @IsBoolean()
  noShowAutoReminder?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(14)
  noShowReminderDaysBefore?: number;

  @IsOptional()
  @IsBoolean()
  noShowAutoReleaseEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  noShowAutoConfirmHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(48)
  noShowAutoReleaseHours?: number;

  // Dynamic Pricing
  @IsOptional()
  @IsBoolean()
  dynamicPricingAiEnabled?: boolean;

  @IsOptional()
  @IsString()
  dynamicPricingMode?: string;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  dynamicPricingMaxAdjust?: number;

  @IsOptional()
  @IsBoolean()
  dynamicPricingAutopilot?: boolean;

  // Predictive Maintenance
  @IsOptional()
  @IsBoolean()
  predictiveMaintenanceEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maintenanceAlertThreshold?: number;

  // Weather Alerts
  @IsOptional()
  @IsBoolean()
  weatherAlertsEnabled?: boolean;

  @IsOptional()
  @IsString()
  weatherApiKey?: string;

  // Phone Agent
  @IsOptional()
  @IsBoolean()
  phoneAgentEnabled?: boolean;

  @IsOptional()
  @IsString()
  phoneAgentNumber?: string;

  @IsOptional()
  @IsString()
  phoneAgentTransferNumber?: string;

  @IsOptional()
  @IsString()
  phoneAgentHoursStart?: string;

  @IsOptional()
  @IsString()
  phoneAgentHoursEnd?: string;

  @IsOptional()
  @IsString()
  phoneAgentVoice?: string;
}

// ==================== CONTEXT DTOs ====================

export class CreateContextItemDto {
  @IsString()
  @IsEnum(["faq", "policy", "training_example", "common_question"])
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string;

  @IsString()
  @MaxLength(5000)
  answer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateContextItemDto {
  @IsOptional()
  @IsString()
  @IsEnum(["faq", "policy", "training_example", "common_question"])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  answer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ==================== REPLY DRAFT DTOs ====================

export class ReviewDraftDto {
  @IsString()
  @IsEnum(["approve", "edit", "reject"])
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  editedContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

// ==================== ANOMALY DTOs ====================

export class UpdateAnomalyStatusDto {
  @IsString()
  @IsEnum(["acknowledged", "resolved", "dismissed"])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dismissedReason?: string;
}

// ==================== NO-SHOW DTOs ====================

export class MarkConfirmedDto {
  @IsOptional()
  @IsString()
  source?: string; // "guest_response" | "staff_verification" | "phone_call"
}
