import { IsOptional, IsString, MaxLength } from "class-validator";

export class RecommendDto {
  @IsString()
  @MaxLength(64)
  campgroundId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  guestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  intent?: string;
}
