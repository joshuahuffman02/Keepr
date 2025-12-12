import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { ReferralIncentiveType } from "@prisma/client";

export class CreateReferralProgramDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  linkSlug?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsString()
  incentiveType!: ReferralIncentiveType;

  @IsInt()
  @Min(0)
  incentiveValue!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
