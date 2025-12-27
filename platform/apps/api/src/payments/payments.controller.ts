import { Body, Controller, Get, Headers, Param, Post, RawBodyRequest, Req, BadRequestException, UseGuards, NotFoundException, Query, Res, Logger, ForbiddenException, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import Stripe from "stripe";
import { Response } from "express";
import { ReservationsService } from "../reservations/reservations.service";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { StripeService } from "./stripe.service";
import { Request } from 'express';
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";
import { UserRole, IdempotencyStatus } from "@prisma/client";
type BillingPlan = "ota_only" | "standard" | "enterprise";
type PaymentFeeMode = "absorb" | "pass_through";
type DisputeStatus = "warning_needs_response" | "warning_under_review" | "needs_response" | "under_review" | "charge_refunded" | "won" | "lost";
type PayoutStatus = "pending" | "in_transit" | "paid" | "failed" | "canceled";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsReconciliationService } from "./reconciliation.service";
import { IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";
import { IdempotencyService } from "./idempotency.service";
import { GatewayConfigService } from "./gateway-config.service";

// DTO for public payment intent creation
class CreatePublicPaymentIntentDto {
  amountCents!: number;
  currency?: string;
  reservationId!: string;
  guestEmail?: string;
  captureMethod?: 'automatic' | 'manual';
}

class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  applicationFeeFlatCents?: number;

  @IsOptional()
  billingPlan?: BillingPlan;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  perBookingFeeCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  monthlyFeeCents?: number;

  @IsOptional()
  feeMode?: PaymentFeeMode;
}

// DTO for refund request
class RefundPaymentIntentDto {
  amountCents?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

// DTO for capture request
class CapturePaymentIntentDto {
  amountCents?: number;
}

@Controller()
export class PaymentsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly recon: PaymentsReconciliationService,
    private readonly idempotency: IdempotencyService,
    private readonly gatewayConfigService: GatewayConfigService
  ) { }

  private readonly logger = new Logger(PaymentsController.name);
  private readonly capabilitiesTtlMs = Number(process.env.STRIPE_CAPABILITIES_TTL_MS ?? 6 * 60 * 60 * 1000); // default 6h

  private async refreshCapabilitiesIfNeeded(params: {
    campgroundId: string;
    stripeAccountId?: string | null;
    currentCapabilities?: Record<string, string> | null;
    fetchedAt?: Date | null;
    force?: boolean;
  }) {
    const { campgroundId, stripeAccountId, currentCapabilities, fetchedAt, force } = params;
    if (!stripeAccountId) {
      return { capabilities: null, fetchedAt: null, refreshed: false, skipped: true };
    }

    const ageMs = fetchedAt ? Date.now() - new Date(fetchedAt).getTime() : Infinity;
    if (!force && ageMs < this.capabilitiesTtlMs) {
      return { capabilities: currentCapabilities ?? null, fetchedAt: fetchedAt ?? null, refreshed: false, skipped: false };
    }

    try {
      const capabilities = await this.stripeService.retrieveAccountCapabilities(stripeAccountId);
      if (!capabilities) {
        // Stripe not configured or mock disabled; avoid failing the request.
        return { capabilities: currentCapabilities ?? null, fetchedAt: fetchedAt ?? null, refreshed: false, skipped: true };
      }

      const updated = await this.prisma.campground.update({
        where: { id: campgroundId },
        data: {
          stripeCapabilities: capabilities as any,
          stripeCapabilitiesFetchedAt: new Date()
        },
        select: {
          stripeCapabilities: true as any,
          stripeCapabilitiesFetchedAt: true as any
        }
      } as any);

      return {
        capabilities: (updated as any).stripeCapabilities as Record<string, string> | null,
        fetchedAt: (updated as any).stripeCapabilitiesFetchedAt as Date | null,
        refreshed: true,
        skipped: false
      };
    } catch (err: any) {
      this.logger.warn(`Capability refresh failed for campground ${campgroundId}: ${err?.message || err}`);
      return { capabilities: currentCapabilities ?? null, fetchedAt: fetchedAt ?? null, refreshed: false, skipped: false, error: err };
    }
  }

  private async getPaymentContext(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        campgroundId: true,
        balanceAmount: true,
        totalAmount: true,
        paidAmount: true
      }
    });
    if (!reservation) {
      throw new BadRequestException("Reservation not found for payment");
    }
    const gatewayConfig = await this.gatewayConfigService.getConfig(reservation.campgroundId);
    if (!gatewayConfig) {
      throw new BadRequestException("Payment gateway configuration is missing for this campground.");
    }
    if (gatewayConfig.mode === "prod" && !gatewayConfig.hasProductionCredentials) {
      throw new BadRequestException("Payment gateway is in production mode but credentials are not configured.");
    }
    if (gatewayConfig.gateway !== "stripe") {
      throw new BadRequestException(`Gateway ${gatewayConfig.gateway} is not yet supported.`);
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: reservation.campgroundId },
      select: {
        // Note: prisma types may lag schema changes; cast to any for new fields.
        stripeAccountId: true as any,
        applicationFeeFlatCents: true as any,
        billingPlan: true,
        perBookingFeeCents: true as any,
        monthlyFeeCents: true as any,
        feeMode: true,
        name: true,
        stripeCapabilities: true as any,
        stripeCapabilitiesFetchedAt: true as any
      } as any
    });
    const stripeAccountId = (campground as any)?.stripeAccountId as string | undefined;
    if (!stripeAccountId) {
      throw new BadRequestException("Campground is not connected to Stripe. Please complete onboarding.");
    }
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException("Stripe keys are not configured for the platform. Set STRIPE_SECRET_KEY to enable payments.");
    }
    const plan = (campground as any)?.billingPlan as BillingPlan | undefined;
    const planDefaultFee = plan === "standard" ? 200 : plan === "enterprise" ? 100 : 300;
    const applicationFeeCents =
      (campground as any)?.perBookingFeeCents ??
      (campground as any)?.applicationFeeFlatCents ??
      Number(process.env.PAYMENT_PLATFORM_FEE_CENTS ?? planDefaultFee);
    const feeMode = (gatewayConfig?.feeMode as PaymentFeeMode | undefined) ?? ((campground as any)?.feeMode as PaymentFeeMode | undefined) ?? "absorb";
    const gatewayFeePercentBasisPoints = gatewayConfig?.effectiveFee?.percentBasisPoints ?? 0;
    const gatewayFeeFlatCents = gatewayConfig?.effectiveFee?.flatFeeCents ?? 0;
    const refreshed = await this.refreshCapabilitiesIfNeeded({
      campgroundId: reservation.campgroundId,
      stripeAccountId,
      currentCapabilities: (campground as any)?.stripeCapabilities as any,
      fetchedAt: (campground as any)?.stripeCapabilitiesFetchedAt as any
    });
    return {
      stripeAccountId,
      applicationFeeCents,
      campgroundId: reservation.campgroundId,
      feeMode,
      gatewayConfig,
      gatewayFeePercentBasisPoints,
      gatewayFeeFlatCents,
      reservation,
      capabilities: refreshed.capabilities ?? ((campground as any)?.stripeCapabilities as Record<string, string> | undefined),
      capabilitiesFetchedAt: refreshed.fetchedAt ?? ((campground as any)?.stripeCapabilitiesFetchedAt as Date | undefined)
    };
  }

  private getPaymentMethodTypes(capabilities?: Record<string, string> | undefined | null) {
    const achActive = capabilities?.us_bank_account_ach_payments === "active";
    const cardActive = capabilities?.card_payments === "active";
    const types: string[] = [];
    if (cardActive) types.push("card");
    if (achActive) types.push("us_bank_account");
    return types.length ? types : ["card"];
  }

  private calculateGatewayFee(amountCents: number, percentBasisPoints: number, flatFeeCents: number) {
    const percentPortion = Math.round((amountCents * (percentBasisPoints ?? 0)) / 10000);
    const flatPortion = flatFeeCents ?? 0;
    return Math.max(0, percentPortion + flatPortion);
  }

  private computeChargeAmounts(opts: {
    reservation: { balanceAmount?: number | null; totalAmount?: number | null; paidAmount?: number | null };
    platformFeeMode: PaymentFeeMode | string;
    applicationFeeCents: number;
    gatewayFeeMode: PaymentFeeMode | string;
    gatewayFeePercentBasisPoints: number;
    gatewayFeeFlatCents: number;
    requestedAmountCents?: number;
  }) {
    const baseDue =
      opts.reservation.balanceAmount ??
      Math.max(0, (opts.reservation.totalAmount ?? 0) - (opts.reservation.paidAmount ?? 0));
    const platformPassThroughFeeCents = opts.platformFeeMode === "pass_through" ? opts.applicationFeeCents : 0;
    const gatewayPassThroughFeeCents =
      opts.gatewayFeeMode === "pass_through"
        ? this.calculateGatewayFee(baseDue, opts.gatewayFeePercentBasisPoints, opts.gatewayFeeFlatCents)
        : 0;
    const maxCharge = Math.max(0, baseDue + platformPassThroughFeeCents + gatewayPassThroughFeeCents);
    const desired = opts.requestedAmountCents ?? maxCharge;
    const amountCents = Math.min(Math.max(desired, 0), maxCharge);
    return { amountCents, platformPassThroughFeeCents, gatewayPassThroughFeeCents, baseDue };
  }

  private buildReceiptLinesFromIntent(intent: any) {
    const toNumber = (v: any) => (v === undefined || v === null || Number.isNaN(Number(v)) ? 0 : Number(v));
    const baseAmount = toNumber(intent?.metadata?.baseAmountCents ?? intent?.amount_received ?? intent?.amount);
    const platformFee = toNumber(intent?.metadata?.platformPassThroughFeeCents ?? intent?.metadata?.applicationFeeCents);
    const gatewayFee = toNumber(intent?.metadata?.gatewayPassThroughFeeCents);
    const taxCents = toNumber((intent?.metadata as any)?.taxCents);

    const lineItems = baseAmount > 0 ? [{ label: "Reservation charge", amountCents: baseAmount }] : [];
    if (platformFee > 0) lineItems.push({ label: "Platform fee", amountCents: platformFee });
    if (gatewayFee > 0) lineItems.push({ label: "Gateway fee", amountCents: gatewayFee });

    const feeCents = platformFee + gatewayFee;
    return {
      lineItems,
      taxCents: taxCents || undefined,
      feeCents: feeCents > 0 ? feeCents : undefined,
      totalCents: toNumber(intent?.amount_received ?? intent?.amount)
    };
  }

  private ensureCampgroundMembership(user: any, campgroundId: string | null | undefined) {
    const actorCampgrounds = user?.memberships?.map((m: any) => m.campgroundId) ?? [];
    if (!campgroundId || !actorCampgrounds.includes(campgroundId)) {
      throw new ForbiddenException("Forbidden by campground scope");
    }
  }

  /**
   * Create a payment intent (staff-only, requires authentication)
   * Accepts Idempotency-Key header for safe retries
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("payments/intents")
  async createIntent(
    @Body() body: CreatePaymentIntentDto,
    @Req() req: any,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    const currency = (body.currency || "usd").toLowerCase();

    const ctx = await this.getPaymentContext(body.reservationId);
    this.ensureCampgroundMembership(req?.user, ctx.campgroundId);
    const {
      stripeAccountId,
      applicationFeeCents,
      feeMode,
      reservation,
      campgroundId,
      capabilities,
      gatewayConfig,
      gatewayFeePercentBasisPoints,
      gatewayFeeFlatCents
    } = ctx;
    const { amountCents, platformPassThroughFeeCents, gatewayPassThroughFeeCents, baseDue } = this.computeChargeAmounts({
      reservation,
      platformFeeMode: feeMode,
      applicationFeeCents,
      gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
      gatewayFeePercentBasisPoints,
      gatewayFeeFlatCents,
      requestedAmountCents: body.amountCents
    });
    const feeBreakdown = {
      platformFeeMode: feeMode,
      platformPassThroughFeeCents,
      gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
      gatewayPassThroughFeeCents,
      gatewayPercentBasisPoints: gatewayFeePercentBasisPoints,
      gatewayFlatFeeCents: gatewayFeeFlatCents,
      baseAmountCents: baseDue
    };

    const threeDsPolicy = this.buildThreeDsPolicy(currency, gatewayConfig);

    // Check idempotency if key provided
    if (idempotencyKey) {
      const existing = await this.idempotency.start(idempotencyKey, body, campgroundId);
      if (existing.status === IdempotencyStatus.succeeded && existing.responseJson) {
        return existing.responseJson;
      }
      if (existing.status === IdempotencyStatus.inflight && existing.createdAt) {
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs < 60000) {
          throw new ConflictException("Request already in progress");
        }
      }
    }

    try {
      const intent = await this.stripeService.createPaymentIntent(
        amountCents,
        currency,
        {
          reservationId: body.reservationId,
          campgroundId,
          source: 'staff_checkout',
          feeMode,
          applicationFeeCents: String(applicationFeeCents),
          platformPassThroughFeeCents: String(platformPassThroughFeeCents),
          gatewayPassThroughFeeCents: String(gatewayPassThroughFeeCents),
          gatewayProvider: gatewayConfig?.gateway ?? "stripe",
          gatewayMode: gatewayConfig?.mode ?? "test",
          gatewayFeePercentBasisPoints: String(gatewayFeePercentBasisPoints),
          gatewayFeeFlatCents: String(gatewayFeeFlatCents),
          threeDsPolicy
        },
        stripeAccountId,
        applicationFeeCents,
        body.autoCapture === false ? 'manual' : 'automatic',
        this.getPaymentMethodTypes(capabilities),
        idempotencyKey,
        threeDsPolicy
      );

      const response = {
        id: intent.id,
        clientSecret: intent.client_secret,
        amountCents,
        currency,
        reservationId: body.reservationId,
        status: intent.status,
        fees: feeBreakdown,
        threeDsPolicy
      };

      if (idempotencyKey) {
        await this.idempotency.complete(idempotencyKey, response);
      }

      return response;
    } catch (err) {
      if (idempotencyKey) {
        await this.idempotency.fail(idempotencyKey);
      }
      throw err;
    }
  }

  /**
   * Create a setup intent for saving payment methods (staff)
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("payments/setup-intents")
  async createSetupIntent(@Body() body: { reservationId: string; customerEmail?: string }, @Req() req: any) {
    if (!body.reservationId) throw new BadRequestException("reservationId is required");
    const ctx = await this.getPaymentContext(body.reservationId);
    this.ensureCampgroundMembership(req?.user, ctx.campgroundId);
    const { stripeAccountId, capabilities } = ctx;
    const setupIntent = await this.stripeService.createSetupIntent(
      stripeAccountId,
      {
        reservationId: body.reservationId,
        source: 'staff_setup'
      },
      this.getPaymentMethodTypes(capabilities)
    );
    return { id: setupIntent.id, clientSecret: setupIntent.client_secret };
  }

  /**
   * Public setup intent for guests (save for future/ACH)
   */
  @Post("public/payments/setup-intents")
  async createPublicSetupIntent(@Body() body: { reservationId: string; guestEmail?: string }) {
    if (!body.reservationId) throw new BadRequestException("reservationId is required");
    const { stripeAccountId, capabilities } = await this.getPaymentContext(body.reservationId);
    const setupIntent = await this.stripeService.createSetupIntent(
      stripeAccountId,
      {
        reservationId: body.reservationId,
        source: 'public_setup',
        guestEmail: body.guestEmail || ''
      },
      this.getPaymentMethodTypes(capabilities)
    );
    return { id: setupIntent.id, clientSecret: setupIntent.client_secret };
  }

  /**
   * Create a payment intent for public/guest checkout (no authentication required)
   */
  @Post("public/payments/intents")
  async createPublicIntent(
    @Body() body: CreatePublicPaymentIntentDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    const currency = (body.currency || "usd").toLowerCase();
    const effectiveIdempotencyKey = idempotencyKey?.trim();

    if (!effectiveIdempotencyKey) {
      throw new BadRequestException({
        message: "Idempotency-Key header is required for public payments",
        retryAfterMs: 500,
        hint: "Send a unique Idempotency-Key per checkout attempt and reuse it when retrying."
      });
    }

    if (!body.reservationId) {
      throw new BadRequestException("reservationId is required for payment");
    }

    const {
      stripeAccountId,
      applicationFeeCents,
      feeMode,
      reservation,
      campgroundId,
      capabilities,
      gatewayConfig,
      gatewayFeePercentBasisPoints,
      gatewayFeeFlatCents
    } = await this.getPaymentContext(body.reservationId);
    const { amountCents, platformPassThroughFeeCents, gatewayPassThroughFeeCents, baseDue } = this.computeChargeAmounts({
      reservation,
      platformFeeMode: feeMode,
      applicationFeeCents,
      gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
      gatewayFeePercentBasisPoints,
      gatewayFeeFlatCents
    });
    const feeBreakdown = {
      platformFeeMode: feeMode,
      platformPassThroughFeeCents,
      gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
      gatewayPassThroughFeeCents,
      gatewayPercentBasisPoints: gatewayFeePercentBasisPoints,
      gatewayFlatFeeCents: gatewayFeeFlatCents,
      baseAmountCents: baseDue
    };

    const metadata: Record<string, string> = {
      reservationId: body.reservationId,
      campgroundId,
      source: 'public_checkout',
      feeMode,
      applicationFeeCents: String(applicationFeeCents),
      platformPassThroughFeeCents: String(platformPassThroughFeeCents),
      gatewayPassThroughFeeCents: String(gatewayPassThroughFeeCents),
      gatewayProvider: gatewayConfig?.gateway ?? "stripe",
      gatewayMode: gatewayConfig?.mode ?? "test",
      gatewayFeePercentBasisPoints: String(gatewayFeePercentBasisPoints),
      gatewayFeeFlatCents: String(gatewayFeeFlatCents)
    };
    if (body.guestEmail) {
      metadata.guestEmail = body.guestEmail;
    }
    metadata.idempotencyKey = effectiveIdempotencyKey;

    const threeDsPolicy = this.buildThreeDsPolicy(currency, gatewayConfig);

    const existing = await this.idempotency.start(effectiveIdempotencyKey, body, campgroundId, {
      endpoint: "public/payments/intents",
      requestBody: body,
      metadata: { reservationId: body.reservationId, threeDsPolicy },
      rateAction: "apply"
    });
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) {
      return existing.responseJson;
    }
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException({
        message: "Payment intent creation already in progress; retry with backoff",
        retryAfterMs: 500,
        reason: "inflight",
        idempotencyKey: effectiveIdempotencyKey
      });
    }

    try {
      const intent = await this.withGatewayFailover(async () =>
        this.stripeService.createPaymentIntent(
          amountCents,
          currency,
          metadata,
          stripeAccountId,
          applicationFeeCents,
          body.captureMethod === 'manual' ? 'manual' : 'automatic',
          this.getPaymentMethodTypes(capabilities),
          effectiveIdempotencyKey,
          threeDsPolicy
        )
      );

      const response = {
        id: intent.id,
        clientSecret: intent.client_secret,
        amountCents,
        currency,
        status: intent.status,
        fees: feeBreakdown,
        threeDsPolicy
      };

      await this.idempotency.complete(effectiveIdempotencyKey, response);

      return response;
    } catch (error) {
      await this.idempotency.fail(effectiveIdempotencyKey);
      throw error;
    }
  }

  /**
   * Confirm a public payment intent and update reservation status.
   * Called by frontend after Stripe.confirmPayment() completes successfully.
   */
  @Post("public/payments/intents/:id/confirm")
  async confirmPublicPaymentIntent(
    @Param("id") paymentIntentId: string,
    @Body() body: { reservationId: string },
    @Req() req: any
  ) {
    const idempotencyKey = req.headers["idempotency-key"] || `confirm-${paymentIntentId}-${Date.now()}`;

    // Check if already processed (idempotency)
    const existing = await this.idempotency.start(idempotencyKey, { paymentIntentId, ...body }, null, {
      endpoint: "public/payments/intents/confirm",
      requestBody: body,
      metadata: { paymentIntentId, reservationId: body.reservationId }
    });
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) {
      return existing.responseJson;
    }

    try {
      // Get reservation to find the connected account
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: body.reservationId },
        select: {
          id: true,
          status: true,
          totalCents: true,
          campground: {
            select: { id: true, stripeAccountId: true as any }
          }
        }
      });

      if (!reservation) {
        throw new BadRequestException("Reservation not found");
      }

      const stripeAccountId = (reservation.campground as any)?.stripeAccountId;

      // Retrieve payment intent from Stripe to verify status
      const intent = await this.stripeService.retrievePaymentIntent(paymentIntentId, stripeAccountId);

      if (intent.status !== "succeeded" && intent.status !== "requires_capture") {
        const response = {
          success: false,
          status: intent.status,
          message: `Payment not completed. Status: ${intent.status}`,
          reservationId: body.reservationId
        };
        await this.idempotency.complete(idempotencyKey, response);
        return response;
      }

      // Check if payment already recorded (prevent duplicates)
      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          stripePaymentIntentId: paymentIntentId,
          reservationId: body.reservationId
        }
      });

      if (existingPayment) {
        const response = {
          success: true,
          status: "already_recorded",
          paymentId: existingPayment.id,
          reservationId: body.reservationId,
          message: "Payment was already recorded"
        };
        await this.idempotency.complete(idempotencyKey, response);
        return response;
      }

      // Record the payment
      const amountCents = intent.amount;
      const payment = await this.prisma.payment.create({
        data: {
          reservationId: body.reservationId,
          campgroundId: reservation.campground.id,
          amountCents,
          currency: intent.currency?.toUpperCase() || "USD",
          status: intent.status === "succeeded" ? "completed" : "authorized",
          method: "card",
          stripePaymentIntentId: paymentIntentId,
          paidAt: new Date(),
          metadata: {
            source: "public_checkout_confirm",
            paymentIntentStatus: intent.status
          }
        }
      });

      // Update reservation status to confirmed
      await this.prisma.reservation.update({
        where: { id: body.reservationId },
        data: {
          status: "confirmed",
          confirmedAt: new Date()
        }
      });

      const response = {
        success: true,
        status: intent.status,
        paymentId: payment.id,
        reservationId: body.reservationId,
        amountCents,
        message: "Payment confirmed and reservation updated"
      };

      await this.idempotency.complete(idempotencyKey, response);
      return response;

    } catch (error) {
      await this.idempotency.fail(idempotencyKey);
      this.logger.error(`Payment confirmation failed for ${paymentIntentId}:`, error);
      throw error;
    }
  }

  /**
   * Create/connect a campground Stripe account (Express) and return onboarding link
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("campgrounds/:campgroundId/payments/connect")
  async connectCampground(@Param("campgroundId") campgroundId: string, @Req() req: any) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, email: true, stripeAccountId: true as any }
    } as any);
    if (!campground) throw new BadRequestException("Campground not found");

    let accountId = (campground as any)?.stripeAccountId as string | undefined;
    if (!accountId) {
      const account = await this.stripeService.createExpressAccount(campground.email || undefined, { campgroundId });
      accountId = account.id;
      await this.prisma.campground.update({
        where: { id: campgroundId },
        data: { stripeAccountId: accountId } as any
      });
    }

    const returnUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/dashboard/settings/payments?status=success` : "https://campreservweb-production.up.railway.app/dashboard/settings/payments?status=success";
    const refreshUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/dashboard/settings/payments?status=error` : "https://campreservweb-production.up.railway.app/dashboard/settings/payments?status=error";
    const link = await this.stripeService.createAccountOnboardingLink(accountId, returnUrl, refreshUrl);

    // Fetch capabilities after onboarding link creation
    try {
      const capabilities = await this.stripeService.retrieveAccountCapabilities(accountId);
      await this.prisma.campground.update({
        where: { id: campgroundId },
        data: {
          stripeCapabilities: capabilities as any,
          stripeCapabilitiesFetchedAt: new Date()
        }
      } as any);
    } catch { /* noop */ }

    return { accountId, onboardingUrl: link.url };
  }

  /**
   * Determine 3DS policy based on currency/region and gateway config.
   * EU/UK currencies default to "any" while others stay "automatic".
   */
  private buildThreeDsPolicy(currency: string, gatewayConfig?: any): "any" | "automatic" {
    const cur = currency?.toLowerCase?.() ?? "usd";
    const region = gatewayConfig?.additionalConfig?.region ?? gatewayConfig?.region ?? null;
    const euLikeCurrencies = ["eur", "gbp", "chf", "sek", "nok"];
    if (euLikeCurrencies.includes(cur) || region === "eu" || region === "uk") {
      return "any";
    }
    return "automatic";
  }

  /**
   * Stubbed secondary-gateway failover hook. Logs the failure and preserves the
   * original error so callers can backoff/retry or switch providers when wired.
   */
  private async withGatewayFailover<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger.error(`Primary gateway failed: ${(err as any)?.message ?? err}`, err as any);
      this.logger.warn("Secondary gateway failover stub invoked (no secondary configured)");
      const fallback = new ServiceUnavailableException({
        message: "Payment processor unavailable; retry with backoff or alternate gateway",
        reason: "gateway_unavailable"
      });
      (fallback as any).cause = err;
      throw fallback;
    }
  }

  /**
   * Update campground payment settings (e.g., application fee)
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("campgrounds/:campgroundId/payments/settings")
  async updatePaymentSettings(
    @Param("campgroundId") campgroundId: string,
    @Body() body: UpdatePaymentSettingsDto,
    @Req() req: any
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const campground = await this.prisma.campground.findUnique({ where: { id: campgroundId } });
    if (!campground) throw new BadRequestException("Campground not found");

    const updated = await this.prisma.campground.update({
      where: { id: campgroundId },
      data: {
        applicationFeeFlatCents: body.applicationFeeFlatCents ?? (campground as any).applicationFeeFlatCents,
        perBookingFeeCents: body.perBookingFeeCents ?? (campground as any).perBookingFeeCents,
        monthlyFeeCents: body.monthlyFeeCents ?? (campground as any).monthlyFeeCents,
        billingPlan: body.billingPlan ?? ((campground as any).billingPlan as BillingPlan),
        feeMode: body.feeMode ?? ((campground as any).feeMode as PaymentFeeMode)
      } as any,
      select: {
        stripeAccountId: true as any,
        applicationFeeFlatCents: true as any,
        perBookingFeeCents: true as any,
        monthlyFeeCents: true as any,
        billingPlan: true,
        feeMode: true,
        stripeCapabilities: true as any,
        stripeCapabilitiesFetchedAt: true as any
      }
    } as any);

    return updated;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("campgrounds/:campgroundId/payments/capabilities/refresh")
  async refreshCapabilities(@Param("campgroundId") campgroundId: string, @Req() req: any) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const cg = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        stripeAccountId: true as any,
        applicationFeeFlatCents: true as any,
        perBookingFeeCents: true as any,
        monthlyFeeCents: true as any,
        billingPlan: true,
        feeMode: true,
        stripeCapabilities: true as any,
        stripeCapabilitiesFetchedAt: true as any
      }
    } as any);

    if (!cg?.stripeAccountId) {
      return {
        ...cg,
        stripeCapabilities: null,
        stripeCapabilitiesFetchedAt: null,
        connected: false,
        refreshed: false
      };
    }

    const refreshed = await this.refreshCapabilitiesIfNeeded({
      campgroundId,
      stripeAccountId: cg.stripeAccountId,
      currentCapabilities: cg.stripeCapabilities as any,
      fetchedAt: cg.stripeCapabilitiesFetchedAt as any,
      force: true
    });

    return {
      ...cg,
      stripeCapabilities: refreshed.capabilities ?? cg.stripeCapabilities,
      stripeCapabilitiesFetchedAt: refreshed.fetchedAt ?? cg.stripeCapabilitiesFetchedAt,
      connected: true,
      refreshed: refreshed.refreshed
    };
  }

  /**
   * Get the status of a payment intent
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("payments/intents/:id")
  async getPaymentIntent(@Param("id") id: string, @Req() req: any) {
    try {
      const intent = await this.stripeService.retrievePaymentIntent(id);
      const campgroundId = (intent.metadata as any)?.campgroundId ?? null;
      this.ensureCampgroundMembership(req?.user, campgroundId);
      return {
        id: intent.id,
        status: intent.status,
        amountCents: intent.amount,
        amountReceivedCents: intent.amount_received,
        currency: intent.currency,
        metadata: intent.metadata,
        captureMethod: intent.capture_method,
        createdAt: new Date(intent.created * 1000).toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        throw new NotFoundException(`Payment intent ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Capture an authorized payment intent (for deposit/hold flows)
   * Accepts Idempotency-Key header for safe retries
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("payments/intents/:id/capture")
  async capturePaymentIntent(
    @Param("id") id: string,
    @Body() body: CapturePaymentIntentDto,
    @Req() req: any,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    try {
      const current = await this.stripeService.retrievePaymentIntent(id);
      const campgroundId = (current.metadata as any)?.campgroundId ?? null;
      this.ensureCampgroundMembership(req?.user, campgroundId);

      // Check idempotency if key provided
      if (idempotencyKey) {
        const existing = await this.idempotency.start(idempotencyKey, { id, ...body }, campgroundId);
        if (existing.status === IdempotencyStatus.succeeded && existing.responseJson) {
          return existing.responseJson;
        }
      }

      const intent = await this.stripeService.capturePaymentIntent(id, body.amountCents, idempotencyKey);

      // Record the payment in the reservation if applicable
      const receiptLines = this.buildReceiptLinesFromIntent(intent);
      const reservationId = intent.metadata?.reservationId;
      if (reservationId) {
        await this.reservations.recordPayment(reservationId, intent.amount_received, {
          transactionId: intent.id,
          paymentMethod: intent.payment_method_types?.[0] || 'card',
          source: intent.metadata?.source || 'staff_checkout',
          stripePaymentIntentId: intent.id,
          stripeChargeId: (intent as any)?.latest_charge as any,
          capturedAt: new Date(),
          lineItems: receiptLines.lineItems,
          taxCents: receiptLines.taxCents,
          feeCents: receiptLines.feeCents,
          totalCents: receiptLines.totalCents,
          receiptKind: "payment",
          tenders: [
            {
              method: intent.payment_method_types?.[0] || 'card',
              amountCents: intent.amount_received ?? intent.amount ?? 0,
              note: 'capture'
            }
          ]
        });
      }

      const response = {
        id: intent.id,
        status: intent.status,
        amountCents: intent.amount,
        amountReceivedCents: intent.amount_received,
        currency: intent.currency,
        lineItems: receiptLines.lineItems,
        taxCents: receiptLines.taxCents,
        feeCents: receiptLines.feeCents
      };

      if (idempotencyKey) {
        await this.idempotency.complete(idempotencyKey, response);
      }

      return response;
    } catch (error: any) {
      if (idempotencyKey) {
        await this.idempotency.fail(idempotencyKey);
      }
      if (error.code === 'resource_missing') {
        throw new NotFoundException(`Payment intent ${id} not found`);
      }
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Issue a refund for a payment intent
   * Accepts Idempotency-Key header for safe retries
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("payments/intents/:id/refund")
  async refundPaymentIntent(
    @Param("id") id: string,
    @Body() body: RefundPaymentIntentDto,
    @Req() req: any,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    try {
      const intent = await this.stripeService.retrievePaymentIntent(id);
      const campgroundId = (intent.metadata as any)?.campgroundId ?? null;
      this.ensureCampgroundMembership(req?.user, campgroundId);

      // Check idempotency if key provided
      if (idempotencyKey) {
        const existing = await this.idempotency.start(idempotencyKey, { id, ...body }, campgroundId);
        if (existing.status === IdempotencyStatus.succeeded && existing.responseJson) {
          return existing.responseJson;
        }
      }

      const refund = await this.stripeService.createRefund(id, body.amountCents, body.reason, idempotencyKey);
      const receiptLines = this.buildReceiptLinesFromIntent(intent);

      const reservationId = intent.metadata?.reservationId;
      if (reservationId) {
        await this.reservations.recordRefund(reservationId, refund.amount || 0, refund.id, {
          lineItems: receiptLines.lineItems,
          taxCents: receiptLines.taxCents,
          feeCents: receiptLines.feeCents,
          totalCents: refund.amount || receiptLines.totalCents,
          paymentMethod: intent.payment_method_types?.[0] || "card",
          source: intent.metadata?.source || "online",
          tenders: [
            {
              method: intent.payment_method_types?.[0] || "card",
              amountCents: refund.amount || 0,
              note: "stripe_refund"
            }
          ]
        });
      }

      const response = {
        id: refund.id,
        status: refund.status,
        amountCents: refund.amount,
        paymentIntentId: id,
        reason: refund.reason,
        lineItems: receiptLines.lineItems,
        taxCents: receiptLines.taxCents,
        feeCents: receiptLines.feeCents
      };

      if (idempotencyKey) {
        await this.idempotency.complete(idempotencyKey, response);
      }

      return response;
    } catch (error: any) {
      if (idempotencyKey) {
        await this.idempotency.fail(idempotencyKey);
      }
      if (error.code === 'resource_missing') {
        throw new NotFoundException(`Payment intent ${id} not found`);
      }
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Handle Stripe webhooks
   */
  @Post("payments/webhook")
  async handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers("stripe-signature") signature: string) {
    if (!signature) throw new BadRequestException("Missing stripe-signature header");

    let event;
    try {
      event = this.stripeService.constructEventFromPayload(signature, req.rawBody!);
    } catch (err: any) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as any;
      const reservationId = paymentIntent.metadata.reservationId;
      const amountCents = paymentIntent.amount;

      if (reservationId) {
        const toNumber = (v: any) => (v === undefined || v === null || Number.isNaN(Number(v)) ? 0 : Number(v));
        const lineItems = [
          { label: "Reservation charge", amountCents: toNumber(paymentIntent.metadata?.baseAmountCents ?? amountCents) }
        ];
        const platformFee = toNumber(paymentIntent.metadata?.platformPassThroughFeeCents ?? paymentIntent.metadata?.applicationFeeCents);
        const gatewayFee = toNumber(paymentIntent.metadata?.gatewayPassThroughFeeCents);
        if (platformFee > 0) lineItems.push({ label: "Platform fee", amountCents: platformFee });
        if (gatewayFee > 0) lineItems.push({ label: "Gateway fee", amountCents: gatewayFee });
        const taxCents = toNumber((paymentIntent.metadata as any)?.taxCents);

        await this.reservations.recordPayment(reservationId, amountCents, {
          transactionId: paymentIntent.id,
          paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
          source: paymentIntent.metadata.source || 'online',
          stripePaymentIntentId: paymentIntent.id,
          stripeChargeId: paymentIntent.latest_charge,
          stripeBalanceTransactionId: paymentIntent.charges?.data?.[0]?.balance_transaction,
          applicationFeeCents: paymentIntent.application_fee_amount ?? undefined,
          methodType: paymentIntent.payment_method_types?.[0],
          capturedAt: paymentIntent.status === 'succeeded' ? new Date(paymentIntent.created * 1000) : undefined,
          lineItems,
          taxCents: taxCents || undefined,
          feeCents: platformFee + gatewayFee > 0 ? platformFee + gatewayFee : undefined,
          totalCents: amountCents,
          receiptKind: "payment"
        });
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as any;
      const pmType = pi.payment_method_types?.[0];
      if (pmType === "us_bank_account") {
        console.warn(`[ACH] Payment failed for PI ${pi.id}: ${pi.last_payment_error?.message ?? "unknown"}`);
        await this.handleAchReturn(pi);
      }
    }

    if (event.type === "account.updated") {
      const acct = event.data.object as any;
      const acctId = acct.id as string;
      try {
        const capabilities = acct.capabilities;
        await this.prisma.campground.updateMany({
          where: { stripeAccountId: acctId },
          data: {
            stripeCapabilities: capabilities as any,
            stripeCapabilitiesFetchedAt: new Date()
          }
        } as any);
        await this.recon.sendAlert(`Stripe capabilities updated for ${acctId}: ${JSON.stringify(capabilities)}`);
      } catch (err) {
        console.warn(`Failed to update capabilities for account ${acctId}: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (event.type === "payout.paid" || event.type === "payout.failed" || event.type === "payout.updated") {
      const payout = event.data.object as any;
      await this.recon.reconcilePayout(payout);
    }

    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.updated" || event.type === "charge.dispute.closed") {
      const dispute = event.data.object as any;
      await this.recon.upsertDispute(dispute);
    }

    // Handle refund events
    if (event.type === "charge.refunded") {
      const charge = event.data.object as any;
      const paymentIntentId = charge.payment_intent;

      if (paymentIntentId) {
        try {
          const intent = await this.stripeService.retrievePaymentIntent(paymentIntentId);
          const reservationId = intent.metadata?.reservationId;
          if (reservationId) {
            const receiptLines = this.buildReceiptLinesFromIntent(intent);
            await this.reservations.recordRefund(reservationId, charge.amount_refunded, charge.id, {
              lineItems: receiptLines.lineItems,
              taxCents: receiptLines.taxCents,
              feeCents: receiptLines.feeCents,
              totalCents: charge.amount_refunded,
              paymentMethod: intent.payment_method_types?.[0] || "card",
              source: intent.metadata?.source || "online",
              tenders: [
                { method: intent.payment_method_types?.[0] || "card", amountCents: charge.amount_refunded, note: "webhook_refund" }
              ]
            });
          }
        } catch {
          // Log but don't fail - the refund still happened in Stripe
          console.error('Failed to update reservation after refund webhook');
        }
      }
    }

    return { received: true };
  }

  // -----------------------------------------------------------------------------
  // Admin queries
  // -----------------------------------------------------------------------------

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/payouts")
  async listPayouts(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: PayoutStatus,
    @Req() req?: any
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const payouts = await (this.prisma as any).payout.findMany({
      where: {
        campgroundId,
        status: status ? (status as string) : undefined
      },
      orderBy: { createdAt: "desc" },
      include: {
        lines: true
      }
    });
    return payouts;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/payouts/:payoutId")
  async getPayout(
    @Param("campgroundId") campgroundId: string,
    @Param("payoutId") payoutId: string,
    @Req() req?: any
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const payout = await (this.prisma as any).payout.findFirst({
      where: { id: payoutId, campgroundId },
      include: { lines: true }
    });
    if (!payout) throw new NotFoundException("Payout not found");
    return payout;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/payouts/:payoutId/recon")
  async getPayoutRecon(
    @Param("campgroundId") campgroundId: string,
    @Param("payoutId") payoutId: string,
    @Req() req?: any
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    try {
      return await this.recon.computeReconSummary(payoutId, campgroundId);
    } catch (err) {
      throw new NotFoundException((err as Error).message);
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/payouts/:payoutId/export")
  async exportPayoutCsv(
    @Param("campgroundId") campgroundId: string,
    @Param("payoutId") payoutId: string,
    @Res() res: Response,
    @Req() req?: any
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const payout = await (this.prisma as any).payout.findFirst({
      where: { id: payoutId, campgroundId },
      include: { lines: true }
    });
    if (!payout) throw new NotFoundException("Payout not found");

    const headers = ["type", "amount_cents", "currency", "description", "reservation_id", "payment_intent_id", "charge_id", "balance_transaction_id", "created_at"];
    const rows = (payout.lines || []).map((l: any) => [
      l.type,
      l.amountCents,
      l.currency,
      l.description ?? "",
      l.reservationId ?? "",
      l.paymentIntentId ?? "",
      l.chargeId ?? "",
      l.balanceTransactionId ?? "",
      l.createdAt ?? ""
    ]);
    const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    (res as any).setHeader("Content-Type", "text/csv");
    (res as any).setHeader("Content-Disposition", `attachment; filename="payout-${payout.stripePayoutId}.csv"`);
    return (res as any).send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/payouts/:payoutId/ledger-export")
  async exportPayoutLedgerCsv(
    @Param("campgroundId") campgroundId: string,
    @Param("payoutId") payoutId: string,
    @Res() res: Response,
    @Req() req?: any
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const payout = await (this.prisma as any).payout.findFirst({
      where: { id: payoutId, campgroundId },
      include: { lines: true }
    });
    if (!payout) throw new NotFoundException("Payout not found");
    const reservationIds = Array.from(new Set((payout.lines || []).map((l: any) => l.reservationId).filter(Boolean)));
    const ledgerEntries = reservationIds.length
      ? await (this.prisma as any).ledgerEntry.findMany({ where: { reservationId: { in: reservationIds } } })
      : [];
    const headers = ["id", "reservation_id", "gl_code", "account", "description", "amount_cents", "direction", "occurred_at"];
    const rows = ledgerEntries.map((e: any) => [
      e.id,
      e.reservationId ?? "",
      e.glCode ?? "",
      e.account ?? "",
      e.description ?? "",
      e.amountCents,
      e.direction,
      e.occurredAt?.toISOString?.() ?? ""
    ]);
    const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    (res as any).setHeader("Content-Type", "text/csv");
    (res as any).setHeader("Content-Disposition", `attachment; filename="payout-ledger-${payout.stripePayoutId}.csv"`);
    return (res as any).send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/disputes")
  async listDisputes(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: DisputeStatus,
    @Req() req?: any
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const disputes = await (this.prisma as any).dispute.findMany({
      where: {
        campgroundId,
        status: status ? (status as string) : undefined
      },
      orderBy: { createdAt: "desc" }
    });
    return disputes;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/disputes/:disputeId")
  async getDispute(
    @Param("campgroundId") campgroundId: string,
    @Param("disputeId") disputeId: string,
    @Req() req?: any
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const dispute = await (this.prisma as any).dispute.findFirst({
      where: { id: disputeId, campgroundId }
    });
    if (!dispute) throw new NotFoundException("Dispute not found");
    return dispute;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/disputes/export")
  async exportDisputesCsv(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status: string | undefined,
    @Res() res: Response,
    @Req() req?: any
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const disputes = await (this.prisma as any).dispute.findMany({
      where: { campgroundId, status: status ? (status as string) : undefined }
    });
    const headers = ["stripe_dispute_id", "status", "amount_cents", "currency", "reason", "reservation_id", "charge_id", "payment_intent_id", "evidence_due_by"];
    const rows = disputes.map((d: any) => [
      d.stripeDisputeId,
      d.status,
      d.amountCents,
      d.currency,
      d.reason ?? "",
      d.reservationId ?? "",
      d.stripeChargeId ?? "",
      d.stripePaymentIntentId ?? "",
      d.evidenceDueBy ? d.evidenceDueBy.toISOString() : ""
    ]);
    const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    (res as any).setHeader("Content-Type", "text/csv");
    (res as any).setHeader("Content-Disposition", `attachment; filename="disputes-${campgroundId}.csv"`);
    return (res as any).send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/disputes/templates")
  async disputeTemplates(@Param("campgroundId") campgroundId: string, @Req() req?: any) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    return [
      { id: "receipt", label: "Receipt / proof of payment" },
      { id: "terms", label: "Signed terms, policies, cancellation rules" },
      { id: "stay-proof", label: "Proof of stay/use (check-in logs, gate, photos)" },
      { id: "comms", label: "Message history with guest" },
      { id: "id", label: "ID/vehicle verification if collected" },
    ];
  }

  // ACH return handling: create refund ledger entry and record refund
  private async handleAchReturn(paymentIntent: any) {
    const reservationId = paymentIntent.metadata?.reservationId;
    const amount = paymentIntent.amount_received ?? paymentIntent.amount ?? 0;
    if (!reservationId || amount <= 0) return;
    try {
      await this.reservations.recordRefund(reservationId, amount, `ACH return ${paymentIntent.last_payment_error?.code ?? ""}`);
      await (this.prisma as any).ledgerEntry.create({
        data: {
          campgroundId: paymentIntent.metadata?.campgroundId ?? "",
          reservationId,
          glCode: "CHARGEBACK",
          account: "Chargebacks",
          description: `ACH return ${paymentIntent.id}`,
          amountCents: amount,
          direction: "debit",
          occurredAt: new Date()
        }
      });
      await (this.prisma as any).ledgerEntry.create({
        data: {
          campgroundId: paymentIntent.metadata?.campgroundId ?? "",
          reservationId,
          glCode: "CASH",
          account: "Cash",
          description: `ACH return ${paymentIntent.id} (offset)`,
          amountCents: amount,
          direction: "credit",
          occurredAt: new Date()
        }
      });
    } catch (err) {
      console.warn(`[ACH] Failed to record ACH return for PI ${paymentIntent.id}: ${err instanceof Error ? err.message : err}`);
    await this.recon.sendAlert(`[ACH] Failed to record ACH return for PI ${paymentIntent.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
