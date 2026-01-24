import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { FlexCheckService } from "./flex-check.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

type FlexCheckPolicyBody = {
  earlyCheckInEnabled?: boolean;
  earlyCheckInMinHours?: number;
  earlyCheckInPricing?: unknown;
  earlyCheckInAutoApprove?: boolean;
  lateCheckoutEnabled?: boolean;
  lateCheckoutMaxHours?: number;
  lateCheckoutPricing?: unknown;
  lateCheckoutAutoApprove?: boolean;
};

@Controller("flex-check")
@UseGuards(JwtAuthGuard)
export class FlexCheckController {
  constructor(private flexCheckService: FlexCheckService) {}

  // ==================== POLICY ====================

  @Get("policy")
  getPolicy(@Query("campgroundId") campgroundId: string) {
    return this.flexCheckService.getPolicy(campgroundId);
  }

  @Patch("policy")
  updatePolicy(@Query("campgroundId") campgroundId: string, @Body() body: FlexCheckPolicyBody) {
    return this.flexCheckService.upsertPolicy(campgroundId, body);
  }

  // ==================== EARLY CHECK-IN ====================

  @Post("early-checkin/request")
  requestEarlyCheckIn(@Body() body: { reservationId: string; requestedTime: string }) {
    return this.flexCheckService.requestEarlyCheckIn(
      body.reservationId,
      new Date(body.requestedTime),
    );
  }

  @Post("early-checkin/:reservationId/approve")
  approveEarlyCheckIn(
    @Param("reservationId") reservationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flexCheckService.approveEarlyCheckIn(reservationId, user.id);
  }

  @Post("early-checkin/:reservationId/deny")
  denyEarlyCheckIn(@Param("reservationId") reservationId: string) {
    return this.flexCheckService.denyEarlyCheckIn(reservationId);
  }

  // ==================== LATE CHECKOUT ====================

  @Post("late-checkout/request")
  requestLateCheckout(@Body() body: { reservationId: string; requestedTime: string }) {
    return this.flexCheckService.requestLateCheckout(
      body.reservationId,
      new Date(body.requestedTime),
    );
  }

  @Post("late-checkout/:reservationId/approve")
  approveLateCheckout(
    @Param("reservationId") reservationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flexCheckService.approveLateCheckout(reservationId, user.id);
  }

  @Post("late-checkout/:reservationId/deny")
  denyLateCheckout(@Param("reservationId") reservationId: string) {
    return this.flexCheckService.denyLateCheckout(reservationId);
  }

  // ==================== PENDING REQUESTS ====================

  @Get("pending")
  getPendingRequests(@Query("campgroundId") campgroundId: string) {
    return this.flexCheckService.getPendingRequests(campgroundId);
  }
}
