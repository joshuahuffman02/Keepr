import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class PhotoMetaDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  license?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  attribution?: string;
}

export class ExternalCampgroundUpsertDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  address1?: string;

  @IsOptional()
  @IsString()
  address2?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  externalUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  amenities?: string[];

  @IsOptional()
  @IsArray()
  photos?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoMetaDto)
  photosMeta?: PhotoMetaDto[];

  @IsOptional()
  @IsString()
  dataSource?: string;

  @IsOptional()
  @IsString()
  dataSourceId?: string;

  @IsOptional()
  @IsDateString()
  dataSourceUpdatedAt?: string;

  @IsOptional()
  @IsBoolean()
  isBookable?: boolean;

  @IsOptional()
  @IsString()
  nonBookableReason?: string;

  @IsOptional()
  @IsNumber()
  reviewScore?: number;

  @IsOptional()
  @IsNumber()
  reviewCount?: number;

  @IsOptional()
  @IsArray()
  reviewSources?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsDateString()
  reviewsUpdatedAt?: string;

  @IsOptional()
  amenitySummary?: Record<string, unknown>;
}

export class OsmIngestRequestDto {
  @IsOptional()
  @IsString()
  bbox?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countryCodes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
