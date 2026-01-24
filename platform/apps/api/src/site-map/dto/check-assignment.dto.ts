import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

class RigDto {
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

export class CheckAssignmentDto {
  @IsString()
  @IsNotEmpty()
  siteId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RigDto)
  rig?: RigDto;

  @IsOptional()
  @IsBoolean()
  needsADA?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredAmenities?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  partySize?: number;
}
