import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { LockCodesService } from './lock-codes.service';
import { LockCodeType, LockCodeRotationSchedule } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';

@UseGuards(JwtAuthGuard)
@Controller('campgrounds/:campgroundId/lock-codes')
export class LockCodesController {
    constructor(private readonly lockCodesService: LockCodesService) { }

    @Post()
    create(
        @Param('campgroundId') campgroundId: string,
        @Body() body: {
            name: string;
            code: string;
            type: LockCodeType;
            rotationSchedule?: LockCodeRotationSchedule;
            showOnConfirmation?: boolean;
            showAtCheckin?: boolean;
            appliesTo?: string[];
            notes?: string;
        }
    ) {
        return this.lockCodesService.create({
            campgroundId,
            ...body,
        });
    }

    @Get()
    findAllByCampground(@Param('campgroundId') campgroundId: string) {
        return this.lockCodesService.findAllByCampground(campgroundId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.lockCodesService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() body: Partial<{
            name: string;
            code: string;
            type: LockCodeType;
            rotationSchedule: LockCodeRotationSchedule;
            showOnConfirmation: boolean;
            showAtCheckin: boolean;
            appliesTo: string[];
            isActive: boolean;
            notes: string;
        }>
    ) {
        return this.lockCodesService.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.lockCodesService.remove(id);
    }

    @Post(':id/rotate')
    rotate(@Param('id') id: string) {
        return this.lockCodesService.rotate(id);
    }

    @Get('guest/confirmation')
    getConfirmationCodes(@Param('campgroundId') campgroundId: string) {
        return this.lockCodesService.getGuestVisibleCodes(campgroundId, 'confirmation');
    }

    @Get('guest/checkin')
    getCheckinCodes(@Param('campgroundId') campgroundId: string) {
        return this.lockCodesService.getGuestVisibleCodes(campgroundId, 'checkin');
    }
}
