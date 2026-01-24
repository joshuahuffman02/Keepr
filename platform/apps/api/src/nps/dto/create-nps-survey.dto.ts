import { IsArray, IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateNpsSurveyDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsArray()
  channels?: string[];

  @IsOptional()
  @IsArray()
  locales?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  samplingPercent?: number;

  @IsOptional()
  @IsDateString()
  activeFrom?: string;

  @IsOptional()
  @IsDateString()
  activeTo?: string;
}
