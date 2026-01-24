import { IsArray, IsBooleanString, IsOptional, IsString } from "class-validator";

export class UpdateStaffScopeDto {
  @IsOptional()
  @IsString()
  region?: string | null;

  @IsOptional()
  @IsArray()
  ownershipRoles?: string[];

  @IsOptional()
  @IsString()
  platformRole?: string | null;

  @IsOptional()
  @IsString()
  platformRegion?: string | null;

  @IsOptional()
  @IsBooleanString()
  platformActive?: string | null;
}
