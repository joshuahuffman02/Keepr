import { PosSyncTarget } from "@prisma/client";
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString } from "class-validator";

const CAPABILITY_VALUES = ["payments", "items_sync", "receipts"];

export class UpsertPosProviderDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsObject()
  credentials!: Record<string, any>;

  @IsOptional()
  @IsObject()
  locations?: Record<string, string>;

  @IsOptional()
  @IsObject()
  devices?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsIn(CAPABILITY_VALUES, { each: true })
  capabilities?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}

export class ValidatePosProviderDto {
  @IsObject()
  credentials!: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsIn(CAPABILITY_VALUES, { each: true })
  capabilities?: string[];
}

export class TriggerPosSyncDto {
  @IsIn(["catalog", "tenders", "payments"])
  target!: PosSyncTarget | "catalog" | "tenders" | "payments";
}
