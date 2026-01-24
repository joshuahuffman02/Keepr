import { IsOptional, IsString } from "class-validator";

export class AnomalyCheckDto {
  @IsString()
  campgroundId!: string;

  @IsOptional()
  @IsString()
  metric?: string; // e.g. "occupancy", "revenue"
}
