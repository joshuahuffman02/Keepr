import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

export class CreateReportExportDto {
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  format?: string; // csv | json | xlsx

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emailTo?: string[];
}
