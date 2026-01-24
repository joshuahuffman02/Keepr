import { IsEmail, IsOptional, IsString, IsNotEmpty } from "class-validator";
import { ChannelType } from "@prisma/client";

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsEmail()
  fromEmail!: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsString()
  @IsNotEmpty()
  html!: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  channel?: ChannelType;

  @IsOptional()
  @IsString()
  textBody?: string;

  @IsOptional()
  @IsString()
  batchPerMinute?: string | null;

  @IsOptional()
  variables?: Record<string, unknown>;
}
