import { IsString } from "class-validator";

export class VoteReviewDto {
  @IsString()
  reviewId!: string;

  @IsString()
  value!: "helpful" | "not_helpful";
}
