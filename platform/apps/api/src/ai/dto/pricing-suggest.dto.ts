import { IsOptional, IsString, MaxLength, IsNumber, Min, Max } from "class-validator";

export class PricingSuggestDto {
  @IsString()
  @MaxLength(64)
  campgroundId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  siteClassId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  arrivalDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  departureDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  demandIndex?: number;
}
