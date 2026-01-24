import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateNpsRuleDto {
  @IsString()
  surveyId!: string;

  @IsString()
  trigger!: string; // post_checkout | post_booking | manual

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  percentage?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownDays?: number;

  @IsOptional()
  segmentJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
