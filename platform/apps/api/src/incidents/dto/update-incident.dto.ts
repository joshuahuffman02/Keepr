import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { IncidentStatus, IncidentType, Severity } from "@prisma/client";

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  status?: IncidentStatus;

  @IsOptional()
  @IsString()
  type?: IncidentType;

  @IsOptional()
  @IsString()
  severity?: Severity;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  witnesses?: any;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
