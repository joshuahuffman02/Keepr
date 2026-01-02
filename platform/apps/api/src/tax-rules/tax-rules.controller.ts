import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { TaxRulesService } from './tax-rules.service';
import { TaxRuleType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScopeGuard } from '../permissions/scope.guard';

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller('tax-rules')
export class TaxRulesController {
    constructor(private readonly taxRulesService: TaxRulesService) { }

    private requireCampgroundId(req: any, fallback?: string): string {
        const campgroundId = fallback || req?.campgroundId || req?.headers?.["x-campground-id"];
        if (!campgroundId) {
            throw new BadRequestException("campgroundId is required");
        }
        return campgroundId;
    }

    private assertCampgroundAccess(campgroundId: string, user: any): void {
        const isPlatformStaff = user?.platformRole === "platform_admin" ||
                                user?.platformRole === "platform_superadmin" ||
                                user?.platformRole === "support_agent";
        if (isPlatformStaff) {
            return;
        }

        const userCampgroundIds = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
        if (!userCampgroundIds.includes(campgroundId)) {
            throw new BadRequestException("You do not have access to this campground");
        }
    }

    @Post()
    create(@Body() body: {
        campgroundId: string;
        name: string;
        type: TaxRuleType;
        rate?: number;
        minNights?: number;
        maxNights?: number;
        requiresWaiver?: boolean;
        waiverText?: string;
    }, @Req() req: any) {
        this.assertCampgroundAccess(body.campgroundId, req.user);
        return this.taxRulesService.create(body);
    }

    @Get('campground/:campgroundId')
    findAllByCampground(@Param('campgroundId') campgroundId: string, @Req() req: any) {
        this.assertCampgroundAccess(campgroundId, req.user);
        return this.taxRulesService.findAllByCampground(campgroundId);
    }

    @Get(':id')
    findOne(
        @Param('id') id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.taxRulesService.findOne(requiredCampgroundId, id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() body: Partial<{
            name: string;
            type: TaxRuleType;
            rate: number;
            minNights: number;
            maxNights: number;
            requiresWaiver: boolean;
            waiverText: string;
            isActive: boolean;
        }>,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.taxRulesService.update(requiredCampgroundId, id, body);
    }

    @Delete(':id')
    remove(
        @Param('id') id: string,
        @Query("campgroundId") campgroundId: string | undefined,
        @Req() req: any
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.taxRulesService.remove(requiredCampgroundId, id);
    }
}
