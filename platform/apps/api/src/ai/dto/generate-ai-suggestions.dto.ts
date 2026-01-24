import { IsOptional, IsString, MaxLength } from "class-validator";

export class GenerateAiSuggestionsDto {
  @IsString()
  @MaxLength(64)
  campgroundId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  focus?: string;
}
