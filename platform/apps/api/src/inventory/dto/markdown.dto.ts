import { IsString, IsInt, IsOptional, IsEnum, IsBoolean, Min, Max } from "class-validator";
import { MarkdownDiscountType, MarkdownScope } from "@prisma/client";

export class CreateMarkdownRuleDto {
    @IsInt()
    @Min(0)
    daysUntilExpiration: number;

    @IsEnum(MarkdownDiscountType)
    discountType: MarkdownDiscountType;

    @IsInt()
    @Min(1)
    discountValue: number; // Percentage (1-100) or flat cents

    @IsEnum(MarkdownScope)
    scope: MarkdownScope;

    @IsString()
    @IsOptional()
    categoryId?: string;

    @IsString()
    @IsOptional()
    productId?: string;

    @IsInt()
    @IsOptional()
    @Min(1)
    @Max(1000)
    priority?: number;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

export class UpdateMarkdownRuleDto {
    @IsInt()
    @Min(0)
    @IsOptional()
    daysUntilExpiration?: number;

    @IsEnum(MarkdownDiscountType)
    @IsOptional()
    discountType?: MarkdownDiscountType;

    @IsInt()
    @Min(1)
    @IsOptional()
    discountValue?: number;

    @IsInt()
    @Min(1)
    @Max(1000)
    @IsOptional()
    priority?: number;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

export interface MarkdownCalculation {
    applies: boolean;
    originalPriceCents: number;
    markdownPriceCents: number;
    discountCents: number;
    discountPercent: number;
    ruleId: string | null;
    daysUntilExpiration: number | null;
    batchId: string | null;
}

export interface MarkdownPreview {
    batchId: string;
    productId: string;
    productName: string;
    expirationDate: Date | null;
    daysUntilExpiration: number | null;
    qtyRemaining: number;
    originalPriceCents: number;
    markdownPriceCents: number;
    discountCents: number;
    discountPercent: number;
    ruleId: string;
    rulePriority: number;
}
