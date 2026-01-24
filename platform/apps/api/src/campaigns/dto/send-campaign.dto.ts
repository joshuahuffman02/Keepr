import { IsOptional, IsString } from "class-validator";

export class SendCampaignDto {
  @IsOptional()
  @IsString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsString()
  batchPerMinute?: string | null;
}
