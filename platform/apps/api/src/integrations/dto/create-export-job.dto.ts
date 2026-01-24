import { IsIn, IsOptional, IsString } from "class-validator";
import { IsObject } from "class-validator";

export class CreateExportJobDto {
  @IsString()
  type!: string; // api | sftp

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  campgroundId?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  requestedById?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
