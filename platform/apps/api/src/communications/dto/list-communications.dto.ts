import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

export class ListCommunicationsDto {
  @IsString()
  campgroundId!: string;

  @IsOptional()
  @IsString()
  guestId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
