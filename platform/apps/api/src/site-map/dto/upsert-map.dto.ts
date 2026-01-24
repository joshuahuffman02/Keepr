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

class MapConfigDto {
  @IsOptional()
  @IsObject()
  bounds?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  defaultCenter?: Record<string, unknown> | null;

  @IsOptional()
  @IsNumber()
  defaultZoom?: number | null;

  @IsOptional()
  @IsObject()
  layers?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  legend?: Record<string, unknown> | null;
}

class MapSiteDto {
  @IsString()
  @IsNotEmpty()
  siteId!: string;

  @IsObject()
  geometry!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  centroid?: Record<string, unknown>;

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

export class UpsertMapDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MapConfigDto)
  config?: MapConfigDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MapSiteDto)
  sites?: MapSiteDto[];
}
