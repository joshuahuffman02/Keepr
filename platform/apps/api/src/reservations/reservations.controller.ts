import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ReservationsService } from "./reservations.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { QuoteReservationDto } from "./dto/quote-reservation.dto";
import { JwtAuthGuard } from "../auth/guards";
import { ReservationImportExportService } from "./reservation-import-export.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly importExport: ReservationImportExportService
  ) { }

  @Get("campgrounds/:campgroundId/reservations")
  list(@Param("campgroundId") campgroundId: string) {
    return this.reservations.listByCampground(campgroundId);
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
  getById(@Param("id") id: string) {
    return this.reservations.findOne(id);
  }

  @Get("reservations/:id/calculate-deposit")
  calculateDeposit(@Param("id") id: string) {
    return this.reservations.calculateDeposit(id);
  }

  @Post("reservations")
  create(@Body() body: CreateReservationDto) {
    return this.reservations.create(body);
  }

  @Patch("reservations/:id")
  update(@Param("id") id: string, @Body() body: Partial<CreateReservationDto>) {
    return this.reservations.update(id, body);
  }

  @Patch("reservations/:id/group")
  updateGroup(
    @Param("id") id: string,
    @Body() body: { groupId: string | null; role?: "primary" | "member" | null }
  ) {
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
  pay(@Param("id") id: string, @Body() body: RecordPaymentDto) {
    return this.reservations.recordPayment(id, body.amountCents, { tenders: body.tenders });
  }

  @Post("reservations/:id/refunds")
  refund(@Param("id") id: string, @Body() body: RefundPaymentDto) {
    return this.reservations.refundPayment(id, body.amountCents);
  }

  @Delete("reservations/:id")
  remove(@Param("id") id: string) {
    return this.reservations.remove(id);
  }

  @Post("reservations/:id/kiosk-checkin")
  kioskCheckIn(
    @Param("id") id: string,
    @Body() body: { upsellTotalCents: number; override?: boolean; overrideReason?: string; actorId?: string | null }
  ) {
    return this.reservations.kioskCheckIn(id, body.upsellTotalCents || 0, {
      override: body.override,
      overrideReason: body.overrideReason,
      actorId: body.actorId ?? null
    });
  }

  @Get("campgrounds/:campgroundId/matches")
  getMatches(
    @Param("campgroundId") campgroundId: string,
    @Query("guestId") guestId: string
  ) {
    return this.reservations.getMatchedSites(campgroundId, guestId);
  }
}
