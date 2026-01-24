import { IsString, IsOptional, IsEnum, IsInt, IsBoolean, IsDateString, Min } from "class-validator";

export enum PromotionTypeDto {
  percentage = "percentage",
  flat = "flat",
}

export class CreatePromotionDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  code!: string;

  @IsEnum(PromotionTypeDto)
  @IsOptional()
  type?: PromotionTypeDto;

  @IsInt()
  @Min(0)
  value!: number;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validTo?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePromotionDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsEnum(PromotionTypeDto)
  @IsOptional()
  type?: PromotionTypeDto;

  @IsInt()
  @Min(0)
  @IsOptional()
  value?: number;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validTo?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ValidatePromotionDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  code!: string;

  @IsInt()
  @Min(0)
  subtotal!: number; // In cents
}
