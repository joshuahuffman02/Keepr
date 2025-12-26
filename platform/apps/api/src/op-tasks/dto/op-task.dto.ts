import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsDateString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  OpTaskCategory,
  OpTaskState,
  OpTaskPriority,
  OpSlaStatus,
  OpTriggerEvent,
  OpRecurrencePattern,
} from '@prisma/client';

// ============================================================================
// TASK DTOs
// ============================================================================

export class CreateOpTaskDto {
  @IsEnum(OpTaskCategory)
  category!: OpTaskCategory;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(OpTaskPriority)
  priority?: OpTaskPriority;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  locationDescription?: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  assignedToTeamId?: string;

  @IsOptional()
  @IsDateString()
  slaDueAt?: string;

  @IsOptional()
  @IsArray()
  checklist?: ChecklistItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isBlocking?: boolean;

  @IsOptional()
  @IsString()
  templateId?: string;
}

export class UpdateOpTaskDto {
  @IsOptional()
  @IsEnum(OpTaskState)
  state?: OpTaskState;

  @IsOptional()
  @IsEnum(OpTaskPriority)
  priority?: OpTaskPriority;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  assignedToTeamId?: string;

  @IsOptional()
  @IsDateString()
  slaDueAt?: string;

  @IsOptional()
  @IsArray()
  checklist?: ChecklistItemDto[];

  @IsOptional()
  @IsArray()
  photos?: PhotoDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isBlocking?: boolean;

  @IsOptional()
  @IsBoolean()
  outOfOrder?: boolean;

  @IsOptional()
  @IsString()
  outOfOrderReason?: string;

  @IsOptional()
  @IsDateString()
  outOfOrderUntil?: string;
}

export class ChecklistItemDto {
  @IsString()
  id!: string;

  @IsString()
  text!: string;

  @IsBoolean()
  completed!: boolean;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  completedBy?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class PhotoDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsDateString()
  uploadedAt?: string;

  @IsOptional()
  @IsString()
  uploadedBy?: string;
}

export class OpTaskQueryDto {
  @IsOptional()
  @IsArray()
  @IsEnum(OpTaskCategory, { each: true })
  categories?: OpTaskCategory[];

  @IsOptional()
  @IsArray()
  @IsEnum(OpTaskState, { each: true })
  states?: OpTaskState[];

  @IsOptional()
  @IsArray()
  @IsEnum(OpTaskPriority, { each: true })
  priorities?: OpTaskPriority[];

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  assignedToTeamId?: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsEnum(OpSlaStatus)
  slaStatus?: OpSlaStatus;

  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @IsOptional()
  @IsDateString()
  dueAfter?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

// ============================================================================
// TEMPLATE DTOs
// ============================================================================

export class CreateOpTaskTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(OpTaskCategory)
  category!: OpTaskCategory;

  @IsOptional()
  @IsEnum(OpTaskPriority)
  priority?: OpTaskPriority;

  @IsOptional()
  @IsArray()
  checklistTemplate?: ChecklistTemplateItemDto[];

  @IsOptional()
  @IsArray()
  suppliesNeeded?: SupplyItemDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  slaMinutes?: number;

  @IsOptional()
  @IsString()
  defaultTeamId?: string;

  @IsOptional()
  @IsString()
  defaultAssigneeId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteClassIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  xpValue?: number;
}

export class UpdateOpTaskTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(OpTaskCategory)
  category?: OpTaskCategory;

  @IsOptional()
  @IsEnum(OpTaskPriority)
  priority?: OpTaskPriority;

  @IsOptional()
  @IsArray()
  checklistTemplate?: ChecklistTemplateItemDto[];

  @IsOptional()
  @IsArray()
  suppliesNeeded?: SupplyItemDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  slaMinutes?: number;

  @IsOptional()
  @IsString()
  defaultTeamId?: string;

  @IsOptional()
  @IsString()
  defaultAssigneeId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteClassIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  xpValue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ChecklistTemplateItemDto {
  @IsString()
  id!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;
}

export class SupplyItemDto {
  @IsString()
  item!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ============================================================================
// TRIGGER DTOs
// ============================================================================

// TriggerConditionsDto must be defined before classes that reference it
export class TriggerConditionsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteClassIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  minNights?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxNights?: number;

  @IsOptional()
  @IsBoolean()
  hasPets?: boolean;

  @IsOptional()
  @IsString()
  stayType?: string;
}

export class CreateOpTaskTriggerDto {
  @IsString()
  name!: string;

  @IsEnum(OpTriggerEvent)
  triggerEvent!: OpTriggerEvent;

  @IsString()
  templateId!: string;

  @IsOptional()
  conditions?: TriggerConditionsDto;

  @IsOptional()
  @IsInt()
  slaOffsetMinutes?: number;

  @IsOptional()
  @IsString()
  assignToTeamId?: string;

  @IsOptional()
  @IsString()
  assignToUserId?: string;
}

export class UpdateOpTaskTriggerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(OpTriggerEvent)
  triggerEvent?: OpTriggerEvent;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  conditions?: TriggerConditionsDto;

  @IsOptional()
  @IsInt()
  slaOffsetMinutes?: number;

  @IsOptional()
  @IsString()
  assignToTeamId?: string;

  @IsOptional()
  @IsString()
  assignToUserId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============================================================================
// RECURRENCE DTOs
// ============================================================================

export class CreateOpRecurrenceRuleDto {
  @IsString()
  name!: string;

  @IsString()
  templateId!: string;

  @IsEnum(OpRecurrencePattern)
  pattern!: OpRecurrencePattern;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  daysOfMonth?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  generateAtHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  generateAtMinute?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteClassIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteIds?: string[];

  @IsOptional()
  @IsString()
  locationFilter?: string;

  @IsOptional()
  @IsString()
  assignToTeamId?: string;

  @IsOptional()
  @IsString()
  assignToUserId?: string;
}

export class UpdateOpRecurrenceRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsEnum(OpRecurrencePattern)
  pattern?: OpRecurrencePattern;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  daysOfMonth?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  generateAtHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  generateAtMinute?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteClassIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteIds?: string[];

  @IsOptional()
  @IsString()
  locationFilter?: string;

  @IsOptional()
  @IsString()
  assignToTeamId?: string;

  @IsOptional()
  @IsString()
  assignToUserId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============================================================================
// TEAM DTOs
// ============================================================================

export class CreateOpTeamDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateOpTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddTeamMemberDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  role?: string;
}

// ============================================================================
// COMMENT DTOs
// ============================================================================

export class CreateOpTaskCommentDto {
  @IsString()
  content!: string;
}
