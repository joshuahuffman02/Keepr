import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // Utility meters and reads
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("campgrounds/:campgroundId/meters")
  createMeter(
    @Param("campgroundId") campgroundId: string,
    @Body() body: { siteId: string; type: string; serialNumber?: string; ratePlanId?: string; billingMode?: string; billTo?: string; multiplier?: number; autoEmail?: boolean }
  ) {
    return this.billing.createMeter(campgroundId, body.siteId, body.type, body.serialNumber, body.ratePlanId, {
      billingMode: body.billingMode,
      billTo: body.billTo,
      multiplier: body.multiplier,
      autoEmail: body.autoEmail
    });
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/utility-rate-plans")
  listRatePlans(@Param("campgroundId") campgroundId: string) {
    return this.billing.listRatePlans(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/meters")
  listMeters(@Param("campgroundId") campgroundId: string) {
    return this.billing.listMeters(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("meters/:meterId/reads")
  addRead(
    @Param("meterId") meterId: string,
    @Body() body: { readingValue: number; readAt: string; readBy?: string; note?: string; source?: string }
  ) {
    return this.billing.addMeterRead(meterId, Number(body.readingValue), new Date(body.readAt), body.readBy, body.note, body.source);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("meters/import")
  importReads(
    @Body()
    body: { campgroundId: string; reads: Array<{ meterId: string; readingValue: number; readAt: string; note?: string; readBy?: string; source?: string }> }
  ) {
    const reads = body.reads.map((r) => ({
      ...r,
      readAt: new Date(r.readAt),
      readingValue: Number(r.readingValue)
    }));
    return this.billing.importMeterReads(body.campgroundId, reads);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("meters/:meterId/reads")
  listReads(
    @Param("meterId") meterId: string,
    @Query("start") start?: string,
    @Query("end") end?: string
  ) {
    return this.billing.listReads(meterId, start ? new Date(start) : undefined, end ? new Date(end) : undefined);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Patch("meters/:meterId")
  updateMeter(
    @Param("meterId") meterId: string,
    @Body()
    body: {
      ratePlanId?: string | null;
      billingMode?: string;
      billTo?: string;
      multiplier?: number;
      autoEmail?: boolean;
      active?: boolean;
      serialNumber?: string | null;
    }
  ) {
    return this.billing.updateMeter(meterId, body);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("meters/:meterId/bill")
  billMeter(@Param("meterId") meterId: string) {
    return this.billing.billMeterNow(meterId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("site-classes/:siteClassId/meters/seed")
  seedMeters(@Param("siteClassId") siteClassId: string) {
    return this.billing.seedMetersForSiteClass(siteClassId);
  }

  // Billing cycles and invoices
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("reservations/:reservationId/billing-cycles")
  createCycle(
    @Param("reservationId") reservationId: string,
    @Body() body: { cadence: string; periodStart: string; periodEnd: string }
  ) {
    return this.billing.createBillingCycle(reservationId, body.cadence, new Date(body.periodStart), new Date(body.periodEnd));
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("billing/cycles/:cycleId/generate")
  generateInvoice(@Param("cycleId") cycleId: string) {
    return this.billing.generateInvoiceForCycle(cycleId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("reservations/:reservationId/invoices")
  listInvoices(@Param("reservationId") reservationId: string) {
    return this.billing.listInvoicesByReservation(reservationId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("invoices/:invoiceId")
  getInvoice(@Param("invoiceId") invoiceId: string) {
    return this.billing.getInvoice(invoiceId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("invoices/:invoiceId/writeoff")
  writeOff(
    @Param("invoiceId") invoiceId: string,
    @Body() body: { reason: string; actorId?: string }
  ) {
    return this.billing.writeOffInvoice(invoiceId, body.reason, body.actorId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("invoices/:invoiceId/override-line/:lineId")
  overrideLine(
    @Param("invoiceId") invoiceId: string,
    @Param("lineId") lineId: string,
    @Body() body: { amountCents: number; note: string; actorId?: string }
  ) {
    return this.billing.overrideInvoiceLine(invoiceId, lineId, Number(body.amountCents), body.note, body.actorId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("billing/late-fees/run")
  runLateFees() {
    return this.billing.applyLateFeesForOverdue();
  }
}
