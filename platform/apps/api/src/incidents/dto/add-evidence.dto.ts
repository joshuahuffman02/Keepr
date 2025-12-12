import { IsEnum, IsOptional, IsString } from "class-validator";
import { EvidenceType } from "@prisma/client";

export class AddEvidenceDto {
  @IsString()
  type: EvidenceType = EvidenceType.photo;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  uploadedBy?: string;
}
