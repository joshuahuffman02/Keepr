import { IsOptional, IsString, MaxLength } from "class-validator";

export class ApplyRecommendationDto {
  @IsString()
  @MaxLength(64)
  recommendationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetId?: string;

  @IsString()
  @MaxLength(64)
  campgroundId!: string;

  @IsOptional()
  payload?: Record<string, unknown>;
}
