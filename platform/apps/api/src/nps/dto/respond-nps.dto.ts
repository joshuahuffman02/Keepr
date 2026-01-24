import { IsArray, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class RespondNpsDto {
  @IsString()
  token!: string;

  @IsInt()
  @Min(0)
  @Max(10)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
