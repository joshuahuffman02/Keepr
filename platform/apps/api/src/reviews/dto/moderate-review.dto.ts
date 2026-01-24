import { IsArray, IsOptional, IsString } from "class-validator";

export class ModerateReviewDto {
  @IsString()
  reviewId!: string;

  @IsString()
  status!: "approved" | "rejected" | "pending" | "removed";

  @IsOptional()
  @IsArray()
  reasons?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
