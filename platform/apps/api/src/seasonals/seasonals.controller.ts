import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { JwtAuthGuard } from "../auth/guards";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";
import { UserRole, SeasonalStatus, RenewalIntent } from ".prisma/client";
import { SeasonalsService } from "./seasonals.service";
import { SeasonalPricingService } from "./seasonal-pricing.service";
import {
  CreateSeasonalGuestDto,
  UpdateSeasonalGuestDto,
  UpdateRenewalIntentDto,
  RecordPaymentDto,
  CreateRateCardDto,
  UpdateRateCardDto,
  CreateDiscountDto,
  CreateIncentiveDto,
  PricingPreviewDto,
  BulkMessageDto,
  SeasonalGuestQueryDto,
} from "./dto";

@Controller("seasonals")
export class SeasonalsController {
  constructor(
    private readonly seasonals: SeasonalsService,
    private readonly pricing: SeasonalPricingService
  ) {}

  // ==================== SEASONAL GUESTS ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post()
  async createSeasonalGuest(@Req() req: any, @Body() dto: CreateSeasonalGuestDto) {
    return this.seasonals.create(dto, req.user?.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get("campground/:campgroundId")
  async listSeasonalGuests(
    @Param("campgroundId") campgroundId: string,
    @Query() query: SeasonalGuestQueryDto
  ) {
    const filters = {
      status: query.status?.includes(",")
        ? (query.status.split(",") as SeasonalStatus[])
        : (query.status as SeasonalStatus | undefined),
      renewalIntent: query.renewalIntent?.includes(",")
        ? (query.renewalIntent.split(",") as RenewalIntent[])
        : (query.renewalIntent as RenewalIntent | undefined),
      paymentStatus: query.paymentStatus as "current" | "past_due" | "paid_ahead" | undefined,
      contractStatus: query.contractStatus as "signed" | "pending" | "not_sent" | undefined,
      siteId: query.siteId,
      tenureMin: query.tenureMin ? parseInt(query.tenureMin, 10) : undefined,
      tenureMax: query.tenureMax ? parseInt(query.tenureMax, 10) : undefined,
      search: query.search,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    };

    return this.seasonals.findByCampground(campgroundId, filters);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get(":id")
  async getSeasonalGuest(@Param("id") id: string) {
    return this.seasonals.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @RequireScope({ resource: "reservations", action: "write" })
  @Put(":id")
  async updateSeasonalGuest(@Param("id") id: string, @Body() dto: UpdateSeasonalGuestDto) {
    return this.seasonals.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post(":id/renewal-intent")
  async updateRenewalIntent(
    @Param("id") id: string,
    @Body() dto: UpdateRenewalIntentDto
  ) {
    return this.seasonals.updateRenewalIntent(id, dto.intent, dto.notes);
  }

  // ==================== DASHBOARD STATS ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get("campground/:campgroundId/stats")
  async getDashboardStats(
    @Param("campgroundId") campgroundId: string,
    @Query("seasonYear") seasonYear?: string
  ) {
    return this.seasonals.getDashboardStats(
      campgroundId,
      seasonYear ? parseInt(seasonYear, 10) : undefined
    );
  }

  // ==================== PAYMENTS ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("payments")
  async recordPayment(@Req() req: any, @Body() dto: RecordPaymentDto) {
    return this.seasonals.recordPayment(
      {
        ...dto,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      },
      req.user?.id
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "reservations", action: "read" })
  @Get(":id/payments")
  async getPaymentHistory(
    @Param("id") id: string,
    @Query("seasonYear") seasonYear?: string
  ) {
    return this.seasonals.getPaymentHistory(
      id,
      seasonYear ? parseInt(seasonYear, 10) : undefined
    );
  }

  // ==================== RATE CARDS ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "settings", action: "write" })
  @Post("rate-cards")
  async createRateCard(@Body() dto: CreateRateCardDto) {
    return this.seasonals.createRateCard({
      campground: { connect: { id: dto.campgroundId } },
      name: dto.name,
      seasonYear: dto.seasonYear,
      baseRate: dto.baseRate,
      billingFrequency: dto.billingFrequency,
      description: dto.description,
      includedUtilities: dto.includedUtilities,
      seasonStartDate: new Date(dto.seasonStartDate),
      seasonEndDate: new Date(dto.seasonEndDate),
      isDefault: dto.isDefault,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance, UserRole.readonly)
  @RequireScope({ resource: "settings", action: "read" })
  @Get("campground/:campgroundId/rate-cards")
  async getRateCards(
    @Param("campgroundId") campgroundId: string,
    @Query("seasonYear") seasonYear?: string
  ) {
    return this.seasonals.getRateCards(
      campgroundId,
      seasonYear ? parseInt(seasonYear, 10) : undefined
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "settings", action: "write" })
  @Put("rate-cards/:id")
  async updateRateCard(@Param("id") id: string, @Body() dto: UpdateRateCardDto) {
    return this.seasonals.updateRateCard(id, {
      ...dto,
      seasonStartDate: dto.seasonStartDate ? new Date(dto.seasonStartDate) : undefined,
      seasonEndDate: dto.seasonEndDate ? new Date(dto.seasonEndDate) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "settings", action: "write" })
  @Post("rate-cards/:id/discounts")
  async addDiscount(@Param("id") rateCardId: string, @Body() dto: CreateDiscountDto) {
    return this.seasonals.addDiscount(rateCardId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "settings", action: "write" })
  @Post("rate-cards/:id/incentives")
  async addIncentive(@Param("id") rateCardId: string, @Body() dto: CreateIncentiveDto) {
    return this.seasonals.addIncentive(rateCardId, dto);
  }

  // ==================== PRICING PREVIEW ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk, UserRole.finance)
  @RequireScope({ resource: "reservations", action: "read" })
  @Post("pricing/preview")
  async previewPricing(@Body() dto: PricingPreviewDto) {
    return this.pricing.previewPricing(dto.rateCardId, {
      isMetered: dto.isMetered,
      paymentMethod: dto.paymentMethod,
      paysInFull: dto.paysInFull,
      tenureYears: dto.tenureYears,
      commitDate: dto.commitDate ? new Date(dto.commitDate) : undefined,
      isReturning: dto.isReturning,
      siteClassId: dto.siteClassId,
      isReferral: dto.isReferral,
      isMilitary: dto.isMilitary,
      isSenior: dto.isSenior,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post(":id/apply-pricing")
  async applyPricing(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: { rateCardId: string; seasonYear: number; manualAdjustment?: { amount: number; reason: string } }
  ) {
    await this.pricing.applyPricingToGuest(
      id,
      dto.rateCardId,
      dto.seasonYear,
      dto.manualAdjustment ? { ...dto.manualAdjustment, userId: req.user?.id } : undefined
    );
    return this.seasonals.findById(id);
  }

  // ==================== BULK COMMUNICATIONS ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("messages/bulk")
  async sendBulkMessage(@Req() req: any, @Body() dto: BulkMessageDto) {
    return this.seasonals.sendBulkMessage(dto, req.user?.id);
  }

  // ==================== CONVERT RESERVATION TO SEASONAL ====================
  // NOTE: These endpoints are STAFF-ONLY - guests cannot convert themselves

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk) // NO guest role - staff only
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("convert-from-reservation/:reservationId")
  async convertReservationToSeasonal(
    @Req() req: any,
    @Param("reservationId") reservationId: string,
    @Body() dto: { rateCardId?: string; isMetered?: boolean; paysInFull?: boolean; notes?: string }
  ) {
    return this.seasonals.convertReservationToSeasonal(
      reservationId,
      dto,
      req.user?.id
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.front_desk) // NO guest role - staff only
  @RequireScope({ resource: "reservations", action: "write" })
  @Post("link-reservation")
  async linkReservationToSeasonal(
    @Req() req: any,
    @Body() dto: { reservationId: string; seasonalGuestId: string }
  ) {
    return this.seasonals.linkReservationToSeasonal(
      dto.reservationId,
      dto.seasonalGuestId,
      req.user?.id
    );
  }

  // ==================== ADMIN OPERATIONS ====================

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "settings", action: "write" })
  @Post("campground/:campgroundId/recalculate-seniority")
  async recalculateSeniority(@Param("campgroundId") campgroundId: string) {
    await this.seasonals.recalculateSeniority(campgroundId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "settings", action: "write" })
  @Post("campground/:campgroundId/rollover-season")
  async rolloverSeason(
    @Param("campgroundId") campgroundId: string,
    @Body() dto: { fromYear: number; toYear: number }
  ) {
    return this.seasonals.rolloverSeason(campgroundId, dto.fromYear, dto.toYear);
  }
}
