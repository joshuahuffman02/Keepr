import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistEntryDto } from '@campreserv/shared';
import { JwtAuthGuard } from '../auth/guards';

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
}

@UseGuards(JwtAuthGuard)
@Controller('waitlist')
export class WaitlistController {
    constructor(private readonly waitlistService: WaitlistService) { }

    @Post()
    create(@Body() createWaitlistDto: CreateWaitlistEntryDto, @Req() req: any) {
        const idempotencyKey = req.headers["idempotency-key"];
        const sequence = req.headers["x-client-seq"] ?? req.headers["client-seq"];
        return this.waitlistService.create(createWaitlistDto, idempotencyKey, sequence, req.user);
    }

    @Post('staff')
    createStaffEntry(@Body() dto: CreateStaffWaitlistDto, @Req() req: any) {
        const idempotencyKey = req.headers["idempotency-key"];
        const sequence = req.headers["x-client-seq"] ?? req.headers["client-seq"];
        return this.waitlistService.createStaffEntry(dto, idempotencyKey, sequence, req.user);
    }

    @Post(':id/accept')
    accept(@Param('id') id: string, @Req() req: any) {
        const idempotencyKey = req.headers["idempotency-key"];
        const sequence = req.headers["x-client-seq"] ?? req.headers["client-seq"];
        return this.waitlistService.accept(id, idempotencyKey, sequence, req.user);
    }

    @Get()
    findAll(
        @Query('campgroundId') campgroundId: string,
        @Query('type') type?: string,
    ) {
        return this.waitlistService.findAll(campgroundId, type);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.waitlistService.remove(id);
    }
}
