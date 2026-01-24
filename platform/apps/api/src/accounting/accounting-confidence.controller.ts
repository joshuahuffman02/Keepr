import { Controller, Get, Post, Param, Query, Body, UseGuards } from "@nestjs/common";
import { AccountingConfidenceService } from "./accounting-confidence.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";

@Controller("campgrounds/:campgroundId/accounting")
@UseGuards(JwtAuthGuard, ScopeGuard)
export class AccountingConfidenceController {
  constructor(private readonly confidenceService: AccountingConfidenceService) {}

  /**
   * Get overall accounting confidence score
   * Score 0-100 with breakdown of contributing factors
   */
  @Get("confidence")
  async getConfidenceScore(
    @Param("campgroundId") campgroundId: string,
    @Query("month") month?: string,
  ) {
    return this.confidenceService.getConfidenceScore(campgroundId, month);
  }

  /**
   * Get payout reconciliation status
   * Shows expected vs actual payouts for the period
   */
  @Get("reconciliation")
  async getReconciliation(
    @Param("campgroundId") campgroundId: string,
    @Query("month") month?: string,
  ) {
    return this.confidenceService.getPayoutReconciliation(campgroundId, month);
  }

  /**
   * Get month-end close status and checklist
   * Shows what needs to be done before closing the month
   */
  @Get("month-end/:month")
  async getMonthEndStatus(
    @Param("campgroundId") campgroundId: string,
    @Param("month") month: string,
  ) {
    return this.confidenceService.getMonthEndCloseStatus(campgroundId, month);
  }

  /**
   * Initiate month-end close process
   * Validates checklist and moves to review status
   */
  @Post("month-end/:month/initiate")
  async initiateMonthEndClose(
    @Param("campgroundId") campgroundId: string,
    @Param("month") month: string,
    @Body() body: { userId: string },
  ) {
    return this.confidenceService.initiateMonthEndClose(campgroundId, month, body.userId);
  }

  /**
   * Approve and finalize month-end close
   * Requires manager approval
   */
  @Post("month-end/:month/approve")
  async approveMonthEndClose(
    @Param("campgroundId") campgroundId: string,
    @Param("month") month: string,
    @Body() body: { userId: string },
  ) {
    return this.confidenceService.approveMonthEndClose(campgroundId, month, body.userId);
  }
}
