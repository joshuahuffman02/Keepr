import { IsBoolean, IsNumber, IsOptional, IsString, IsArray, MaxLength, Min, Max, IsEnum } from "class-validator";

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
