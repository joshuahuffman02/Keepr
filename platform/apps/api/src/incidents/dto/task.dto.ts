import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { IncidentTaskStatus } from "@prisma/client";

export class CreateIncidentTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsDateString()
  reminderAt?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}

export class UpdateIncidentTaskDto {
  @IsOptional()
  @IsString()
  status?: IncidentTaskStatus;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsDateString()
  reminderAt?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
