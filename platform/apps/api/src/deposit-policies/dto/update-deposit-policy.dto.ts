import { PartialType } from "@nestjs/mapped-types";
import { CreateDepositPolicyDto } from "./create-deposit-policy.dto";
import { IsOptional, IsString } from "class-validator";

export class UpdateDepositPolicyDto extends PartialType(CreateDepositPolicyDto) {
  @IsOptional()
  @IsString()
  siteClassId?: string | null;

  @IsOptional()
  @IsString()
  retryPlanId?: string | null;
}
