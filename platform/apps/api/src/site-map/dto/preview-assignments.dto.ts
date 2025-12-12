import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";

class PreviewRigDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  length?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  height?: number;

  @IsOptional()
  @IsString()
  type?: string;
}

export class PreviewAssignmentsDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreviewRigDto)
  rig?: PreviewRigDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredAmenities?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  partySize?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  siteIds?: string[];

  @IsOptional()
  @IsBoolean()
  needsADA?: boolean;
}
