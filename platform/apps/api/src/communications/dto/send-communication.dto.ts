import { IsEmail, IsOptional, IsString, IsIn, IsBoolean } from "class-validator";

export class SendCommunicationDto {
  @IsString()
  campgroundId!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  guestId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsIn(["email", "sms", "note", "call"])
  @IsString()
  type!: string;

  @IsIn(["outbound"])
  @IsString()
  direction!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEmail()
  toAddress?: string;

  @IsOptional()
  @IsEmail()
  fromAddress?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @IsOptional()
  @IsBoolean()
  consentGranted?: boolean;

  @IsOptional()
  @IsString()
  consentSource?: string;

  @IsOptional()
  @IsBoolean()
  quietHoursOverride?: boolean;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  toPhone?: string;
}
