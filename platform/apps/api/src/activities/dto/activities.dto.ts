import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  IsEnum,
  IsObject,
  IsDateString,
} from "class-validator";

// Matches Prisma enum
export enum ActivitySchedulingMode {
  SCHEDULED = "scheduled",
  OPEN_AVAILABILITY = "open_availability",
}

export enum RecurrencePatternType {
  NONE = "none",
  DAILY = "daily",
  WEEKLY = "weekly",
  BIWEEKLY = "biweekly",
  MONTHLY = "monthly",
}

/**
 * DTO for creating a new activity
 */
export class CreateActivityDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  // Scheduling mode
  @IsOptional()
  @IsEnum(ActivitySchedulingMode)
  schedulingMode?: ActivitySchedulingMode;

  // Open availability settings
  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, { start: string; end: string }>;

  @IsOptional()
  @IsNumber()
  @Min(15)
  slotDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxConcurrent?: number;

  // Pricing options
  @IsOptional()
  @IsNumber()
  @Min(0)
  weekendPremium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  holidayPremium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  earlyBirdDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  earlyBirdDays?: number;
}

/**
 * DTO for updating an existing activity
 */
export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsEnum(ActivitySchedulingMode)
  schedulingMode?: ActivitySchedulingMode;

  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, { start: string; end: string }>;

  @IsOptional()
  @IsNumber()
  @Min(15)
  slotDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxConcurrent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weekendPremium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  holidayPremium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  earlyBirdDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  earlyBirdDays?: number;
}

/**
 * DTO for creating a session for an activity
 */
export class CreateSessionDto {
  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;
}

/**
 * DTO for booking an activity session
 */
export class BookActivityDto {
  @IsString()
  guestId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  reservationId?: string;
}

export class UpdateCapacityDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  booked?: number;

  @IsOptional()
  @IsBoolean()
  waitlistEnabled?: boolean;
}

export class AddWaitlistEntryDto {
  @IsString()
  guestName!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  partySize?: number;

  @IsOptional()
  @IsString()
  contact?: string;
}

/**
 * DTO for creating a recurrence pattern
 */
export class CreateRecurrencePatternDto {
  @IsEnum(RecurrencePatternType)
  patternType!: RecurrencePatternType;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ... 6=Sat

  @IsOptional()
  @IsNumber()
  @Min(1)
  dayOfMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  weekOfMonth?: number;

  @IsString()
  startTime!: string; // "09:00" format

  @IsString()
  endTime!: string; // "10:30" format

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;
}

/**
 * DTO for bulk generating sessions from a recurrence pattern
 */
export class GenerateSessionsDto {
  @IsEnum(RecurrencePatternType)
  patternType!: RecurrencePatternType;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ... 6=Sat (for weekly/biweekly)

  @IsString()
  startTime!: string; // "09:00" format

  @IsOptional()
  @IsString()
  endTime?: string; // If not provided, uses activity duration

  @IsDateString()
  startDate!: string; // Generate sessions starting from this date

  @IsDateString()
  endDate!: string; // Generate sessions until this date

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number; // Override activity capacity

  @IsOptional()
  @IsBoolean()
  savePattern?: boolean; // Save as recurring pattern for future generation
}

/**
 * Response for session generation preview
 */
export type GenerateSessionsPreview = {
  sessions: Array<{
    startTime: string;
    endTime: string;
    dayOfWeek: string;
    isWeekend: boolean;
  }>;
  totalCount: number;
  patternDescription: string;
};

/**
 * DTO for creating an activity bundle
 */
export class CreateBundleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  discountType?: "fixed" | "percent";

  @IsOptional()
  @IsNumber()
  discountValue?: number;

  @IsArray()
  activityIds!: string[];
}

/**
 * DTO for updating a bundle
 */
export class UpdateBundleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  activityIds?: string[];
}
