import { IsIn, IsOptional, IsString } from "class-validator";

export class UpsertIntegrationConnectionDto {
  @IsString()
  campgroundId!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsString()
  @IsIn(["accounting", "access_control", "crm", "export"])
  type!: string;

  @IsString()
  provider!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  authType?: string;

  @IsOptional()
  credentials?: Record<string, unknown>;

  @IsOptional()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
