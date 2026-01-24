import { IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl()
  orderWebhookUrl?: string;
}
