import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ReservationsService } from "./reservations.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { QuoteReservationDto } from "./dto/quote-reservation.dto";
import { JwtAuthGuard } from "../auth/guards";
import { ReservationImportExportService } from "./reservation-import-export.service";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly importExport: ReservationImportExportService,
    private readonly prisma: PrismaService
  ) { }

  /**
   * Verify the authenticated user has access to the reservation's campground.
   * Prevents IDOR attacks by ensuring users can only access reservations
   * belonging to campgrounds they are members of.
   */
  private async assertReservationAccess(reservationId: string, user: any): Promise<void> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { campgroundId: true }
    });

    if (!reservation) {
      return; // Let the service handle "not found" errors
    }

    const userCampgroundIds = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
    if (!userCampgroundIds.includes(reservation.campgroundId)) {
      throw new ForbiddenException("You do not have access to this reservation");
    }
  }

  @Get("campgrounds/:campgroundId/reservations")
  list(
    @Param("campgroundId") campgroundId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("status") status?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string
  ) {
    return this.reservations.listByCampground(campgroundId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined
    });
  }

  @Get("campgrounds/:campgroundId/reservations/import/schema")
  importSchema() {
    return this.importExport.importSchema();
  }

  @Post("campgrounds/:campgroundId/reservations/import")
  async importReservations(
    @Param("campgroundId") campgroundId: string,
    @Body() body: { format?: "csv" | "json"; payload: string | any[]; dryRun?: boolean; idempotencyKey?: string; filename?: string },
    @Req() req: any
  ) {
    const format = body.format ?? "json";
    return this.importExport.startImport({
      campgroundId,
      format,
      payload: body.payload,
      dryRun: body.dryRun ?? false,
      idempotencyKey: body.idempotencyKey ?? (req?.headers?.["idempotency-key"] as string | undefined),
      filename: body.filename,
      requestedById: req?.user?.id ?? null
    });
  }

  @Get("campgrounds/:campgroundId/reservations/import/:jobId")
  importStatus(@Param("campgroundId") campgroundId: string, @Param("jobId") jobId: string) {
    return this.importExport.getImportStatus(campgroundId, jobId);
  }

  @Get("campgrounds/:campgroundId/reservations/export")
  async exportReservations(
    @Param("campgroundId") campgroundId: string,
    @Query("format") format?: "json" | "csv",
    @Query("pageSize") pageSize?: string,
    @Query("paginationToken") paginationToken?: string,
    @Query("includePII") includePII?: string,
    @Query("status") status?: string,
    @Query("source") source?: string
  ) {
    const filters: Record<string, any> = {};
    if (status) filters.status = status;
    if (source) filters.source = source;
    return this.importExport.exportReservations({
      campgroundId,
      format: format ?? "json",
      pageSize: pageSize ? Number(pageSize) : undefined,
      paginationToken: paginationToken ?? undefined,
      includePII: includePII === "true",
      filters
    });
  }

  @Get("campgrounds/:campgroundId/reservations/export/jobs")
  listReservationExports(@Param("campgroundId") campgroundId: string, @Query("limit") limit?: string) {
    return this.importExport.listExports(campgroundId, limit ? Number(limit) : 10);
  }

  @Post("campgrounds/:campgroundId/reservations/export/jobs")
  queueReservationExport(
    @Param("campgroundId") campgroundId: string,
    @Body() body: { format?: "json" | "csv"; filters?: Record<string, any> },
    @Req() req: any
  ) {
    return this.importExport.queueExport(campgroundId, body.filters, body.format ?? "json", req?.user?.id ?? null);
  }

  @Get("campgrounds/:campgroundId/availability")
  availability(
    @Param("campgroundId") campgroundId: string,
    @Query("arrivalDate") arrivalDate: string,
    @Query("departureDate") departureDate: string,
    @Query("rigType") rigType?: string,
    @Query("rigLength") rigLength?: string
  ) {
    return this.reservations.searchAvailability(campgroundId, arrivalDate, departureDate, rigType, rigLength);
  }

  @Get("campgrounds/:campgroundId/sites/status")
  sitesWithStatus(
    @Param("campgroundId") campgroundId: string,
    @Query("arrivalDate") arrivalDate?: string,
    @Query("departureDate") departureDate?: string
  ) {
    return this.reservations.getSitesWithStatus(campgroundId, arrivalDate, departureDate);
  }

  @Get("campgrounds/:campgroundId/reservations/overlaps")
  overlaps(@Param("campgroundId") campgroundId: string) {
    return this.reservations.listOverlaps(campgroundId);
  }

  @Get("campgrounds/:campgroundId/reservations/overlap-check")
  overlapCheck(
    @Param("campgroundId") campgroundId: string,
    @Query("siteId") siteId: string,
    @Query("arrivalDate") arrivalDate: string,
    @Query("departureDate") departureDate: string,
    @Query("ignoreId") ignoreId?: string
  ) {
    return this.reservations.overlapCheck(campgroundId, siteId, arrivalDate, departureDate, ignoreId);
  }

  @Get("reservations/:id")
  async getById(@Param("id") id: string, @Req() req: any) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.findOne(id);
  }

  @Get("reservations/:id/calculate-deposit")
  async calculateDeposit(@Param("id") id: string, @Req() req: any) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.calculateDeposit(id);
  }

  @Post("reservations")
  create(@Body() body: CreateReservationDto) {
    return this.reservations.create(body);
  }

  @Patch("reservations/:id")
  async update(@Param("id") id: string, @Body() body: Partial<CreateReservationDto>, @Req() req: any) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.update(id, body);
  }

  @Patch("reservations/:id/group")
  async updateGroup(
    @Param("id") id: string,
    @Body() body: { groupId: string | null; role?: "primary" | "member" | null },
    @Req() req: any
  ) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.updateGroupAssignment(id, body);
  }

  @Post("campgrounds/:campgroundId/quote")
  quote(@Param("campgroundId") campgroundId: string, @Body() body: QuoteReservationDto) {
    return this.reservations.quote(campgroundId, body.siteId, body.arrivalDate, body.departureDate);
  }

  @Get("campgrounds/:campgroundId/aging")
  aging(@Param("campgroundId") campgroundId: string) {
    return this.reservations.agingBuckets(campgroundId);
  }

  @Post("reservations/:id/payments")
  async pay(@Param("id") id: string, @Body() body: RecordPaymentDto, @Req() req: any) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.recordPayment(id, body.amountCents, { tenders: body.tenders });
  }

  @Post("reservations/:id/refunds")
  async refund(@Param("id") id: string, @Body() body: RefundPaymentDto, @Req() req: any) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.refundPayment(id, body.amountCents, {
      destination: body.destination,
      reason: body.reason
    });
  }

  @Delete("reservations/:id")
  async remove(@Param("id") id: string, @Req() req: any) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.remove(id);
  }

  @Post("reservations/:id/kiosk-checkin")
  async kioskCheckIn(
    @Param("id") id: string,
    @Body() body: { upsellTotalCents: number; override?: boolean; overrideReason?: string; actorId?: string | null },
    @Req() req: any
  ) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.kioskCheckIn(id, body.upsellTotalCents || 0, {
      override: body.override,
      overrideReason: body.overrideReason,
      actorId: body.actorId ?? null
    });
  }

  /**
   * Check in a guest (staff dashboard)
   * Allows checking in with balance due, but returns a warning
   */
  @Post("reservations/:id/check-in")
  async checkIn(
    @Param("id") id: string,
    @Body() body: { force?: boolean } = {},
    @Req() req: any
  ) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.staffCheckIn(id, {
      force: body.force ?? false,
      actorId: req?.user?.id ?? null
    });
  }

  /**
   * Check out a guest (staff dashboard)
   */
  @Post("reservations/:id/check-out")
  async checkOut(
    @Param("id") id: string,
    @Body() body: { force?: boolean } = {},
    @Req() req: any
  ) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.staffCheckOut(id, {
      force: body.force ?? false,
      actorId: req?.user?.id ?? null
    });
  }

  @Get("campgrounds/:campgroundId/matches")
  getMatches(
    @Param("campgroundId") campgroundId: string,
    @Query("guestId") guestId: string
  ) {
    return this.reservations.getMatchedSites(campgroundId, guestId);
  }

  @Post("reservations/:id/split")
  async splitReservation(
    @Param("id") id: string,
    @Body() body: {
      segments: Array<{ siteId: string; startDate: string; endDate: string }>;
      sendNotification?: boolean;
    },
    @Req() req: any
  ) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.splitReservation(id, body.segments, {
      actorId: req?.user?.id ?? null,
      sendNotification: body.sendNotification ?? true
    });
  }

  @Get("reservations/:id/segments")
  async getSegments(@Param("id") id: string, @Req() req: any) {
    await this.assertReservationAccess(id, req.user);
    return this.reservations.getReservationSegments(id);
  }
}
