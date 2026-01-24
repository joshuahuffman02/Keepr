import { IsBoolean, IsOptional, IsString } from "class-validator";

export class AudienceFiltersDto {
  @IsOptional()
  @IsString()
  campgroundId?: string;

  @IsOptional()
  @IsString()
  siteType?: string;

  @IsOptional()
  @IsString()
  siteClassId?: string;

  @IsOptional()
  @IsString()
  stayedFrom?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  stayedTo?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  lastStayBefore?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsBoolean()
  notStayedThisYear?: boolean;

  @IsOptional()
  @IsBoolean()
  vip?: boolean;

  @IsOptional()
  @IsString()
  loyaltyTier?: string;

  @IsOptional()
  @IsBoolean()
  promoUsed?: boolean;

  @IsOptional()
  @IsString()
  stayFrom?: string; // future stays from date

  @IsOptional()
  @IsString()
  stayTo?: string; // future stays to date
}
