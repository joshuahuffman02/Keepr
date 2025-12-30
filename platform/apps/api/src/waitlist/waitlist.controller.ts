import { Controller, Get, Post, Patch, Body, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistEntryDto } from '@campreserv/shared';
import { JwtAuthGuard } from '../auth/guards';
import { ScopeGuard } from '../auth/guards/scope.guard';

interface CreateStaffWaitlistDto {
    campgroundId: string;
    type: 'regular' | 'seasonal';
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
    siteId?: string;
    siteTypeId?: string;
    arrivalDate?: string;
    departureDate?: string;
    priority?: number;
    autoOffer?: boolean;
    maxPrice?: number;
    flexibleDates?: boolean;
    flexibleDays?: number;
}

interface UpdateWaitlistDto {
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
    siteId?: string;
    siteTypeId?: string;
    arrivalDate?: string;
    departureDate?: string;
    priority?: number;
    autoOffer?: boolean;
    maxPrice?: number;
    flexibleDates?: boolean;
    flexibleDays?: number;
    status?: 'waiting' | 'offered' | 'accepted' | 'expired' | 'cancelled';
}

@UseGuards(JwtAuthGuard, ScopeGuard)
@Controller('campgrounds/:campgroundId/waitlist')
export class WaitlistController {
    constructor(private readonly waitlistService: WaitlistService) { }

    @Post()
    create(
        @Param('campgroundId') campgroundId: string,
        @Body() createWaitlistDto: CreateWaitlistEntryDto,
        @Req() req: any
    ) {
        const idempotencyKey = req.headers["idempotency-key"];
        const sequence = req.headers["x-client-seq"] ?? req.headers["client-seq"];
        // Ensure campgroundId from path is used
        return this.waitlistService.create(
            { ...createWaitlistDto, campgroundId },
            idempotencyKey,
            sequence,
            req.user
        );
    }

    @Post('staff')
    createStaffEntry(
        @Param('campgroundId') campgroundId: string,
        @Body() dto: CreateStaffWaitlistDto,
        @Req() req: any
    ) {
        const idempotencyKey = req.headers["idempotency-key"];
        const sequence = req.headers["x-client-seq"] ?? req.headers["client-seq"];
        // Ensure campgroundId from path is used
        return this.waitlistService.createStaffEntry(
            { ...dto, campgroundId },
            idempotencyKey,
            sequence,
            req.user
        );
    }

    @Post(':id/accept')
    accept(
        @Param('campgroundId') campgroundId: string,
        @Param('id') id: string,
        @Req() req: any
    ) {
        const idempotencyKey = req.headers["idempotency-key"];
        const sequence = req.headers["x-client-seq"] ?? req.headers["client-seq"];
        return this.waitlistService.accept(id, idempotencyKey, sequence, req.user);
    }

    @Get()
    findAll(
        @Param('campgroundId') campgroundId: string,
        @Query('type') type?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.waitlistService.findAll(campgroundId, {
            type,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined
        });
    }

    @Patch(':id')
    update(
        @Param('campgroundId') campgroundId: string,
        @Param('id') id: string,
        @Body() dto: UpdateWaitlistDto
    ) {
        return this.waitlistService.updateEntry(id, campgroundId, dto);
    }

    @Delete(':id')
    remove(
        @Param('campgroundId') campgroundId: string,
        @Param('id') id: string
    ) {
        return this.waitlistService.remove(id, campgroundId);
    }
}
