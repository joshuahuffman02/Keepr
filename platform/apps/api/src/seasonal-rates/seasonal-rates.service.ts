import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RateType } from '@prisma/client';

@Injectable()
export class SeasonalRatesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: {
        campgroundId: string;
        siteClassId?: string;
        name: string;
        rateType: RateType;
        amount: number;
        minNights?: number;
        startDate?: Date;
        endDate?: Date;
    }) {
        return this.prisma.seasonalRate.create({
            data: {
                campgroundId: data.campgroundId,
                siteClassId: data.siteClassId,
                name: data.name,
                rateType: data.rateType,
                amount: data.amount,
                minNights: data.minNights,
                startDate: data.startDate,
                endDate: data.endDate,
            },
        });
    }

    async findAllByCampground(campgroundId: string) {
        return this.prisma.seasonalRate.findMany({
            where: { campgroundId },
            include: { SiteClass: true },
            orderBy: { minNights: 'desc' },
        });
    }

    async findOne(campgroundId: string, id: string) {
        const rate = await this.prisma.seasonalRate.findFirst({
            where: { id, campgroundId },
            include: { SiteClass: true },
        });
        if (!rate) throw new NotFoundException('Seasonal rate not found');
        return rate;
    }

    async update(campgroundId: string, id: string, data: Partial<{
        name: string;
        rateType: RateType;
        amount: number;
        minNights: number;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
    }>) {
        await this.findOne(campgroundId, id);
        const { campgroundId: _campgroundId, ...rest } =
            data as Partial<{ campgroundId?: string }>;
        return this.prisma.seasonalRate.update({
            where: { id },
            data: rest,
        });
    }

    async remove(campgroundId: string, id: string) {
        await this.findOne(campgroundId, id);
        return this.prisma.seasonalRate.delete({ where: { id } });
    }

    // Find the best applicable rate for a reservation
    async findApplicableRate(campgroundId: string, siteClassId: string | null, nights: number, arrivalDate: Date) {
        const rates = await this.prisma.seasonalRate.findMany({
            where: {
                campgroundId,
                isActive: true,
                OR: [
                    { siteClassId: null }, // Campground-wide rates
                    { siteClassId: siteClassId || undefined }, // Class-specific rates
                ],
            },
            orderBy: [
                { minNights: 'desc' }, // Prefer longer-stay rates first
            ],
        });

        for (const rate of rates) {
            // Check minimum nights
            if (rate.minNights && nights < rate.minNights) continue;

            // Check date range if applicable
            if (rate.startDate && arrivalDate < rate.startDate) continue;
            if (rate.endDate && arrivalDate > rate.endDate) continue;

            return rate;
        }

        return null; // No special rate applies, use default
    }
}
