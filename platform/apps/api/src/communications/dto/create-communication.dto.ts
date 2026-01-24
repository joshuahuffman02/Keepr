import { IsIn, IsOptional, IsString } from "class-validator";

export class CreateCommunicationDto {
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

  @IsString()
  @IsIn(["email", "sms", "note", "call"])
  type!: string;

  @IsString()
  @IsIn(["inbound", "outbound"])
  direction!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @IsOptional()
  @IsString()
  toAddress?: string;

  @IsOptional()
  @IsString()
  fromAddress?: string;
}
