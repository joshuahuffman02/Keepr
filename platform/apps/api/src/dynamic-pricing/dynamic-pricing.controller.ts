import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { DynamicPricingService } from './dynamic-pricing.service';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { ScopeGuard } from '../permissions/scope.guard';
import { UserRole } from '@prisma/client';

@Controller('dynamic-pricing')
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
export class DynamicPricingController {
  constructor(private readonly service: DynamicPricingService) {}

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

  @Post('rules')
  @Roles(UserRole.owner, UserRole.manager)
  createRule(@Body() dto: any, @Req() req: any) {
    const requiredCampgroundId = this.requireCampgroundId(req, dto.campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.createRule({ ...dto, campgroundId: requiredCampgroundId });
  }

  @Get('rules')
  @Roles(UserRole.owner, UserRole.manager)
  listRules(
    @Query('campgroundId') campgroundId: string,
    @Query('includeInactive') includeInactive?: string,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.listRules(requiredCampgroundId, includeInactive === 'true');
  }

  @Get('rules/:id')
  @Roles(UserRole.owner, UserRole.manager)
  getRule(
    @Param('id') id: string,
    @Query('campgroundId') campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.getRule(requiredCampgroundId, id);
  }

  @Patch('rules/:id')
  @Roles(UserRole.owner, UserRole.manager)
  updateRule(
    @Param('id') id: string,
    @Body() dto: any,
    @Query('campgroundId') campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.updateRule(requiredCampgroundId, id, dto);
  }

  @Delete('rules/:id')
  @Roles(UserRole.owner, UserRole.manager)
  deleteRule(
    @Param('id') id: string,
    @Query('campgroundId') campgroundId: string | undefined,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.deleteRule(requiredCampgroundId, id);
  }

  @Get('calculate')
  @Roles(UserRole.owner, UserRole.manager)
  calculateAdjustment(
    @Query('campgroundId') campgroundId: string,
    @Query('siteClassId') siteClassId: string | null,
    @Query('date') date: string,
    @Query('basePrice') basePrice: string,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.calculateAdjustment(
      requiredCampgroundId,
      siteClassId,
      new Date(date),
      parseInt(basePrice, 10)
    );
  }

  @Post('occupancy-snapshot')
  @Roles(UserRole.owner, UserRole.manager)
  recordOccupancySnapshot(
    @Body() dto: { campgroundId: string; date: string },
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, dto.campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.recordOccupancySnapshot(requiredCampgroundId, new Date(dto.date));
  }

  @Get('occupancy')
  @Roles(UserRole.owner, UserRole.manager)
  getOccupancy(
    @Query('campgroundId') campgroundId: string,
    @Query('date') date: string,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.getOccupancyForDate(requiredCampgroundId, new Date(date));
  }

  @Post('forecasts/generate')
  @Roles(UserRole.owner, UserRole.manager)
  generateForecast(
    @Body() dto: { campgroundId: string; daysAhead?: number },
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, dto.campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.generateForecast(requiredCampgroundId, dto.daysAhead);
  }

  @Get('forecasts')
  @Roles(UserRole.owner, UserRole.manager)
  getForecasts(
    @Query('campgroundId') campgroundId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.service.getForecasts(
      requiredCampgroundId,
      new Date(startDate),
      new Date(endDate)
    );
  }
}
