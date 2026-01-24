import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { BillingDashboardService } from "./billing-dashboard.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";

@Controller("campgrounds/:campgroundId/billing-dashboard")
@UseGuards(JwtAuthGuard, ScopeGuard)
export class BillingDashboardController {
  constructor(private readonly dashboardService: BillingDashboardService) {}

  /**
   * Get comprehensive billing summary for the current period
   * Shows revenue, platform fees, payment fees, and net earnings
   */
  @Get("summary")
  async getSummary(
    @Param("campgroundId") campgroundId: string,
    @Query("periodStart") periodStartStr?: string,
    @Query("periodEnd") periodEndStr?: string,
  ) {
    const periodStart = periodStartStr ? new Date(periodStartStr) : undefined;
    const periodEnd = periodEndStr ? new Date(periodEndStr) : undefined;
    return this.dashboardService.getBillingSummary(campgroundId, periodStart, periodEnd);
  }

  /**
   * Get revenue breakdown by channel, site type, and month
   * Useful for understanding where bookings come from
   */
  @Get("revenue-breakdown")
  async getRevenueBreakdown(
    @Param("campgroundId") campgroundId: string,
    @Query("periodStart") periodStartStr?: string,
    @Query("periodEnd") periodEndStr?: string,
  ) {
    const periodStart = periodStartStr ? new Date(periodStartStr) : undefined;
    const periodEnd = periodEndStr ? new Date(periodEndStr) : undefined;
    return this.dashboardService.getRevenueBreakdown(campgroundId, periodStart, periodEnd);
  }

  /**
   * Get platform fee invoice history
   * Shows past billing periods and charges
   */
  @Get("fee-invoices")
  async getFeeInvoices(
    @Param("campgroundId") campgroundId: string,
    @Query("limit") limitStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 12;
    return this.dashboardService.getFeeInvoiceHistory(campgroundId, limit);
  }

  /**
   * Get payout history from Stripe
   * Shows bank deposits received
   */
  @Get("payouts")
  async getPayouts(@Param("campgroundId") campgroundId: string, @Query("limit") limitStr?: string) {
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    return this.dashboardService.getPayoutHistory(campgroundId, limit);
  }

  /**
   * Get detailed fee transparency for a specific period
   * Shows every fee charged with references to source transactions
   */
  @Get("fee-transparency")
  async getFeeTransparency(
    @Param("campgroundId") campgroundId: string,
    @Query("periodStart") periodStartStr: string,
    @Query("periodEnd") periodEndStr: string,
  ) {
    const periodStart = new Date(periodStartStr);
    const periodEnd = new Date(periodEndStr);
    return this.dashboardService.getFeeTransparency(campgroundId, periodStart, periodEnd);
  }
}
