import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBlackoutDateDto, UpdateBlackoutDateDto } from "./dto/blackout.dto";

@Injectable()
export class BlackoutsService {
    constructor(private readonly prisma: PrismaService) { }

    private parseDates(startDate: string, endDate: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.valueOf()) || isNaN(end.valueOf())) {
            throw new BadRequestException("Invalid date format. Please use a valid date format (YYYY-MM-DD)");
        }
        if (end <= start) {
            throw new BadRequestException("End date must be after start date. Please adjust your date range");
        }
        return { start, end };
    }

    private async validateCampgroundAndSite(campgroundId: string, siteId?: string | null) {
        const campground = await this.prisma.campground.findUnique({ where: { id: campgroundId }, select: { id: true } });
        if (!campground) {
            throw new NotFoundException("Campground not found. Please verify the campground ID or contact support");
        }

        if (!siteId) return null;

        const site = await this.prisma.site.findUnique({
            where: { id: siteId },
            select: { id: true, campgroundId: true }
        });
        if (!site || site.campgroundId !== campgroundId) {
            throw new BadRequestException("Site not found for this campground");
        }
        return site.id;
    }

    private async assertNoOverlap(campgroundId: string, start: Date, end: Date, siteId?: string | null, excludeId?: string) {
        const overlapCount = await this.prisma.blackoutDate.count({
            where: {
                campgroundId,
                id: excludeId ? { not: excludeId } : undefined,
                startDate: { lt: end },
                endDate: { gt: start },
                ...(siteId
                    ? { OR: [{ siteId }, { siteId: null }] } // park-wide blocks overlap any site blackout
                    : {}) // park-wide should check any existing blackout
            }
        });

        if (overlapCount > 0) {
            throw new BadRequestException("Blackout dates overlap an existing blackout");
        }
    }

    async create(data: CreateBlackoutDateDto) {
        const { start, end } = this.parseDates(data.startDate, data.endDate);
        const siteId = await this.validateCampgroundAndSite(data.campgroundId, data.siteId || null);
        await this.assertNoOverlap(data.campgroundId, start, end, siteId, undefined);

        return this.prisma.blackoutDate.create({
            data: {
                campgroundId: data.campgroundId,
                siteId: siteId || null,
                startDate: start,
                endDate: end,
                reason: data.reason
            }
        });
    }

    async findAll(campgroundId: string) {
        return this.prisma.blackoutDate.findMany({
            where: { campgroundId },
            include: { site: true },
            orderBy: { startDate: "asc" }
        });
    }

    async findOne(campgroundId: string, id: string) {
        const blackout = await this.prisma.blackoutDate.findFirst({
            where: { id, campgroundId },
            include: { site: true }
        });
        if (!blackout) throw new NotFoundException("Blackout date not found");
        return blackout;
    }

    async update(campgroundId: string, id: string, data: UpdateBlackoutDateDto) {
        const existing = await this.findOne(campgroundId, id);

        const start = data.startDate ? new Date(data.startDate) : existing.startDate;
        const end = data.endDate ? new Date(data.endDate) : existing.endDate;
        if (isNaN(start.valueOf()) || isNaN(end.valueOf())) {
            throw new BadRequestException("Invalid date format. Please use a valid date format (YYYY-MM-DD)");
        }
        if (end <= start) {
            throw new BadRequestException("End date must be after start date. Please adjust your date range");
        }

        const siteId = await this.validateCampgroundAndSite(existing.campgroundId, data.siteId ?? existing.siteId);
        await this.assertNoOverlap(existing.campgroundId, start, end, siteId ?? existing.siteId, id);

        return this.prisma.blackoutDate.update({
            where: { id },
            data: {
                startDate: start,
                endDate: end,
                reason: data.reason ?? existing.reason,
                siteId: siteId ?? null
            }
        });
    }

    async remove(campgroundId: string, id: string) {
        await this.findOne(campgroundId, id);
        return this.prisma.blackoutDate.delete({ where: { id } });
    }
}
