import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAiSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  openaiApiKey?: string;
}
