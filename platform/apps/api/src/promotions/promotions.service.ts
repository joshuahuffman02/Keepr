import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePromotionDto, UpdatePromotionDto, ValidatePromotionDto } from "./dto/promotions.dto";

@Injectable()
export class PromotionsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: CreatePromotionDto) {
        // Normalize code to uppercase
        const normalizedCode = data.code.toUpperCase().trim();

        return this.prisma.promotion.create({
            data: {
                campgroundId: data.campgroundId,
                code: normalizedCode,
                type: data.type || "percentage",
                value: data.value,
                validFrom: data.validFrom ? new Date(data.validFrom) : null,
                validTo: data.validTo ? new Date(data.validTo) : null,
                usageLimit: data.usageLimit || null,
                isActive: data.isActive ?? true,
                description: data.description || null
            }
        });
    }

    async findAll(campgroundId: string) {
        return this.prisma.promotion.findMany({
            where: { campgroundId },
            orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
        });
    }

    async findOne(campgroundId: string, id: string) {
        const promotion = await this.prisma.promotion.findFirst({
            where: { id, campgroundId }
        });
        if (!promotion) throw new NotFoundException("Promotion not found");
        return promotion;
    }

    async update(campgroundId: string, id: string, data: UpdatePromotionDto) {
        await this.findOne(campgroundId, id);

        return this.prisma.promotion.update({
            where: { id },
            data: {
                code: data.code ? data.code.toUpperCase().trim() : undefined,
                type: data.type,
                value: data.value,
                validFrom: data.validFrom !== undefined
                    ? (data.validFrom ? new Date(data.validFrom) : null)
                    : undefined,
                validTo: data.validTo !== undefined
                    ? (data.validTo ? new Date(data.validTo) : null)
                    : undefined,
                usageLimit: data.usageLimit,
                isActive: data.isActive,
                description: data.description
            }
        });
    }

    async remove(campgroundId: string, id: string) {
        await this.findOne(campgroundId, id);
        return this.prisma.promotion.delete({ where: { id } });
    }

    /**
     * Validate a promo code and calculate the discount amount.
     * Returns the discount in cents.
     */
    async validate(data: ValidatePromotionDto): Promise<{
        valid: boolean;
        discountCents: number;
        promotionId: string;
        code: string;
        type: string;
        value: number;
    }> {
        const normalizedCode = data.code.toUpperCase().trim();
        const now = new Date();

        const promotion = await this.prisma.promotion.findUnique({
            where: {
                campgroundId_code: {
                    campgroundId: data.campgroundId,
                    code: normalizedCode
                }
            }
        });

        if (!promotion) {
            throw new BadRequestException("Promo code not found. Please verify the code and try again");
        }

        if (!promotion.isActive) {
            throw new BadRequestException("This promo code is no longer active");
        }

        if (promotion.validFrom && now < promotion.validFrom) {
            throw new BadRequestException("This promo code is not yet valid");
        }

        if (promotion.validTo && now > promotion.validTo) {
            throw new BadRequestException("This promo code has expired");
        }

        if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
            throw new BadRequestException("This promo code has reached its usage limit");
        }

        // Calculate discount
        let discountCents = 0;
        if (promotion.type === "percentage") {
            discountCents = Math.round(data.subtotal * (promotion.value / 100));
        } else {
            // Flat discount - can't exceed subtotal
            discountCents = Math.min(promotion.value, data.subtotal);
        }

        return {
            valid: true,
            discountCents,
            promotionId: promotion.id,
            code: promotion.code,
            type: promotion.type,
            value: promotion.value
        };
    }

    /**
     * Increment the usage count for a promotion (called when a reservation is created with a promo code)
     */
    async incrementUsage(promotionId: string) {
        return this.prisma.promotion.update({
            where: { id: promotionId },
            data: {
                usageCount: { increment: 1 }
            }
        });
    }
}
