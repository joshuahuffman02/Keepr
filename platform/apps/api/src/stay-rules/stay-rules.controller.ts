import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { StayRulesService } from './stay-rules.service';
import { JwtAuthGuard } from '../auth/guards';

interface DateRange {
    start: string;
    end: string;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class StayRulesController {
    constructor(private readonly stayRulesService: StayRulesService) { }

    @Post('campgrounds/:campgroundId/stay-rules')
    create(
        @Param('campgroundId') campgroundId: string,
        @Body() body: {
            name: string;
            minNights?: number;
            maxNights?: number;
            siteClasses?: string[];
            dateRanges?: DateRange[];
            ignoreDaysBefore?: number;
        }
    ) {
        return this.stayRulesService.create({
            campgroundId,
            ...body,
        });
    }

    @Get('campgrounds/:campgroundId/stay-rules')
    findAllByCampground(@Param('campgroundId') campgroundId: string) {
        return this.stayRulesService.findAllByCampground(campgroundId);
    }

    @Get('stay-rules/:id')
    findOne(@Param('id') id: string) {
        return this.stayRulesService.findOne(id);
    }

    @Patch('stay-rules/:id')
    update(
        @Param('id') id: string,
        @Body() body: Partial<{
            name: string;
            minNights: number;
            maxNights: number;
            siteClasses: string[];
            dateRanges: DateRange[];
            ignoreDaysBefore: number;
            isActive: boolean;
        }>
    ) {
        return this.stayRulesService.update(id, body);
    }

    @Delete('stay-rules/:id')
    remove(@Param('id') id: string) {
        return this.stayRulesService.remove(id);
    }

    @Post('stay-rules/:id/duplicate')
    duplicate(@Param('id') id: string) {
        return this.stayRulesService.duplicate(id);
    }
}
