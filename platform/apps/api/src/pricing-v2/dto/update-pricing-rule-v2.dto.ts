import { PartialType } from "@nestjs/mapped-types";
import { CreatePricingRuleV2Dto } from "./create-pricing-rule-v2.dto";
import { IsOptional, IsString } from "class-validator";

export class UpdatePricingRuleV2Dto extends PartialType(CreatePricingRuleV2Dto) {
  @IsOptional()
  @IsString()
  siteClassId?: string | null;

  @IsOptional()
  @IsString()
  calendarRefId?: string | null;

  @IsOptional()
  @IsString()
  demandBandId?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  endDate?: string | null;
}
