import { IsEmail, IsOptional, IsString } from "class-validator";
import { CampaignStatus, ChannelType } from "@prisma/client";

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string | null;

  @IsOptional()
  status?: CampaignStatus;

  @IsOptional()
  channel?: ChannelType;

  @IsOptional()
  @IsString()
  textBody?: string;
}
