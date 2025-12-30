import { IsString, IsOptional, IsNumber, Min, Max, IsIn } from "class-validator";

export class CreateChannelDto {
  @IsString()
  campgroundId: string;

  @IsString()
  name: string;

  @IsString()
  @IsIn(["airbnb", "vrbo", "booking", "ical", "hipcamp", "tentrr", "harvest_hosts", "other"])
  provider: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  rateMultiplier?: number;

  @IsOptional()
  @IsString()
  @IsIn(["confirmed", "pending"])
  defaultStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn(["absorb", "pass_through"])
  feeMode?: string;
}
