import { IsOptional, IsString, MaxLength } from "class-validator";

export class SemanticSearchDto {
  @IsString()
  @MaxLength(200)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  campgroundId?: string;
}
