import { IsArray, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class SubmitReviewDto {
  @IsString()
  token!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  photos?: string[];

  @IsOptional()
  @IsArray()
  tags?: string[];
}
