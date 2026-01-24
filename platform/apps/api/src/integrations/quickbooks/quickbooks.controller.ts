import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards, Res } from "@nestjs/common";
import { Response } from "express";
import { QuickBooksService } from "./quickbooks.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ScopeGuard } from "../../auth/guards/scope.guard";

@Controller("campgrounds/:campgroundId/integrations/quickbooks")
@UseGuards(JwtAuthGuard, ScopeGuard)
export class QuickBooksController {
  constructor(private readonly qbService: QuickBooksService) {}

  /**
   * Get QuickBooks connection status
   */
  @Get("status")
  async getStatus(@Param("campgroundId") campgroundId: string) {
    const isConnected = await this.qbService.isConnected(campgroundId);
    const syncStatus = await this.qbService.getSyncStatus(campgroundId);

    return {
      connected: isConnected,
      ...syncStatus,
    };
  }

  /**
   * Get OAuth authorization URL
   */
  @Get("authorize")
  async getAuthorizeUrl(
    @Param("campgroundId") campgroundId: string,
    @Query("redirect_uri") redirectUri: string,
  ) {
    const url = await this.qbService.getAuthorizationUrl(campgroundId, redirectUri);
    return { url };
  }

  /**
   * Handle OAuth callback (typically called by frontend after redirect)
   */
  @Post("callback")
  async handleCallback(
    @Param("campgroundId") campgroundId: string,
    @Body() body: { code: string; realmId: string },
  ) {
    return this.qbService.handleOAuthCallback(body.code, body.realmId, campgroundId);
  }

  /**
   * Disconnect QuickBooks integration
   */
  @Delete("disconnect")
  async disconnect(@Param("campgroundId") campgroundId: string) {
    return this.qbService.disconnect(campgroundId);
  }

  /**
   * Sync a specific reservation to QuickBooks
   */
  @Post("sync/reservation/:reservationId")
  async syncReservation(
    @Param("campgroundId") campgroundId: string,
    @Param("reservationId") reservationId: string,
  ) {
    return this.qbService.syncReservationToInvoice(campgroundId, reservationId);
  }

  /**
   * Sync a specific payment to QuickBooks
   */
  @Post("sync/payment/:paymentId")
  async syncPayment(
    @Param("campgroundId") campgroundId: string,
    @Param("paymentId") paymentId: string,
  ) {
    return this.qbService.syncPayment(campgroundId, paymentId);
  }

  /**
   * Get sync history
   */
  @Get("sync-history")
  async getSyncHistory(
    @Param("campgroundId") campgroundId: string,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ) {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    return this.qbService.getSyncStatus(campgroundId, startDate, endDate);
  }
}
