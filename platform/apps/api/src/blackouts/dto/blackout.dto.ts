import { IsString, IsOptional, IsDateString } from "class-validator";

export class CreateBlackoutDateDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  @IsOptional()
  siteId?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateBlackoutDateDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  siteId?: string | null;

  @IsString()
  @IsOptional()
  reason?: string;
}
