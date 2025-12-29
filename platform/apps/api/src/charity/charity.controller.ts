import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CharityService,
  CreateCharityDto,
  UpdateCharityDto,
  SetCampgroundCharityDto,
} from "./charity.service";
import { DonationStatus, CharityPayoutStatus, PlatformRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";

@Controller("charity")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin)
export class CharityController {
  constructor(private charityService: CharityService) {}

  // ==========================================================================
  // CHARITY CRUD (Platform Admin)
  // ==========================================================================

  @Get()
  async listCharities(
    @Query("category") category?: string,
    @Query("activeOnly") activeOnly?: string
  ) {
    return this.charityService.listCharities({
      category,
      activeOnly: activeOnly !== "false",
    });
  }

  @Get("categories")
  async getCategories() {
    return this.charityService.getCharityCategories();
  }

  @Get(":id")
  async getCharity(@Param("id") id: string) {
    return this.charityService.getCharity(id);
  }

  @Post()
  async createCharity(@Body() data: CreateCharityDto) {
    return this.charityService.createCharity(data);
  }

  @Put(":id")
  async updateCharity(@Param("id") id: string, @Body() data: UpdateCharityDto) {
    return this.charityService.updateCharity(id, data);
  }

  @Delete(":id")
  async deleteCharity(@Param("id") id: string) {
    return this.charityService.deleteCharity(id);
  }

  // ==========================================================================
  // PLATFORM STATS
  // ==========================================================================

  @Get("stats/platform")
  async getPlatformStats(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    return this.charityService.getPlatformDonationStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  // ==========================================================================
  // PAYOUTS
  // ==========================================================================

  @Get("payouts")
  async listPayouts(
    @Query("charityId") charityId?: string,
    @Query("status") status?: CharityPayoutStatus,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.charityService.listPayouts({
      charityId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post("payouts")
  async createPayout(
    @Body() data: { charityId: string; createdBy?: string }
  ) {
    return this.charityService.createPayout(data.charityId, data.createdBy);
  }

  @Put("payouts/:id/complete")
  async completePayout(
    @Param("id") id: string,
    @Body() data: { reference?: string; notes?: string }
  ) {
    return this.charityService.completePayout(id, data.reference, data.notes);
  }
}

// Admin charity endpoints (platform-wide)
@Controller("admin/charity")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin)
export class AdminCharityController {
  constructor(private charityService: CharityService) {}

  @Get("donations")
  async listAllDonations(
    @Query("charityId") charityId?: string,
    @Query("campgroundId") campgroundId?: string,
    @Query("status") status?: DonationStatus,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.charityService.listDonations({
      charityId,
      campgroundId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("payouts")
  async listAllPayouts(
    @Query("charityId") charityId?: string,
    @Query("status") status?: CharityPayoutStatus,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.charityService.listPayouts({
      charityId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post("payouts")
  async createPayout(
    @Body() data: { charityId: string; createdBy?: string }
  ) {
    return this.charityService.createPayout(data.charityId, data.createdBy);
  }

  @Put("payouts/:id/complete")
  async completePayout(
    @Param("id") id: string,
    @Body() data: { reference?: string; notes?: string }
  ) {
    return this.charityService.completePayout(id, data.reference, data.notes);
  }
}

// Campground-specific charity endpoints
@Controller("campgrounds/:campgroundId/charity")
@UseGuards(JwtAuthGuard, ScopeGuard)
export class CampgroundCharityController {
  constructor(private charityService: CharityService) {}

  @Get()
  async getCampgroundCharity(@Param("campgroundId") campgroundId: string) {
    return this.charityService.getCampgroundCharity(campgroundId);
  }

  @Put()
  async setCampgroundCharity(
    @Param("campgroundId") campgroundId: string,
    @Body() data: SetCampgroundCharityDto
  ) {
    return this.charityService.setCampgroundCharity(campgroundId, data);
  }

  @Delete()
  async disableCampgroundCharity(@Param("campgroundId") campgroundId: string) {
    return this.charityService.disableCampgroundCharity(campgroundId);
  }

  @Get("stats")
  async getCampgroundStats(
    @Param("campgroundId") campgroundId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    return this.charityService.getCampgroundDonationStats(
      campgroundId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  @Get("donations")
  async listCampgroundDonations(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: DonationStatus,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.charityService.listDonations({
      campgroundId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("calculate-roundup")
  async calculateRoundUp(
    @Param("campgroundId") campgroundId: string,
    @Query("amountCents") amountCents: string
  ) {
    const settings = await this.charityService.getCampgroundCharity(campgroundId);

    if (!settings || !settings.isEnabled) {
      return { enabled: false };
    }

    const amount = parseInt(amountCents, 10);
    const roundUp = this.charityService.calculateRoundUp(
      amount,
      settings.roundUpType,
      settings.roundUpOptions as { values: number[] } | undefined
    );

    return {
      originalAmountCents: amount,
      roundedAmountCents: roundUp.newTotal,
      donationAmountCents: roundUp.roundUpAmount,
      charityName: settings.charity.name,
      charityId: settings.charity.id,
    };
  }

  @Post("donations")
  async createDonation(
    @Param("campgroundId") campgroundId: string,
    @Body() data: { reservationId: string; charityId: string; amountCents: number; guestId?: string }
  ) {
    return this.charityService.createDonation({
      ...data,
      campgroundId,
    });
  }
}
