import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListLogsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
