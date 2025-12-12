import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateCoiDto {
  @IsString()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  policyNumber?: string;

  @IsOptional()
  @IsString()
  coverageType?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  uploadedBy?: string;
}
