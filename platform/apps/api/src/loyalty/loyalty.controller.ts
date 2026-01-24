import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { LoyaltyService } from "./loyalty.service";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("loyalty")
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get("guests/:guestId")
  async getGuestProfile(@Param("guestId") guestId: string) {
    return this.loyaltyService.getProfile(guestId);
  }

  @Post("batch")
  async getProfilesBatch(@Body() body: { guestIds: string[] }) {
    return this.loyaltyService.getProfilesBatch(body.guestIds || []);
  }

  @Post("guests/:guestId/points")
  async awardPoints(
    @Param("guestId") guestId: string,
    @Body() body: { amount: number; reason: string },
  ) {
    return this.loyaltyService.awardPoints(guestId, body.amount, body.reason);
  }
}
