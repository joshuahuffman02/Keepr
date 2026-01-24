import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";

export enum SenderType {
  guest = "guest",
  staff = "staff",
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @IsEnum(SenderType)
  senderType!: SenderType;

  @IsString()
  @IsNotEmpty()
  guestId!: string;
}
