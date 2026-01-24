import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateNpsInviteDto {
  @IsString()
  surveyId!: string;

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
  channel!: string; // email | sms | inapp

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  expireDays?: number;

  @IsOptional()
  @IsDateString()
  sendAfter?: string;
}
