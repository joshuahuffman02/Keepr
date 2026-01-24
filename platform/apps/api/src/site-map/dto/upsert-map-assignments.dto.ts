import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class MapAssignmentDto {
  @IsString()
  @IsNotEmpty()
  siteId!: string;

  @IsString()
  @IsNotEmpty()
  shapeId!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  rotation?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpsertMapAssignmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MapAssignmentDto)
  assignments!: MapAssignmentDto[];
}
