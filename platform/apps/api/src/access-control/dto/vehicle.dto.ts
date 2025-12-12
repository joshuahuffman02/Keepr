import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpsertVehicleDto {
  @IsOptional()
  @IsString()
  plate?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  rigType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rigLength?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
