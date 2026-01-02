import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { StayRulesService } from './stay-rules.service';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScopeGuard } from '../permissions/scope.guard';

interface DateRange {
    start: string;
    end: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class StayRulesController {
    constructor(private readonly stayRulesService: StayRulesService) { }

    private requireCampgroundId(req: any, fallback?: string): string {
        const campgroundId = fallback || req?.campgroundId || req?.headers?.['x-campground-id'];
        if (!campgroundId) {
            throw new BadRequestException('campgroundId is required');
        }
        return campgroundId;
    }

    private assertCampgroundAccess(campgroundId: string, user: any): void {
        const isPlatformStaff = user?.platformRole === 'platform_admin' ||
                                user?.platformRole === 'platform_superadmin' ||
                                user?.platformRole === 'support_agent';
        if (isPlatformStaff) {
            return;
        }

        const userCampgroundIds = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
        if (!userCampgroundIds.includes(campgroundId)) {
            throw new BadRequestException('You do not have access to this campground');
        }
    }

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
        },
        @Req() req: any
    ) {
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.stayRulesService.create({
            campgroundId,
            ...body,
        });
    }

    @Get('campgrounds/:campgroundId/stay-rules')
    findAllByCampground(@Param('campgroundId') campgroundId: string, @Req() req: any) {
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.stayRulesService.findAllByCampground(campgroundId);
    }

    @Get('stay-rules/:id')
    findOne(
        @Param('id') id: string,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.stayRulesService.findOne(requiredCampgroundId, id);
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
        }>,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.stayRulesService.update(requiredCampgroundId, id, body);
    }

    @Delete('stay-rules/:id')
    remove(
        @Param('id') id: string,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.stayRulesService.remove(requiredCampgroundId, id);
    }

    @Post('stay-rules/:id/duplicate')
    duplicate(
        @Param('id') id: string,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.stayRulesService.duplicate(requiredCampgroundId, id);
    }
}
