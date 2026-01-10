import {
    BadRequestException,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards
} from '@nestjs/common';
import { RepeatChargesService } from './repeat-charges.service';
import { JwtAuthGuard } from '../auth/guards';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ScopeGuard } from '../permissions/scope.guard';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller('repeat-charges')
export class RepeatChargesController {
    constructor(private readonly repeatChargesService: RepeatChargesService) { }

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

    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    @Get()
    findAll(@Query('campgroundId') campgroundId: string, @Req() req: Request) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.repeatChargesService.getAllCharges(requiredCampgroundId);
    }

    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    @Get('reservation/:id')
    findByReservation(
        @Param('id') id: string,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.repeatChargesService.getCharges(requiredCampgroundId, id);
    }

    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    @Post('reservation/:id/generate')
    generate(
        @Param('id') id: string,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.repeatChargesService.generateCharges(requiredCampgroundId, id);
    }

    @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
    @Post(':id/process')
    process(
        @Param('id') id: string,
        @Query('campgroundId') campgroundId: string | undefined,
        @Req() req: Request
    ) {
        const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
        this.assertCampgroundAccess(requiredCampgroundId, req.user);
        return this.repeatChargesService.processCharge(requiredCampgroundId, id);
    }
}
