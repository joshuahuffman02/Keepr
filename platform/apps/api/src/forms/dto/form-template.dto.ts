import { IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { FormSubmissionStatus } from "@prisma/client";

export class CreateFormTemplateDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsIn(["waiver", "vehicle", "intake", "custom"])
  type!: "waiver" | "vehicle" | "intake" | "custom";

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFormTemplateDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(["waiver", "vehicle", "intake", "custom"])
  type?: "waiver" | "vehicle" | "intake" | "custom";

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateFormSubmissionDto {
  @IsString()
  @IsNotEmpty()
  formTemplateId!: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  guestId?: string;

  @IsOptional()
  @IsObject()
  responses?: Record<string, unknown> | null;
}

export class UpdateFormSubmissionDto {
  @IsOptional()
  @IsString()
  status?: FormSubmissionStatus;

  @IsOptional()
  @IsObject()
  responses?: Record<string, unknown> | null;
}
