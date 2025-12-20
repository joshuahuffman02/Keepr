import { IsString, IsOptional, IsInt, IsBoolean, IsEnum, Min, IsArray } from "class-validator";

export class CreateStoreLocationDto {
    @IsString()
    campgroundId!: string;

    @IsString()
    name!: string;

    @IsString()
    @IsOptional()
    code?: string;

    @IsEnum(["physical", "virtual"])
    @IsOptional()
    type?: "physical" | "virtual";

    @IsBoolean()
    @IsOptional()
    isDefault?: boolean;

    @IsBoolean()
    @IsOptional()
    acceptsOnline?: boolean;

    @IsInt()
    @IsOptional()
    sortOrder?: number;
}

export class UpdateStoreLocationDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    code?: string;

    @IsEnum(["physical", "virtual"])
    @IsOptional()
    type?: "physical" | "virtual";

    @IsBoolean()
    @IsOptional()
    isDefault?: boolean;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsBoolean()
    @IsOptional()
    acceptsOnline?: boolean;

    @IsInt()
    @IsOptional()
    sortOrder?: number;
}

export class SetLocationInventoryDto {
    @IsString()
    productId!: string;

    @IsInt()
    @Min(0)
    stockQty!: number;

    @IsInt()
    @IsOptional()
    lowStockAlert?: number;
}

export class AdjustLocationInventoryDto {
    @IsString()
    productId!: string;

    @IsInt()
    adjustment!: number; // Can be positive or negative

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreateLocationPriceOverrideDto {
    @IsString()
    productId!: string;

    @IsInt()
    @Min(0)
    priceCents!: number;

    @IsString()
    @IsOptional()
    reason?: string;
}

export class UpdateLocationPriceOverrideDto {
    @IsInt()
    @IsOptional()
    @Min(0)
    priceCents?: number;

    @IsString()
    @IsOptional()
    reason?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
