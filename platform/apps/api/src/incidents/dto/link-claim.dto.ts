import { IsOptional, IsString } from "class-validator";

export class LinkClaimDto {
  @IsString()
  claimId!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
