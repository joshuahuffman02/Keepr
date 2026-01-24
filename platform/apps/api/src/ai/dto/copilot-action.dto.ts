import { IsOptional, IsString, MaxLength } from "class-validator";

export class CopilotActionDto {
  @IsString()
  @MaxLength(64)
  campgroundId!: string;

  @IsString()
  @MaxLength(64)
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  prompt?: string;

  @IsOptional()
  payload?: Record<string, unknown>;
}
