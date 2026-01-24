import { IsString, IsOptional, IsEnum, IsObject } from "class-validator";

// Using string literals since Prisma types are generated at build time
export type TicketCategoryType = "issue" | "question" | "feature" | "other";
export type TicketStateType =
  | "open"
  | "in_progress"
  | "blocked"
  | "resolved"
  | "reopened"
  | "closed";

export class CreateTicketDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  category?: TicketCategoryType;

  @IsString()
  @IsOptional()
  area?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  path?: string;

  @IsString()
  @IsOptional()
  pageTitle?: string;

  @IsString()
  @IsOptional()
  selection?: string;

  @IsObject()
  @IsOptional()
  submitter?: { id?: string | null; name?: string | null; email?: string | null };

  @IsObject()
  @IsOptional()
  client?: {
    userAgent?: string | null;
    platform?: string | null;
    language?: string | null;
    deviceType?: "mobile" | "desktop" | "tablet" | "unknown";
  };

  @IsObject()
  @IsOptional()
  extra?: Record<string, unknown>;
}

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  status?: TicketStateType;

  @IsString()
  @IsOptional()
  agentNotes?: string;

  @IsString()
  @IsOptional()
  action?: "upvote";

  @IsObject()
  @IsOptional()
  actor?: { id?: string | null; name?: string | null; email?: string | null };
}
