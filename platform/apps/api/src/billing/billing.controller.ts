import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/guards";
import { Roles, RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { UserRole } from "@prisma/client";

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  private requireCampgroundId(req: any, fallback?: string): string {
    const campgroundId = fallback || req?.campgroundId || req?.headers?.["x-campground-id"];
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  private assertCampgroundAccess(campgroundId: string, user: any): void {
    const isPlatformStaff = user?.platformRole === "platform_admin" ||
                            user?.platformRole === "platform_superadmin" ||
                            user?.platformRole === "support_agent";
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  // Utility meters and reads
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("campgrounds/:campgroundId/meters")
  createMeter(
    @Param("campgroundId") campgroundId: string,
    @Body() body: { siteId: string; type: string; serialNumber?: string; ratePlanId?: string; billingMode?: string; billTo?: string; multiplier?: number; autoEmail?: boolean },
    @Req() req: Request
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.billing.createMeter(campgroundId, body.siteId, body.type, body.serialNumber, body.ratePlanId, {
      billingMode: body.billingMode,
      billTo: body.billTo,
      multiplier: body.multiplier,
      autoEmail: body.autoEmail
    });
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/utility-rate-plans")
  listRatePlans(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.billing.listRatePlans(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/meters")
  listMeters(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.billing.listMeters(campgroundId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("meters/:meterId/reads")
  addRead(
    @Param("meterId") meterId: string,
    @Body() body: { readingValue: number; readAt: string; readBy?: string; note?: string; source?: string },
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.addMeterRead(
      requiredCampgroundId,
      meterId,
      Number(body.readingValue),
      new Date(body.readAt),
      body.readBy,
      body.note,
      body.source
    );
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("meters/import")
  importReads(
    @Body()
    body: { campgroundId: string; reads: Array<{ meterId: string; readingValue: number; readAt: string; note?: string; readBy?: string; source?: string }> },
    @Req() req: Request
  ) {
    this.assertCampgroundAccess(body.campgroundId, req.user);
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
    @Query("end") end?: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.listReads(
      requiredCampgroundId,
      meterId,
      start ? new Date(start) : undefined,
      end ? new Date(end) : undefined
    );
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
    },
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.updateMeter(requiredCampgroundId, meterId, body);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("meters/:meterId/bill")
  billMeter(
    @Param("meterId") meterId: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.billMeterNow(requiredCampgroundId, meterId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("site-classes/:siteClassId/meters/seed")
  seedMeters(
    @Param("siteClassId") siteClassId: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.seedMetersForSiteClass(requiredCampgroundId, siteClassId);
  }

  // Billing cycles and invoices
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("reservations/:reservationId/billing-cycles")
  createCycle(
    @Param("reservationId") reservationId: string,
    @Body() body: { cadence: string; periodStart: string; periodEnd: string },
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.createBillingCycle(
      requiredCampgroundId,
      reservationId,
      body.cadence,
      new Date(body.periodStart),
      new Date(body.periodEnd)
    );
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("billing/cycles/:cycleId/generate")
  generateInvoice(
    @Param("cycleId") cycleId: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.generateInvoiceForCycle(requiredCampgroundId, cycleId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("reservations/:reservationId/invoices")
  listInvoices(
    @Param("reservationId") reservationId: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.listInvoicesByReservation(requiredCampgroundId, reservationId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("invoices/:invoiceId")
  getInvoice(
    @Param("invoiceId") invoiceId: string,
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.getInvoice(requiredCampgroundId, invoiceId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("invoices/:invoiceId/writeoff")
  writeOff(
    @Param("invoiceId") invoiceId: string,
    @Body() body: { reason: string; actorId?: string },
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.writeOffInvoice(requiredCampgroundId, invoiceId, body.reason, body.actorId);
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("invoices/:invoiceId/override-line/:lineId")
  overrideLine(
    @Param("invoiceId") invoiceId: string,
    @Param("lineId") lineId: string,
    @Body() body: { amountCents: number; note: string; actorId?: string },
    @Query("campgroundId") campgroundId: string | undefined,
    @Req() req: Request
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.overrideInvoiceLine(
      requiredCampgroundId,
      invoiceId,
      lineId,
      Number(body.amountCents),
      body.note,
      body.actorId
    );
  }

  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("billing/late-fees/run")
  runLateFees(@Query("campgroundId") campgroundId: string | undefined, @Req() req: Request) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.billing.applyLateFeesForOverdue(requiredCampgroundId);
  }
}
