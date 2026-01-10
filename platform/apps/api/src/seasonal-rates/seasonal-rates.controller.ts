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
    UseGuards
} from '@nestjs/common';
import { SeasonalRatesService } from './seasonal-rates.service';
import { RateType, PaymentSchedule, PricingStructure, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ScopeGuard } from '../permissions/scope.guard';

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller('seasonal-rates')
export class SeasonalRatesController {
    constructor(private readonly seasonalRatesService: SeasonalRatesService) { }

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

    @Roles(UserRole.owner, UserRole.manager)
    @Post()
    create(@Body() body: {
        campgroundId: string;
        siteClassId?: string;
        name: string;
        rateType: RateType;
        amount: number;
        minNights?: number;
        startDate?: Date;
        endDate?: Date;
        paymentSchedule?: PaymentSchedule;
        pricingStructure?: PricingStructure;
        offseasonInterval?: number;
        offseasonAmount?: number;
        prorateExcess?: boolean;
    }, @Req() req: Request) {
        this.assertCampgroundAccess(body.campgroundId, req.user);
        return this.seasonalRatesService.create(body);
    }

    @Roles(UserRole.owner, UserRole.manager)
    @Get('campground/:campgroundId')
    findAllByCampground(@Param('campgroundId') campgroundId: string, @Req() req: Request) {
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.seasonalRatesService.findAllByCampground(campgroundId);
    }

    @Roles(UserRole.owner, UserRole.manager)
    @Get(':id')
    findOne(
        @Param('id') id: string,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.seasonalRatesService.findOne(requiredCampgroundId, id);
    }

    @Roles(UserRole.owner, UserRole.manager)
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() body: Partial<{
            name: string;
            rateType: RateType;
            amount: number;
            minNights: number;
            startDate: Date;
            endDate: Date;
            isActive: boolean;
            paymentSchedule: PaymentSchedule;
            pricingStructure: PricingStructure;
            offseasonInterval: number;
            offseasonAmount: number;
            prorateExcess: boolean;
        }>,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.seasonalRatesService.update(requiredCampgroundId, id, body);
    }

    @Roles(UserRole.owner, UserRole.manager)
    @Delete(':id')
    remove(
        @Param('id') id: string,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.seasonalRatesService.remove(requiredCampgroundId, id);
    }
}
