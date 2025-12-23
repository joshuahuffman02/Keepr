import { Type } from "class-transformer";
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsBoolean,
  Min,
} from "class-validator";

export class SaleItemDto {
  @IsString()
  sku: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsInt()
  @Min(0)
  priceCents: number;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsBoolean()
  markdownApplied?: boolean;
}

export class RecordSaleDto {
  @IsString()
  externalTransactionId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class RecordSaleResponseDto {
  saleId: string;
  externalTransactionId: string;
  inventoryDeducted: boolean;
  items: Array<{
    sku: string;
    qtyDeducted: number;
    batchId: string | null;
    remainingInBatch: number | null;
  }>;
  totalCents: number;
}

export class RecordRefundDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  items: RefundItemDto[];

  @IsString()
  reason: string;
}

export class RefundItemDto {
  @IsString()
  sku: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsOptional()
  @IsString()
  batchId?: string;
}

export class RecordRefundResponseDto {
  refundId: string;
  originalSaleId: string;
  inventoryRestored: boolean;
  items: Array<{
    sku: string;
    qtyRestored: number;
  }>;
}
