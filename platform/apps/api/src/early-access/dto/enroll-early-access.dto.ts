import { IsIn, IsOptional, IsString } from "class-validator";

// Local type matching schema enum - avoids compile-time dependency on generated client
export type EarlyAccessTierType = "founders_circle" | "pioneer" | "trailblazer";
export const EARLY_ACCESS_TIERS: EarlyAccessTierType[] = [
  "founders_circle",
  "pioneer",
  "trailblazer",
];

export class EnrollEarlyAccessDto {
  @IsIn(EARLY_ACCESS_TIERS)
  tier!: EarlyAccessTierType;

  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class ReserveSpotDto {
  @IsIn(EARLY_ACCESS_TIERS)
  tier!: EarlyAccessTierType;

  @IsString()
  reservationToken!: string; // Temporary token to hold spot during signup
}

export class EarlyAccessSignupDto {
  @IsIn(EARLY_ACCESS_TIERS)
  tier!: EarlyAccessTierType;

  @IsString()
  campgroundName!: string;

  @IsString()
  phone!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}
