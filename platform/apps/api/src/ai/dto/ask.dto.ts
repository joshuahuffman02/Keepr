import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class AskDto {
  @IsString()
  @MaxLength(64)
  campgroundId!: string;

  @IsString()
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @IsBoolean()
  includeActions?: boolean;
}
