import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateReviewRequestDto {
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
  channel!: string; // email | sms | inapp | kiosk

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  expireDays?: number;

  @IsOptional()
  @IsDateString()
  sendAfter?: string;
}
