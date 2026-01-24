import { IsOptional, IsString } from "class-validator";

export class ReplyReviewDto {
  @IsString()
  reviewId!: string;

  @IsString()
  authorType!: "staff" | "guest";

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsString()
  body!: string;
}
