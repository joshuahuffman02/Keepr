import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class CreateSiteClassDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  defaultRate!: number;

  @IsString()
  @IsNotEmpty()
  siteType!: string;

  @IsInt()
  @Min(0)
  maxOccupancy!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rigMaxLength?: number;

  @IsOptional()
  @IsBoolean()
  hookupsPower?: boolean;

  @IsOptional()
  @IsBoolean()
  hookupsWater?: boolean;

  @IsOptional()
  @IsBoolean()
  hookupsSewer?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  electricAmps?: number[];

  @IsOptional()
  @IsString()
  rvOrientation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenityTags?: string[];

  // Metered utility defaults
  @IsOptional()
  @IsBoolean()
  meteredEnabled?: boolean;

  @IsOptional()
  @IsString()
  meteredType?: string;

  @IsOptional()
  @IsString()
  meteredBillingMode?: string;

  @IsOptional()
  @IsString()
  meteredBillTo?: string;

  @IsOptional()
  @IsInt()
  meteredMultiplier?: number;

  @IsOptional()
  @IsString()
  meteredRatePlanId?: string;

  @IsOptional()
  @IsBoolean()
  meteredAutoEmail?: boolean;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  glCode?: string;

  @IsOptional()
  @IsString()
  clientAccount?: string;

  @IsOptional()
  @IsInt()
  minNights?: number;

  @IsOptional()
  @IsInt()
  maxNights?: number;

  @IsOptional()
  @IsBoolean()
  petFriendly?: boolean;

  @IsOptional()
  @IsBoolean()
  accessible?: boolean;

  @IsOptional()
  photos?: string[];

  @IsOptional()
  policyVersion?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
