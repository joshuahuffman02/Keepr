import { IsDateString, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateHoldDto {
  @IsString()
  campgroundId!: string;

  @IsString()
  siteId!: string;

  @IsDateString()
  arrivalDate!: string;

  @IsDateString()
  departureDate!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  holdMinutes?: number; // TTL in minutes

  @IsOptional()
  @IsString()
  note?: string;
}
