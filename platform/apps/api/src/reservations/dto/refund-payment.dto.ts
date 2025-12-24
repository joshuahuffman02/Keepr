import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class RefundPaymentDto {
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsIn(["card", "wallet"])
  destination?: "card" | "wallet";

  @IsOptional()
  @IsString()
  reason?: string;
}
