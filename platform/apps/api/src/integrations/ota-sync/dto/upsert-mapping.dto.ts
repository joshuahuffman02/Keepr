import { IsString, IsOptional, IsUrl, ValidateIf } from "class-validator";

export class UpsertMappingDto {
  @IsString()
  channelId: string;

  @IsString()
  externalId: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  siteClassId?: string;

  @IsOptional()
  @ValidateIf((o) => o.icalUrl !== undefined && o.icalUrl !== "")
  @IsUrl()
  icalUrl?: string;
}
