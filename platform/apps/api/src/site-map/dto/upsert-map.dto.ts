import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";

class MapConfigDto {
  @IsOptional()
  @IsObject()
  bounds?: Record<string, any> | null;

  @IsOptional()
  @IsObject()
  defaultCenter?: Record<string, any> | null;

  @IsOptional()
  @IsNumber()
  defaultZoom?: number | null;

  @IsOptional()
  @IsObject()
  layers?: Record<string, any> | null;

  @IsOptional()
  @IsObject()
  legend?: Record<string, any> | null;
}

class MapSiteDto {
  @IsString()
  @IsNotEmpty()
  siteId!: string;

  @IsObject()
  geometry!: Record<string, any>;

  @IsOptional()
  @IsObject()
  centroid?: Record<string, any>;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  rotation?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
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
