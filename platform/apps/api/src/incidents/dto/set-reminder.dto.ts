import { IsDateString, IsOptional, IsString } from "class-validator";

export class SetReminderDto {
  @IsDateString()
  reminderAt!: string;

  @IsOptional()
  @IsString()
  message?: string;
}
