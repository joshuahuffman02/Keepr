import { PartialType } from "@nestjs/mapped-types";
import { CreateUpsellDto } from "./create-upsell.dto";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateUpsellDto extends PartialType(CreateUpsellDto) {
  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  taxCode?: string | null;

  @IsOptional()
  @IsBoolean()
  inventoryTracking?: boolean;

  @IsOptional()
  @IsString()
  siteClassId?: string | null;
}
