import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import Stripe from "stripe";
import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { ReservationsService } from "../reservations/reservations.service";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { StripeService } from "./stripe.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";
import { Prisma, UserRole, IdempotencyStatus } from "@prisma/client";
type BillingPlan = "ota_only" | "standard" | "enterprise";
type PaymentFeeMode = "absorb" | "pass_through";
type DisputeStatus =
  | "warning_needs_response"
  | "warning_under_review"
  | "needs_response"
  | "under_review"
  | "charge_refunded"
  | "won"
  | "lost";
type PayoutStatus = "pending" | "in_transit" | "paid" | "failed" | "canceled";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsReconciliationService } from "./reconciliation.service";
import { IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";
import { IdempotencyService } from "./idempotency.service";
import { GatewayConfigService } from "./gateway-config.service";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  CreatePaymentIntentSchema,
  CreatePublicPaymentIntentSchema,
  CapturePaymentIntentSchema,
  RefundPaymentIntentSchema,
  UpdatePaymentSettingsSchema,
  CreateSetupIntentSchema,
  CreatePublicSetupIntentSchema,
  ConfirmPublicPaymentIntentSchema,
} from "./schemas/payment-validation.schema";
import type { AuthUser } from "../auth/auth.types";
import { isRecord } from "../utils/type-guards";

import { IsNotEmpty, IsString } from "class-validator";

type StripeCapabilities = Record<string, string>;

const isStripeCapabilities = (value: unknown): value is StripeCapabilities =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");

const isStripePaymentIntent = (value: unknown): value is Stripe.PaymentIntent =>
  isRecord(value) && value.object === "payment_intent";

const isStripeAccount = (value: unknown): value is Stripe.Account =>
  isRecord(value) && value.object === "account";

const isStripePayout = (value: unknown): value is Stripe.Payout =>
  isRecord(value) && value.object === "payout";

const isStripeDispute = (value: unknown): value is Stripe.Dispute =>
  isRecord(value) && value.object === "dispute";

const isStripeCharge = (value: unknown): value is Stripe.Charge =>
  isRecord(value) && value.object === "charge";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type ThreeDsConfig = {
  additionalConfig?: Record<string, unknown> | null;
  region?: string | null;
};

const DISPUTE_STATUS_VALUES: DisputeStatus[] = [
  "warning_needs_response",
  "warning_under_review",
  "needs_response",
  "under_review",
  "charge_refunded",
  "won",
  "lost",
];

const parseDisputeStatus = (value?: string): DisputeStatus | undefined =>
  DISPUTE_STATUS_VALUES.find((status) => status === value);

const toNullableJsonInput = (
  value: Prisma.InputJsonValue | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value;
};

const normalizeStripeCapabilities = (
  capabilities: Stripe.Account.Capabilities | null | undefined,
): StripeCapabilities | undefined => {
  if (!capabilities) return undefined;
  const normalized: StripeCapabilities = {};
  for (const [key, value] of Object.entries(capabilities)) {
    if (typeof value === "string") {
      normalized[key] = value;
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
};

const resolveHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const toStripeId = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.id === "string") return value.id;
  return null;
};

// DTO for public payment intent creation
// Note: amountCents is NOT accepted - the server computes the amount from the reservation balance
// to prevent amount tampering and ensure consistency with the reservation's actual due amount.
class CreatePublicPaymentIntentDto {
  @IsOptional()
  @IsString()
  currency?: string;

  @IsNotEmpty()
  @IsString()
  reservationId!: string;

  @IsOptional()
  @IsString()
  guestEmail?: string;

  @IsOptional()
  captureMethod?: "automatic" | "manual";
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
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  amountCents?: number;

  @IsOptional()
  @IsString()
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}

// DTO for capture request
class CapturePaymentIntentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
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
    private readonly gatewayConfigService: GatewayConfigService,
  ) {}

  private readonly logger = new Logger(PaymentsController.name);
  private readonly capabilitiesTtlMs = Number(
    process.env.STRIPE_CAPABILITIES_TTL_MS ?? 6 * 60 * 60 * 1000,
  ); // default 6h

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
      return {
        capabilities: currentCapabilities ?? null,
        fetchedAt: fetchedAt ?? null,
        refreshed: false,
        skipped: false,
      };
    }

    try {
      const capabilities = await this.stripeService.retrieveAccountCapabilities(stripeAccountId);
      if (!capabilities) {
        // Stripe not configured or mock disabled; avoid failing the request.
        return {
          capabilities: currentCapabilities ?? null,
          fetchedAt: fetchedAt ?? null,
          refreshed: false,
          skipped: true,
        };
      }

      const capabilitiesJson = toNullableJsonInput(capabilities);
      const updated = await this.prisma.campground.update({
        where: { id: campgroundId },
        data: {
          stripeCapabilities: capabilitiesJson,
          stripeCapabilitiesFetchedAt: new Date(),
        },
        select: {
          stripeCapabilities: true,
          stripeCapabilitiesFetchedAt: true,
        },
      });

      const storedCapabilities = isStripeCapabilities(updated.stripeCapabilities)
        ? updated.stripeCapabilities
        : null;
      return {
        capabilities: storedCapabilities,
        fetchedAt: updated.stripeCapabilitiesFetchedAt ?? null,
        refreshed: true,
        skipped: false,
      };
    } catch (err) {
      this.logger.warn(
        `Capability refresh failed for campground ${campgroundId}: ${getErrorMessage(err)}`,
      );
      return {
        capabilities: currentCapabilities ?? null,
        fetchedAt: fetchedAt ?? null,
        refreshed: false,
        skipped: false,
        error: err,
      };
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
        paidAmount: true,
        status: true,
      },
    });
    if (!reservation) {
      throw new BadRequestException("Reservation not found for payment");
    }
    const gatewayConfig = await this.gatewayConfigService.getConfig(reservation.campgroundId);
    if (!gatewayConfig) {
      throw new BadRequestException(
        "Payment gateway configuration is missing for this campground.",
      );
    }
    if (gatewayConfig.mode === "prod" && !gatewayConfig.hasProductionCredentials) {
      throw new BadRequestException(
        "Payment gateway is in production mode but credentials are not configured.",
      );
    }
    if (gatewayConfig.gateway !== "stripe") {
      throw new BadRequestException(`Gateway ${gatewayConfig.gateway} is not yet supported.`);
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: reservation.campgroundId },
      select: {
        stripeAccountId: true,
        applicationFeeFlatCents: true,
        billingPlan: true,
        perBookingFeeCents: true,
        monthlyFeeCents: true,
        feeMode: true,
        name: true,
        currency: true,
        stripeCapabilities: true,
        stripeCapabilitiesFetchedAt: true,
      },
    });
    const stripeAccountId = campground?.stripeAccountId ?? undefined;
    if (!stripeAccountId) {
      throw new BadRequestException(
        "Campground is not connected to Stripe. Please complete onboarding.",
      );
    }
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException(
        "Stripe keys are not configured for the platform. Set STRIPE_SECRET_KEY to enable payments.",
      );
    }
    const plan = campground?.billingPlan ?? undefined;
    const planDefaultFee = plan === "standard" ? 200 : plan === "enterprise" ? 100 : 300;
    const applicationFeeCents =
      campground?.perBookingFeeCents ??
      campground?.applicationFeeFlatCents ??
      Number(process.env.PAYMENT_PLATFORM_FEE_CENTS ?? planDefaultFee);
    const feeModeCandidate = gatewayConfig?.feeMode ?? campground?.feeMode;
    const feeMode =
      feeModeCandidate && (feeModeCandidate === "absorb" || feeModeCandidate === "pass_through")
        ? feeModeCandidate
        : "absorb";
    const gatewayFeePercentBasisPoints = gatewayConfig?.effectiveFee?.percentBasisPoints ?? 0;
    const gatewayFeeFlatCents = gatewayConfig?.effectiveFee?.flatFeeCents ?? 0;
    const storedCapabilities = isStripeCapabilities(campground?.stripeCapabilities)
      ? campground?.stripeCapabilities
      : undefined;
    const refreshed = await this.refreshCapabilitiesIfNeeded({
      campgroundId: reservation.campgroundId,
      stripeAccountId,
      currentCapabilities: storedCapabilities ?? null,
      fetchedAt: campground?.stripeCapabilitiesFetchedAt ?? null,
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
      capabilities: refreshed.capabilities ?? storedCapabilities,
      currency: campground?.currency ?? undefined,
      capabilitiesFetchedAt:
        refreshed.fetchedAt ?? campground?.stripeCapabilitiesFetchedAt ?? undefined,
    };
  }

  public getPaymentMethodTypes(capabilities?: Record<string, string> | undefined | null) {
    const achActive = capabilities?.us_bank_account_ach_payments === "active";
    const cardActive = capabilities?.card_payments === "active";
    const types: string[] = [];
    if (cardActive) types.push("card");
    if (achActive) types.push("us_bank_account");
    return types.length ? types : ["card"];
  }

  private calculateGatewayFee(
    amountCents: number,
    percentBasisPoints: number,
    flatFeeCents: number,
  ) {
    const percentPortion = Math.round((amountCents * (percentBasisPoints ?? 0)) / 10000);
    const flatPortion = flatFeeCents ?? 0;
    return Math.max(0, percentPortion + flatPortion);
  }

  public computeChargeAmounts(opts: {
    reservation: {
      balanceAmount?: number | null;
      totalAmount?: number | null;
      paidAmount?: number | null;
    };
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
    const platformPassThroughFeeCents =
      opts.platformFeeMode === "pass_through" ? opts.applicationFeeCents : 0;
    const gatewayPassThroughFeeCents =
      opts.gatewayFeeMode === "pass_through"
        ? this.calculateGatewayFee(
            baseDue,
            opts.gatewayFeePercentBasisPoints,
            opts.gatewayFeeFlatCents,
          )
        : 0;
    const maxCharge = Math.max(
      0,
      baseDue + platformPassThroughFeeCents + gatewayPassThroughFeeCents,
    );
    const desired = opts.requestedAmountCents ?? maxCharge;
    const amountCents = Math.min(Math.max(desired, 0), maxCharge);
    return { amountCents, platformPassThroughFeeCents, gatewayPassThroughFeeCents, baseDue };
  }

  private buildReceiptLinesFromIntent(intent: Stripe.PaymentIntent) {
    const toNumber = (v: unknown) =>
      v === undefined || v === null || Number.isNaN(Number(v)) ? 0 : Number(v);
    const baseAmount = toNumber(
      intent?.metadata?.baseAmountCents ?? intent?.amount_received ?? intent?.amount,
    );
    const platformFee = toNumber(
      intent?.metadata?.platformPassThroughFeeCents ?? intent?.metadata?.applicationFeeCents,
    );
    const gatewayFee = toNumber(intent?.metadata?.gatewayPassThroughFeeCents);
    const taxCents = toNumber(intent?.metadata?.taxCents);

    const lineItems =
      baseAmount > 0 ? [{ label: "Reservation charge", amountCents: baseAmount }] : [];
    if (platformFee > 0) lineItems.push({ label: "Platform fee", amountCents: platformFee });
    if (gatewayFee > 0) lineItems.push({ label: "Gateway fee", amountCents: gatewayFee });

    const feeCents = platformFee + gatewayFee;
    return {
      lineItems,
      taxCents: taxCents || undefined,
      feeCents: feeCents > 0 ? feeCents : undefined,
      totalCents: toNumber(intent?.amount_received ?? intent?.amount),
    };
  }

  private ensureCampgroundMembership(
    user: AuthUser | null | undefined,
    campgroundId: string | null | undefined,
  ) {
    const actorCampgrounds = user?.memberships?.map((membership) => membership.campgroundId) ?? [];
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
  @UsePipes(new ZodValidationPipe(CreatePaymentIntentSchema))
  @Post("payments/intents")
  async createIntent(
    @Body() body: CreatePaymentIntentDto,
    @Req() req: Request,
    @Headers("idempotency-key") idempotencyKey?: string,
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
      gatewayFeeFlatCents,
    } = ctx;
    const { amountCents, platformPassThroughFeeCents, gatewayPassThroughFeeCents, baseDue } =
      this.computeChargeAmounts({
        reservation,
        platformFeeMode: feeMode,
        applicationFeeCents,
        gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
        gatewayFeePercentBasisPoints,
        gatewayFeeFlatCents,
        requestedAmountCents: body.amountCents,
      });
    const feeBreakdown = {
      platformFeeMode: feeMode,
      platformPassThroughFeeCents,
      gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
      gatewayPassThroughFeeCents,
      gatewayPercentBasisPoints: gatewayFeePercentBasisPoints,
      gatewayFlatFeeCents: gatewayFeeFlatCents,
      baseAmountCents: baseDue,
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
          source: "staff_checkout",
          feeMode,
          applicationFeeCents: String(applicationFeeCents),
          platformPassThroughFeeCents: String(platformPassThroughFeeCents),
          gatewayPassThroughFeeCents: String(gatewayPassThroughFeeCents),
          gatewayProvider: gatewayConfig?.gateway ?? "stripe",
          gatewayMode: gatewayConfig?.mode ?? "test",
          gatewayFeePercentBasisPoints: String(gatewayFeePercentBasisPoints),
          gatewayFeeFlatCents: String(gatewayFeeFlatCents),
          threeDsPolicy,
        },
        stripeAccountId,
        applicationFeeCents,
        body.autoCapture === false ? "manual" : "automatic",
        this.getPaymentMethodTypes(capabilities),
        idempotencyKey,
        threeDsPolicy,
      );

      const response = {
        id: intent.id,
        clientSecret: intent.client_secret,
        amountCents,
        currency,
        reservationId: body.reservationId,
        status: intent.status,
        fees: feeBreakdown,
        threeDsPolicy,
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
  async createSetupIntent(
    @Body() body: { reservationId: string; customerEmail?: string },
    @Req() req: Request,
  ) {
    if (!body.reservationId) throw new BadRequestException("reservationId is required");
    const ctx = await this.getPaymentContext(body.reservationId);
    this.ensureCampgroundMembership(req?.user, ctx.campgroundId);
    const { stripeAccountId, capabilities } = ctx;
    const setupIntent = await this.stripeService.createSetupIntent(
      stripeAccountId,
      {
        reservationId: body.reservationId,
        source: "staff_setup",
      },
      this.getPaymentMethodTypes(capabilities),
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
        source: "public_setup",
        guestEmail: body.guestEmail || "",
      },
      this.getPaymentMethodTypes(capabilities),
    );
    return { id: setupIntent.id, clientSecret: setupIntent.client_secret };
  }

  /**
   * Create a payment intent for public/guest checkout (no authentication required)
   * CRITICAL: Zod validation protects against amount tampering and invalid data
   */
  @UsePipes(new ZodValidationPipe(CreatePublicPaymentIntentSchema))
  @Post("public/payments/intents")
  async createPublicIntent(
    @Body() body: CreatePublicPaymentIntentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    const currency = (body.currency || "usd").toLowerCase();
    const effectiveIdempotencyKey = idempotencyKey?.trim();

    if (!effectiveIdempotencyKey) {
      throw new BadRequestException({
        message: "Idempotency-Key header is required for public payments",
        retryAfterMs: 500,
        hint: "Send a unique Idempotency-Key per checkout attempt and reuse it when retrying.",
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
      gatewayFeeFlatCents,
    } = await this.getPaymentContext(body.reservationId);
    const { amountCents, platformPassThroughFeeCents, gatewayPassThroughFeeCents, baseDue } =
      this.computeChargeAmounts({
        reservation,
        platformFeeMode: feeMode,
        applicationFeeCents,
        gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
        gatewayFeePercentBasisPoints,
        gatewayFeeFlatCents,
      });
    const feeBreakdown = {
      platformFeeMode: feeMode,
      platformPassThroughFeeCents,
      gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
      gatewayPassThroughFeeCents,
      gatewayPercentBasisPoints: gatewayFeePercentBasisPoints,
      gatewayFlatFeeCents: gatewayFeeFlatCents,
      baseAmountCents: baseDue,
    };

    const metadata: Record<string, string> = {
      reservationId: body.reservationId,
      campgroundId,
      source: "public_checkout",
      currency,
      feeMode,
      applicationFeeCents: String(applicationFeeCents),
      platformPassThroughFeeCents: String(platformPassThroughFeeCents),
      gatewayPassThroughFeeCents: String(gatewayPassThroughFeeCents),
      gatewayProvider: gatewayConfig?.gateway ?? "stripe",
      gatewayMode: gatewayConfig?.mode ?? "test",
      gatewayFeePercentBasisPoints: String(gatewayFeePercentBasisPoints),
      gatewayFeeFlatCents: String(gatewayFeeFlatCents),
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
      rateAction: "apply",
    });
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) {
      return existing.responseJson;
    }
    if (
      existing?.status === IdempotencyStatus.inflight &&
      existing.createdAt &&
      Date.now() - new Date(existing.createdAt).getTime() < 60000
    ) {
      throw new ConflictException({
        message: "Payment intent creation already in progress; retry with backoff",
        retryAfterMs: 500,
        reason: "inflight",
        idempotencyKey: effectiveIdempotencyKey,
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
          body.captureMethod === "manual" ? "manual" : "automatic",
          this.getPaymentMethodTypes(capabilities),
          effectiveIdempotencyKey,
          threeDsPolicy,
        ),
      );

      const response = {
        id: intent.id,
        clientSecret: intent.client_secret,
        amountCents,
        currency,
        status: intent.status,
        fees: feeBreakdown,
        threeDsPolicy,
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
  @UsePipes(new ZodValidationPipe(ConfirmPublicPaymentIntentSchema))
  @Post("public/payments/intents/:id/confirm")
  async confirmPublicPaymentIntent(
    @Param("id") paymentIntentId: string,
    @Body() body: { reservationId: string },
    @Req() req: Request,
  ) {
    // IDEMPOTENCY FIX (PAY-LOW-002): Use stable key derived from paymentIntentId + reservationId
    // Never use Date.now() as it creates different keys on retries, defeating idempotency
    // paymentIntentId is unique per payment attempt, combined with reservationId ensures stability
    const idempotencyHeader = resolveHeaderValue(req.headers["idempotency-key"]);
    const idempotencyKey = idempotencyHeader ?? `confirm-${paymentIntentId}-${body.reservationId}`;

    // Check if already processed (idempotency)
    const existing = await this.idempotency.start(
      idempotencyKey,
      { paymentIntentId, ...body },
      null,
      {
        endpoint: "public/payments/intents/confirm",
        requestBody: body,
        metadata: { paymentIntentId, reservationId: body.reservationId },
      },
    );
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) {
      return existing.responseJson;
    }

    try {
      const ctx = await this.getPaymentContext(body.reservationId);
      const {
        stripeAccountId,
        applicationFeeCents,
        feeMode,
        reservation,
        campgroundId,
        gatewayConfig,
        gatewayFeePercentBasisPoints,
        gatewayFeeFlatCents,
        currency: campgroundCurrency,
      } = ctx;

      // Retrieve payment intent from Stripe to verify status
      const intent = stripeAccountId
        ? await this.stripeService.retrievePaymentIntentOnConnectedAccount(
            stripeAccountId,
            paymentIntentId,
          )
        : await this.stripeService.retrievePaymentIntent(paymentIntentId);

      // SECURITY: Validate payment intent metadata matches the reservation
      // This prevents attackers from applying a different payment intent to a reservation
      const intentReservationId = intent.metadata?.reservationId;
      const intentCampgroundId = intent.metadata?.campgroundId;

      if (!intentReservationId || intentReservationId !== body.reservationId) {
        throw new BadRequestException("Payment intent does not match this reservation");
      }

      if (!intentCampgroundId || intentCampgroundId !== campgroundId) {
        throw new BadRequestException("Payment intent does not match this campground");
      }

      const expectedCurrency = (
        intent.metadata?.currency ||
        campgroundCurrency ||
        "usd"
      ).toLowerCase();
      if ((intent.currency || "").toLowerCase() !== expectedCurrency) {
        throw new BadRequestException("Payment intent currency does not match expected currency");
      }

      const { amountCents: expectedAmountCents } = this.computeChargeAmounts({
        reservation,
        platformFeeMode: feeMode,
        applicationFeeCents,
        gatewayFeeMode: gatewayConfig?.feeMode ?? feeMode,
        gatewayFeePercentBasisPoints,
        gatewayFeeFlatCents,
      });
      if (intent.amount !== expectedAmountCents) {
        throw new BadRequestException("Payment intent amount does not match expected total");
      }

      // SECURITY FIX (PAY-HIGH-001): Only treat "succeeded" as completed payment
      // "requires_capture" means authorization only - don't update reservation financials
      // until capture actually succeeds (via webhook or explicit capture call)
      if (intent.status !== "succeeded" && intent.status !== "requires_capture") {
        const response = {
          success: false,
          status: intent.status,
          message: `Payment not completed. Status: ${intent.status}`,
          reservationId: body.reservationId,
        };
        await this.idempotency.complete(idempotencyKey, response);
        return response;
      }

      // For requires_capture (authorization-only), return early without updating reservation
      // The reservation will be updated when the payment is captured
      if (intent.status === "requires_capture") {
        const response = {
          success: true,
          status: "authorized",
          reservationId: body.reservationId,
          amountCents: intent.amount,
          message: "Payment authorized. Capture required to complete payment.",
          requiresCapture: true,
        };
        await this.idempotency.complete(idempotencyKey, response);
        return response;
      }

      // Check if payment already recorded (prevent duplicates)
      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          stripePaymentIntentId: paymentIntentId,
          reservationId: body.reservationId,
        },
      });

      if (existingPayment) {
        const response = {
          success: true,
          status: "already_recorded",
          paymentId: existingPayment.id,
          reservationId: body.reservationId,
          message: "Payment was already recorded",
        };
        await this.idempotency.complete(idempotencyKey, response);
        return response;
      }

      // Record the payment and update reservation via standard accounting pipeline
      // At this point, intent.status === "succeeded" (requires_capture handled above)
      const receivedAmountCents = intent.amount_received ?? intent.amount;
      const receiptLines = this.buildReceiptLinesFromIntent(intent);
      const latestChargeId =
        typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
      await this.reservations.recordPayment(body.reservationId, receivedAmountCents, {
        transactionId: intent.id,
        paymentMethod: intent.payment_method_types?.[0] || "card",
        source: intent.metadata?.source || "public_checkout",
        stripePaymentIntentId: intent.id,
        stripeChargeId: latestChargeId,
        capturedAt: new Date(),
        lineItems: receiptLines.lineItems,
        taxCents: receiptLines.taxCents,
        feeCents: receiptLines.feeCents,
        totalCents: receiptLines.totalCents,
        receiptKind: "payment",
        tenders: [
          {
            method: intent.payment_method_types?.[0] || "card",
            amountCents: receivedAmountCents,
            note: "public_checkout",
          },
        ],
      });

      const recordedPayment = await this.prisma.payment.findFirst({
        where: { stripePaymentIntentId: paymentIntentId, reservationId: body.reservationId },
        select: { id: true },
      });

      // Confirm reservation if still pending
      if (reservation.status === "pending") {
        await this.prisma.reservation.update({
          where: { id: body.reservationId },
          data: { status: "confirmed" },
        });
      }

      const response = {
        success: true,
        status: intent.status,
        reservationId: body.reservationId,
        paymentId: recordedPayment?.id,
        amountCents: receivedAmountCents,
        message: "Payment confirmed and reservation updated",
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
  async connectCampground(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, email: true, stripeAccountId: true },
    });
    if (!campground) throw new BadRequestException("Campground not found");

    let accountId = campground.stripeAccountId ?? undefined;
    if (!accountId) {
      const account = await this.stripeService.createExpressAccount(campground.email || undefined, {
        campgroundId,
      });
      accountId = account.id;
      await this.prisma.campground.update({
        where: { id: campgroundId },
        data: { stripeAccountId: accountId },
      });
    }

    const returnUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/dashboard/settings/payments?status=success`
      : "https://campreservweb-production.up.railway.app/dashboard/settings/payments?status=success";
    const refreshUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/dashboard/settings/payments?status=error`
      : "https://campreservweb-production.up.railway.app/dashboard/settings/payments?status=error";
    const link = await this.stripeService.createAccountOnboardingLink(
      accountId,
      returnUrl,
      refreshUrl,
    );

    // Fetch capabilities after onboarding link creation
    try {
      const capabilities = await this.stripeService.retrieveAccountCapabilities(accountId);
      const capabilitiesJson = toNullableJsonInput(capabilities ?? null);
      await this.prisma.campground.update({
        where: { id: campgroundId },
        data: {
          stripeCapabilities: capabilitiesJson,
          stripeCapabilitiesFetchedAt: new Date(),
        },
      });
    } catch {
      /* noop */
    }

    return { accountId, onboardingUrl: link.url };
  }

  /**
   * Determine 3DS policy based on currency/region and gateway config.
   * EU/UK currencies default to "any" while others stay "automatic".
   */
  public buildThreeDsPolicy(
    currency?: string | null,
    gatewayConfig?: ThreeDsConfig | null,
  ): "any" | "automatic" {
    const cur = currency?.toLowerCase?.() ?? "usd";
    const additionalRegion =
      isRecord(gatewayConfig?.additionalConfig) &&
      typeof gatewayConfig.additionalConfig.region === "string"
        ? gatewayConfig.additionalConfig.region
        : null;
    const regionValue = additionalRegion ?? gatewayConfig?.region ?? null;
    const region = typeof regionValue === "string" ? regionValue.toLowerCase() : null;
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
      this.logger.error(`Primary gateway failed: ${getErrorMessage(err)}`, err);
      this.logger.warn("Secondary gateway failover stub invoked (no secondary configured)");
      const fallback = new ServiceUnavailableException({
        message: "Payment processor unavailable; retry with backoff or alternate gateway",
        reason: "gateway_unavailable",
      });
      Object.defineProperty(fallback, "cause", { value: err, configurable: true });
      throw fallback;
    }
  }

  /**
   * Update campground payment settings (e.g., application fee)
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @UsePipes(new ZodValidationPipe(UpdatePaymentSettingsSchema))
  @Post("campgrounds/:campgroundId/payments/settings")
  async updatePaymentSettings(
    @Param("campgroundId") campgroundId: string,
    @Body() body: UpdatePaymentSettingsDto,
    @Req() req: Request,
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const campground = await this.prisma.campground.findUnique({ where: { id: campgroundId } });
    if (!campground) throw new BadRequestException("Campground not found");

    const billingPlanCandidate = body.billingPlan ?? campground.billingPlan ?? null;
    const billingPlan =
      billingPlanCandidate &&
      (billingPlanCandidate === "ota_only" ||
        billingPlanCandidate === "standard" ||
        billingPlanCandidate === "enterprise")
        ? billingPlanCandidate
        : undefined;
    const feeModeCandidate = body.feeMode ?? campground.feeMode ?? null;
    const feeMode =
      feeModeCandidate && (feeModeCandidate === "absorb" || feeModeCandidate === "pass_through")
        ? feeModeCandidate
        : undefined;

    const updated = await this.prisma.campground.update({
      where: { id: campgroundId },
      data: {
        applicationFeeFlatCents: body.applicationFeeFlatCents ?? campground.applicationFeeFlatCents,
        perBookingFeeCents: body.perBookingFeeCents ?? campground.perBookingFeeCents,
        monthlyFeeCents: body.monthlyFeeCents ?? campground.monthlyFeeCents,
        billingPlan: billingPlan ?? undefined,
        feeMode: feeMode ?? undefined,
      },
      select: {
        stripeAccountId: true,
        applicationFeeFlatCents: true,
        perBookingFeeCents: true,
        monthlyFeeCents: true,
        billingPlan: true,
        feeMode: true,
        stripeCapabilities: true,
        stripeCapabilitiesFetchedAt: true,
      },
    });

    return updated;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Post("campgrounds/:campgroundId/payments/capabilities/refresh")
  async refreshCapabilities(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const cg = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        stripeAccountId: true,
        applicationFeeFlatCents: true,
        perBookingFeeCents: true,
        monthlyFeeCents: true,
        billingPlan: true,
        feeMode: true,
        stripeCapabilities: true,
        stripeCapabilitiesFetchedAt: true,
      },
    });

    if (!cg?.stripeAccountId) {
      return {
        ...cg,
        stripeCapabilities: null,
        stripeCapabilitiesFetchedAt: null,
        connected: false,
        refreshed: false,
      };
    }

    const refreshed = await this.refreshCapabilitiesIfNeeded({
      campgroundId,
      stripeAccountId: cg.stripeAccountId,
      currentCapabilities: isStripeCapabilities(cg.stripeCapabilities)
        ? cg.stripeCapabilities
        : null,
      fetchedAt: cg.stripeCapabilitiesFetchedAt ?? null,
      force: true,
    });

    return {
      ...cg,
      stripeCapabilities: refreshed.capabilities ?? cg.stripeCapabilities,
      stripeCapabilitiesFetchedAt: refreshed.fetchedAt ?? cg.stripeCapabilitiesFetchedAt,
      connected: true,
      refreshed: refreshed.refreshed,
    };
  }

  /**
   * Get the status of a payment intent
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("payments/intents/:id")
  async getPaymentIntent(@Param("id") id: string, @Req() req: Request) {
    try {
      const intent = await this.stripeService.retrievePaymentIntent(id);
      const campgroundId = intent.metadata?.campgroundId ?? null;
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
    } catch (error) {
      if (isRecord(error) && error.code === "resource_missing") {
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
  @UsePipes(new ZodValidationPipe(CapturePaymentIntentSchema))
  @Post("payments/intents/:id/capture")
  async capturePaymentIntent(
    @Param("id") id: string,
    @Body() body: CapturePaymentIntentDto,
    @Req() req: Request,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    try {
      const current = await this.stripeService.retrievePaymentIntent(id);
      const campgroundId = current.metadata?.campgroundId ?? null;
      this.ensureCampgroundMembership(req?.user, campgroundId);

      // Check idempotency if key provided
      if (idempotencyKey) {
        const existing = await this.idempotency.start(
          idempotencyKey,
          { id, ...body },
          campgroundId,
        );
        if (existing.status === IdempotencyStatus.succeeded && existing.responseJson) {
          return existing.responseJson;
        }
      }

      const intent = await this.stripeService.capturePaymentIntent(
        id,
        body.amountCents,
        idempotencyKey,
      );

      // Record the payment in the reservation if applicable
      const receiptLines = this.buildReceiptLinesFromIntent(intent);
      const reservationId = intent.metadata?.reservationId;
      if (reservationId) {
        const latestChargeId =
          typeof intent.latest_charge === "string"
            ? intent.latest_charge
            : intent.latest_charge?.id;
        await this.reservations.recordPayment(reservationId, intent.amount_received, {
          transactionId: intent.id,
          paymentMethod: intent.payment_method_types?.[0] || "card",
          source: intent.metadata?.source || "staff_checkout",
          stripePaymentIntentId: intent.id,
          stripeChargeId: latestChargeId,
          capturedAt: new Date(),
          lineItems: receiptLines.lineItems,
          taxCents: receiptLines.taxCents,
          feeCents: receiptLines.feeCents,
          totalCents: receiptLines.totalCents,
          receiptKind: "payment",
          tenders: [
            {
              method: intent.payment_method_types?.[0] || "card",
              amountCents: intent.amount_received ?? intent.amount ?? 0,
              note: "capture",
            },
          ],
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
        feeCents: receiptLines.feeCents,
      };

      if (idempotencyKey) {
        await this.idempotency.complete(idempotencyKey, response);
      }

      return response;
    } catch (error) {
      if (idempotencyKey) {
        await this.idempotency.fail(idempotencyKey);
      }
      if (isRecord(error) && error.code === "resource_missing") {
        throw new NotFoundException(`Payment intent ${id} not found`);
      }
      throw new BadRequestException(getErrorMessage(error));
    }
  }

  /**
   * Issue a refund for a payment intent
   * Accepts Idempotency-Key header for safe retries
   */
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "write" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @UsePipes(new ZodValidationPipe(RefundPaymentIntentSchema))
  @Post("payments/intents/:id/refund")
  async refundPaymentIntent(
    @Param("id") id: string,
    @Body() body: RefundPaymentIntentDto,
    @Req() req: Request,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    try {
      const intent = await this.stripeService.retrievePaymentIntent(id);
      const campgroundId = intent.metadata?.campgroundId ?? null;
      this.ensureCampgroundMembership(req?.user, campgroundId);

      // Check idempotency if key provided
      if (idempotencyKey) {
        const existing = await this.idempotency.start(
          idempotencyKey,
          { id, ...body },
          campgroundId,
        );
        if (existing.status === IdempotencyStatus.succeeded && existing.responseJson) {
          return existing.responseJson;
        }
      }

      const refund = await this.stripeService.createRefund(
        id,
        body.amountCents,
        body.reason,
        idempotencyKey,
      );
      const receiptLines = this.buildReceiptLinesFromIntent(intent);

      const reservationId = intent.metadata?.reservationId;
      if (reservationId) {
        const refundChargeId =
          typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
        await this.reservations.recordRefund(reservationId, refund.amount || 0, refund.id, {
          lineItems: receiptLines.lineItems,
          taxCents: receiptLines.taxCents,
          feeCents: receiptLines.feeCents,
          totalCents: refund.amount || receiptLines.totalCents,
          paymentMethod: intent.payment_method_types?.[0] || "card",
          source: intent.metadata?.source || "online",
          stripePaymentIntentId: intent.id,
          stripeChargeId: refundChargeId,
          tenders: [
            {
              method: intent.payment_method_types?.[0] || "card",
              amountCents: refund.amount || 0,
              note: "stripe_refund",
            },
          ],
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
        feeCents: receiptLines.feeCents,
      };

      if (idempotencyKey) {
        await this.idempotency.complete(idempotencyKey, response);
      }

      return response;
    } catch (error) {
      if (idempotencyKey) {
        await this.idempotency.fail(idempotencyKey);
      }
      if (isRecord(error) && error.code === "resource_missing") {
        throw new NotFoundException(`Payment intent ${id} not found`);
      }
      throw new BadRequestException(getErrorMessage(error));
    }
  }

  /**
   * Handle Stripe webhooks
   */
  @Post("payments/webhook")
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    if (!signature) throw new BadRequestException("Missing stripe-signature header");

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructEventFromPayload(signature, req.rawBody!);
    } catch (err) {
      throw new BadRequestException(`Webhook Error: ${getErrorMessage(err)}`);
    }

    if (event.type === "payment_intent.succeeded") {
      if (!isStripePaymentIntent(event.data.object)) {
        throw new BadRequestException("Webhook Error: invalid payment intent payload");
      }
      const paymentIntent = event.data.object;
      const reservationId = paymentIntent.metadata?.reservationId;
      const amountCents = paymentIntent.amount;

      if (reservationId) {
        // Idempotency check: Skip if payment was already recorded for this Stripe payment intent
        // This prevents duplicate payments when webhooks are delivered multiple times
        const existingPayment = await this.prisma.payment.findFirst({
          where: { stripePaymentIntentId: paymentIntent.id },
        });

        if (existingPayment) {
          this.logger.log(
            `[Webhook] Payment already recorded for intent ${paymentIntent.id}, skipping`,
          );
        } else {
          const toNumber = (v: unknown) =>
            v === undefined || v === null || Number.isNaN(Number(v)) ? 0 : Number(v);
          const lineItems = [
            {
              label: "Reservation charge",
              amountCents: toNumber(paymentIntent.metadata?.baseAmountCents ?? amountCents),
            },
          ];
          const platformFee = toNumber(
            paymentIntent.metadata?.platformPassThroughFeeCents ??
              paymentIntent.metadata?.applicationFeeCents,
          );
          const gatewayFee = toNumber(paymentIntent.metadata?.gatewayPassThroughFeeCents);
          if (platformFee > 0) lineItems.push({ label: "Platform fee", amountCents: platformFee });
          if (gatewayFee > 0) lineItems.push({ label: "Gateway fee", amountCents: gatewayFee });
          const taxCents = toNumber(paymentIntent.metadata?.taxCents);
          const latestCharge = paymentIntent.latest_charge;
          const latestChargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id;
          const balanceTransactionId =
            typeof latestCharge === "string" || !latestCharge
              ? undefined
              : typeof latestCharge.balance_transaction === "string"
                ? latestCharge.balance_transaction
                : latestCharge.balance_transaction?.id;

          await this.reservations.recordPayment(reservationId, amountCents, {
            transactionId: paymentIntent.id,
            paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
            source: paymentIntent.metadata.source || "online",
            stripePaymentIntentId: paymentIntent.id,
            stripeChargeId: latestChargeId,
            stripeBalanceTransactionId: balanceTransactionId,
            applicationFeeCents: paymentIntent.application_fee_amount ?? undefined,
            methodType: paymentIntent.payment_method_types?.[0],
            capturedAt:
              paymentIntent.status === "succeeded"
                ? new Date(paymentIntent.created * 1000)
                : undefined,
            lineItems,
            taxCents: taxCents || undefined,
            feeCents: platformFee + gatewayFee > 0 ? platformFee + gatewayFee : undefined,
            totalCents: amountCents,
            receiptKind: "payment",
          });
        }
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      if (!isStripePaymentIntent(event.data.object)) {
        throw new BadRequestException("Webhook Error: invalid payment intent payload");
      }
      const pi = event.data.object;
      const pmType = pi.payment_method_types?.[0];
      if (pmType === "us_bank_account") {
        this.logger.warn(
          `[ACH] Payment failed for PI ${pi.id}: ${pi.last_payment_error?.message ?? "unknown"}`,
        );
        await this.handleAchReturn(pi);
      }
    }

    if (event.type === "account.updated") {
      if (!isStripeAccount(event.data.object)) {
        throw new BadRequestException("Webhook Error: invalid account payload");
      }
      const acct = event.data.object;
      const acctId = acct.id;
      try {
        const capabilities = normalizeStripeCapabilities(acct.capabilities);
        const capabilitiesJson = toNullableJsonInput(capabilities ?? null);
        await this.prisma.campground.updateMany({
          where: { stripeAccountId: acctId },
          data: {
            stripeCapabilities: capabilitiesJson,
            stripeCapabilitiesFetchedAt: new Date(),
          },
        });
        await this.recon.sendAlert(
          `Stripe capabilities updated for ${acctId}: ${JSON.stringify(capabilities)}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to update capabilities for account ${acctId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (
      event.type === "payout.paid" ||
      event.type === "payout.failed" ||
      event.type === "payout.updated"
    ) {
      if (!isStripePayout(event.data.object)) {
        throw new BadRequestException("Webhook Error: invalid payout payload");
      }
      const payout = event.data.object;
      const payoutPayload = {
        id: payout.id,
        amount: payout.amount,
        fee: null,
        status: payout.status,
        arrival_date: payout.arrival_date,
        currency: payout.currency,
        destination: toStripeId(payout.destination),
        stripe_account: event.account ?? null,
        statement_descriptor: payout.statement_descriptor ?? null,
      };
      await this.recon.reconcilePayout(payoutPayload);
    }

    if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.updated" ||
      event.type === "charge.dispute.closed"
    ) {
      if (!isStripeDispute(event.data.object)) {
        throw new BadRequestException("Webhook Error: invalid dispute payload");
      }
      const dispute = event.data.object;
      const disputePayload = {
        id: dispute.id,
        amount: dispute.amount,
        charge: toStripeId(dispute.charge),
        payment_intent: toStripeId(dispute.payment_intent),
        account: event.account ?? null,
        metadata: dispute.metadata ?? null,
        status: dispute.status,
        reason: dispute.reason,
        currency: dispute.currency,
        evidence_details: dispute.evidence_details ?? null,
        evidence: dispute.evidence ?? null,
      };
      await this.recon.upsertDispute(disputePayload);
    }

    // Handle refund events - use individual refund objects to avoid double-processing
    if (event.type === "charge.refunded") {
      if (!isStripeCharge(event.data.object)) {
        throw new BadRequestException("Webhook Error: invalid charge payload");
      }
      const charge = event.data.object;
      const paymentIntentId = toStripeId(charge.payment_intent);

      if (paymentIntentId) {
        try {
          const intent = await this.stripeService.retrievePaymentIntent(paymentIntentId);
          const reservationId = intent.metadata?.reservationId;
          if (reservationId) {
            // Get the most recent refund from the charge's refunds list
            // charge.refunds.data is ordered by created date descending
            const latestRefund = charge.refunds?.data?.[0];
            if (!latestRefund) {
              this.logger.warn(`charge.refunded event with no refunds for charge ${charge.id}`);
              return { received: true };
            }

            // Use the individual refund ID for deduplication (not charge.id which is shared across all refunds)
            const refundId = latestRefund.id;
            const refundAmount = latestRefund.amount;

            // Check if we've already processed this specific refund
            const existingPayment = await this.prisma.payment.findFirst({
              where: {
                reservationId,
                stripePaymentIntentId: `refund_${refundId}`,
                direction: "refund",
              },
            });

            if (existingPayment) {
              this.logger.log(
                `Skipping duplicate refund ${refundId} for reservation ${reservationId}`,
              );
              return { received: true };
            }

            const receiptLines = this.buildReceiptLinesFromIntent(intent);
            await this.reservations.recordRefund(reservationId, refundAmount, refundId, {
              lineItems: receiptLines.lineItems,
              taxCents: receiptLines.taxCents,
              feeCents: receiptLines.feeCents,
              totalCents: refundAmount,
              paymentMethod: intent.payment_method_types?.[0] || "card",
              source: intent.metadata?.source || "online",
              stripePaymentIntentId: paymentIntentId,
              stripeChargeId: charge.id,
              tenders: [
                {
                  method: intent.payment_method_types?.[0] || "card",
                  amountCents: refundAmount,
                  note: "webhook_refund",
                },
              ],
            });
          }
        } catch (err) {
          // Log but don't fail - the refund still happened in Stripe
          this.logger.error(
            `Failed to update reservation after refund webhook: ${err instanceof Error ? err.message : err}`,
          );
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
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string,
    @Req() req?: Request,
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const limit = Math.min(parseInt(limitStr ?? "100", 10) || 100, 500);
    const offset = parseInt(offsetStr ?? "0", 10) || 0;

    const payouts = await this.prisma.payout.findMany({
      where: {
        campgroundId,
        status: status ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        PayoutLine: true,
      },
    });
    return payouts.map(({ PayoutLine, ...payout }) => ({
      ...payout,
      lines: PayoutLine,
    }));
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/payouts/:payoutId")
  async getPayout(
    @Param("campgroundId") campgroundId: string,
    @Param("payoutId") payoutId: string,
    @Req() req?: Request,
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, campgroundId },
      include: { PayoutLine: true },
    });
    if (!payout) throw new NotFoundException("Payout not found");
    const { PayoutLine, ...rest } = payout;
    return { ...rest, lines: PayoutLine };
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/payouts/:payoutId/recon")
  async getPayoutRecon(
    @Param("campgroundId") campgroundId: string,
    @Param("payoutId") payoutId: string,
    @Req() req?: Request,
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    try {
      return await this.recon.computeReconSummary(payoutId, campgroundId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payout not found";
      throw new NotFoundException(message);
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
    @Req() req?: Request,
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, campgroundId },
      include: { PayoutLine: true },
    });
    if (!payout) throw new NotFoundException("Payout not found");

    const headers = [
      "type",
      "amount_cents",
      "currency",
      "description",
      "reservation_id",
      "payment_intent_id",
      "charge_id",
      "balance_transaction_id",
      "created_at",
    ];
    const rows = payout.PayoutLine.map((line) => [
      line.type,
      line.amountCents,
      line.currency,
      line.description ?? "",
      line.reservationId ?? "",
      line.paymentIntentId ?? "",
      line.chargeId ?? "",
      line.balanceTransactionId ?? "",
      line.createdAt ?? "",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payout-${payout.stripePayoutId}.csv"`,
    );
    return res.send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/payouts/:payoutId/ledger-export")
  async exportPayoutLedgerCsv(
    @Param("campgroundId") campgroundId: string,
    @Param("payoutId") payoutId: string,
    @Res() res: Response,
    @Req() req?: Request,
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, campgroundId },
      include: { PayoutLine: true },
    });
    if (!payout) throw new NotFoundException("Payout not found");
    const reservationIds = Array.from(
      new Set(
        payout.PayoutLine.map((line) => line.reservationId).filter((id): id is string =>
          Boolean(id),
        ),
      ),
    );
    const ledgerEntries = reservationIds.length
      ? await this.prisma.ledgerEntry.findMany({ where: { reservationId: { in: reservationIds } } })
      : [];
    const headers = [
      "id",
      "reservation_id",
      "gl_code",
      "account",
      "description",
      "amount_cents",
      "direction",
      "occurred_at",
    ];
    const rows = ledgerEntries.map((entry) => [
      entry.id,
      entry.reservationId ?? "",
      entry.glCode ?? "",
      entry.account ?? "",
      entry.description ?? "",
      entry.amountCents,
      entry.direction,
      entry.occurredAt?.toISOString?.() ?? "",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payout-ledger-${payout.stripePayoutId}.csv"`,
    );
    return res.send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/disputes")
  async listDisputes(
    @Param("campgroundId") campgroundId: string,
    @Query("status") status?: string,
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string,
    @Req() req?: Request,
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const limit = Math.min(parseInt(limitStr ?? "100", 10) || 100, 500);
    const offset = parseInt(offsetStr ?? "0", 10) || 0;
    const statusFilter = parseDisputeStatus(status);

    const disputes = await this.prisma.dispute.findMany({
      where: {
        campgroundId,
        status: statusFilter ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
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
    @Req() req?: Request,
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const dispute = await this.prisma.dispute.findFirst({
      where: { id: disputeId, campgroundId },
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
    @Req() req?: Request,
  ) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    const statusFilter = parseDisputeStatus(status);
    const disputes = await this.prisma.dispute.findMany({
      where: { campgroundId, status: statusFilter ?? undefined },
    });
    const headers = [
      "stripe_dispute_id",
      "status",
      "amount_cents",
      "currency",
      "reason",
      "reservation_id",
      "charge_id",
      "payment_intent_id",
      "evidence_due_by",
    ];
    const rows = disputes.map((dispute) => [
      dispute.stripeDisputeId,
      dispute.status,
      dispute.amountCents,
      dispute.currency,
      dispute.reason ?? "",
      dispute.reservationId ?? "",
      dispute.stripeChargeId ?? "",
      dispute.stripePaymentIntentId ?? "",
      dispute.evidenceDueBy ? dispute.evidenceDueBy.toISOString() : "",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="disputes-${campgroundId}.csv"`);
    return res.send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @RequireScope({ resource: "payments", action: "read" })
  @Roles(UserRole.owner, UserRole.manager, UserRole.finance)
  @Get("campgrounds/:campgroundId/disputes/templates")
  async disputeTemplates(@Param("campgroundId") campgroundId: string, @Req() req?: Request) {
    this.ensureCampgroundMembership(req?.user, campgroundId);
    return [
      { id: "receipt", label: "Receipt / proof of payment" },
      { id: "terms", label: "Signed terms, policies, cancellation rules" },
      { id: "stay-proof", label: "Proof of stay/use (check-in logs, gate, photos)" },
      { id: "comms", label: "Message history with guest" },
      { id: "id", label: "ID/vehicle verification if collected" },
    ];
  }

  /**
   * ACH return handling: create refund ledger entry and record refund.
   *
   * IMPORTANT: This method only processes ACH returns for payments that were
   * previously successful. ACH failures BEFORE settlement should NOT create
   * refund ledger entries because no money was ever received.
   *
   * The method includes idempotency checks using the payment intent ID to
   * prevent double-processing from webhook retries.
   */
  private async handleAchReturn(paymentIntent: Stripe.PaymentIntent) {
    const reservationId = paymentIntent.metadata?.reservationId;
    const campgroundId = paymentIntent.metadata?.campgroundId ?? "";
    const paymentIntentId = paymentIntent.id;

    if (!reservationId) {
      this.logger.log(`[ACH] No reservationId in metadata for PI ${paymentIntentId}, skipping`);
      return;
    }

    // CRITICAL: Check if the original payment was ever successfully recorded.
    // ACH failures BEFORE settlement should NOT create refund entries because
    // no money was ever received.
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        stripePaymentIntentId: paymentIntentId,
        direction: "charge",
      },
    });

    if (!existingPayment) {
      // No successful payment was ever recorded for this payment intent.
      // This is an ACH failure BEFORE settlement - skip refund processing.
      this.logger.log(
        `[ACH] No successful payment found for PI ${paymentIntentId}. ` +
          `ACH failed before settlement - skipping refund/ledger entries.`,
      );
      return;
    }

    // Use the original payment's amount for the refund, not the intent amount
    const amount = existingPayment.amountCents;
    if (amount <= 0) {
      this.logger.log(`[ACH] Payment amount is zero for PI ${paymentIntentId}, skipping`);
      return;
    }

    // Idempotency check: prevent double-processing ACH returns
    const idempotencyKey = `ach-return:${paymentIntentId}`;
    try {
      const existing = await this.idempotency.start(
        idempotencyKey,
        { paymentIntentId, reservationId, amount },
        campgroundId,
        { endpoint: "ach-return" },
      );

      if (existing.status === IdempotencyStatus.succeeded) {
        this.logger.log(`[ACH] Return already processed for PI ${paymentIntentId}, skipping`);
        return;
      }
    } catch (err) {
      if (err instanceof ConflictException) {
        this.logger.log(`[ACH] Return processing in progress for PI ${paymentIntentId}, skipping`);
        return;
      }
      // Rate limit or other errors - log but continue to try processing
      this.logger.warn(
        `[ACH] Idempotency check error for PI ${paymentIntentId}: ${err instanceof Error ? err.message : err}`,
      );
    }

    try {
      // Record the refund against the reservation
      await this.reservations.recordRefund(
        reservationId,
        amount,
        `ACH return ${paymentIntent.last_payment_error?.code ?? ""}`.trim(),
        { stripePaymentIntentId: paymentIntentId },
      );

      // Create balanced ledger entries for the ACH return
      await this.prisma.ledgerEntry.create({
        data: {
          id: randomUUID(),
          campgroundId,
          reservationId,
          glCode: "CHARGEBACK",
          account: "Chargebacks",
          description: `ACH return ${paymentIntentId}`,
          amountCents: amount,
          direction: "debit",
          occurredAt: new Date(),
        },
      });

      await this.prisma.ledgerEntry.create({
        data: {
          id: randomUUID(),
          campgroundId,
          reservationId,
          glCode: "CASH",
          account: "Cash",
          description: `ACH return ${paymentIntentId} (offset)`,
          amountCents: amount,
          direction: "credit",
          occurredAt: new Date(),
        },
      });

      // Mark idempotency as complete
      await this.idempotency.complete(idempotencyKey, { processed: true, amount });

      this.logger.log(
        `[ACH] Successfully processed return for PI ${paymentIntentId}, amount: ${amount}`,
      );
    } catch (err) {
      // Mark idempotency as failed so it can be retried
      await this.idempotency.fail(idempotencyKey).catch(() => null);

      this.logger.warn(
        `[ACH] Failed to record ACH return for PI ${paymentIntentId}: ${err instanceof Error ? err.message : err}`,
      );
      await this.recon.sendAlert(
        `[ACH] Failed to record ACH return for PI ${paymentIntentId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
