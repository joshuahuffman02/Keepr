import { IsOptional, IsString } from "class-validator";

export class UpsertOtaMappingDto {
  @IsString()
  externalId!: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  siteClassId?: string;

  @IsOptional()
  @IsString()
  status?: string; // mapped | disabled
}
