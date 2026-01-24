import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ChannelType } from "@prisma/client";

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  campgroundId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  channel?: ChannelType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  textBody?: string;
}
