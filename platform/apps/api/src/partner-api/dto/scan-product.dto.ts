import { IsString, IsOptional, IsInt, Min, IsBoolean } from "class-validator";

export class ScanProductDto {
  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number = 1;

  @IsOptional()
  @IsBoolean()
  allowExpired?: boolean;
}

export class ScanProductResponseDto {
  product: {
    id: string;
    sku: string | null;
    name: string;
    category: string | null;
  };
  unitPriceCents: number;
  markdownApplied: boolean;
  originalPriceCents: number;
  markdownDiscountCents: number;
  effectivePriceCents: number;
  batchId: string | null;
  expirationDate: string | null;
  daysUntilExpiration: number | null;
  expirationTier: string | null;
  useBatchTracking: boolean;
  requiresOverride: boolean;
  warningMessage: string | null;
  qtyAvailable: number;
}
