import { IsString, IsOptional, IsNumber, Min, Max, IsIn, IsBoolean } from "class-validator";

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(["disabled", "pull", "two_way"])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  rateMultiplier?: number;

  @IsOptional()
  @IsString()
  @IsIn(["confirmed", "pending"])
  defaultStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn(["absorb", "pass_through"])
  feeMode?: string;

  @IsOptional()
  @IsBoolean()
  sendEmailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  ignoreSiteRestrictions?: boolean;

  @IsOptional()
  @IsBoolean()
  ignoreCategoryRestrictions?: boolean;
}
