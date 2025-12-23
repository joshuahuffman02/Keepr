import { IsString, IsInt, IsOptional, IsDate, IsEnum, Min } from "class-validator";
import { Type } from "class-transformer";
import { BatchDisposalReason } from "@prisma/client";

export class CreateBatchDto {
    @IsString()
    productId: string;

    @IsString()
    @IsOptional()
    locationId?: string;

    @IsInt()
    @Min(1)
    qtyReceived: number;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    expirationDate?: Date;

    @IsString()
    @IsOptional()
    batchNumber?: string;

    @IsString()
    @IsOptional()
    supplierId?: string;

    @IsInt()
    @IsOptional()
    @Min(0)
    unitCostCents?: number;
}

export class UpdateBatchDto {
    @IsString()
    @IsOptional()
    batchNumber?: string;

    @IsString()
    @IsOptional()
    supplierId?: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    expirationDate?: Date;

    @IsInt()
    @IsOptional()
    @Min(0)
    unitCostCents?: number;
}

export class AdjustBatchDto {
    @IsInt()
    adjustment: number;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsEnum(BatchDisposalReason)
    @IsOptional()
    disposalReason?: BatchDisposalReason;
}

export class DisposeBatchDto {
    @IsEnum(BatchDisposalReason)
    reason: BatchDisposalReason;

    @IsString()
    @IsOptional()
    notes?: string;
}

export interface BatchAllocation {
    batchId: string;
    qty: number;
    expirationDate: Date | null;
    unitCostCents: number | null;
    daysUntilExpiration: number | null;
}

export interface BatchListFilters {
    productId?: string;
    locationId?: string;
    isActive?: boolean;
    expiringWithinDays?: number;
    expiredOnly?: boolean;
}
