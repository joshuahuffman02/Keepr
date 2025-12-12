import { IsIn, IsOptional, IsString } from "class-validator";

const STATUSES = ["signed", "declined", "voided", "expired", "viewed"] as const;

export class SignatureWebhookDto {
  @IsString()
  token!: string;

  @IsIn(STATUSES as unknown as string[])
  status!: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  completedAt?: string;
}
