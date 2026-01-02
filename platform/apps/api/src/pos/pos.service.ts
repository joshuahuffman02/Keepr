import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { CheckoutCartDto, CreateCartDto, OfflineReplayDto, UpdateCartDto, CreateReturnDto } from "./pos.dto";
import { IdempotencyStatus, PosCartStatus, PosPaymentStatus, TillMovementType, ExpirationTier } from "@prisma/client";
import { StoredValueService } from "../stored-value/stored-value.service";
import { GuestWalletService } from "../guest-wallet/guest-wallet.service";
import { StripeService } from "../payments/stripe.service";
import crypto from "crypto";
import { TillService } from "./till.service";
import { ObservabilityService } from "../observability/observability.service";
import { PosProviderService } from "./pos-provider.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { BatchInventoryService, ExpiredBatchException } from "../inventory/batch-inventory.service";
import { MarkdownRulesService } from "../inventory/markdown-rules.service";
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly storedValue: StoredValueService,
    private readonly guestWallet: GuestWalletService,
    private readonly stripe: StripeService,
    private readonly till: TillService,
    private readonly observability: ObservabilityService,
    private readonly providerIntegrations: PosProviderService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    @Inject(forwardRef(() => BatchInventoryService))
    private readonly batchInventory: BatchInventoryService,
    @Inject(forwardRef(() => MarkdownRulesService))
    private readonly markdownRules: MarkdownRulesService
  ) {}

  async createCart(dto: CreateCartDto, actor: any) {
    const campgroundId = actor?.campgroundId;

    // Get terminal and its location for price lookups
    let locationId: string | null = null;
    let terminalPriceVersion: string | null = null;
    let terminalTaxVersion: string | null = null;

    if (dto.terminalId) {
      const terminal = await this.prisma.posTerminal.findUnique({
        where: { id: dto.terminalId },
        select: { locationId: true, priceVersion: true, taxVersion: true }
      });
      if (terminal) {
        locationId = terminal.locationId;
        terminalPriceVersion = terminal.priceVersion;
        terminalTaxVersion = terminal.taxVersion;
      }
    }

    // Use provided versions or fall back to terminal/system defaults
    const pricingVersion = dto.pricingVersion ?? terminalPriceVersion ?? new Date().toISOString().split('T')[0];
    const taxVersion = dto.taxVersion ?? terminalTaxVersion ?? new Date().toISOString().split('T')[0];

    // Fetch all products for this cart
    const productIds = dto.items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, priceCents: true, name: true }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Fetch location price overrides if we have a location
    const priceOverrides = new Map<string, number>();
    if (locationId) {
      const overrides = await this.prisma.locationPriceOverride.findMany({
        where: {
          productId: { in: productIds },
          locationId,
          isActive: true
        }
      });
      for (const o of overrides) {
        priceOverrides.set(o.productId, o.priceCents);
      }
    }

    // Fetch tax rules for goods/general
    const taxRules = campgroundId ? await this.prisma.taxRule.findMany({
      where: {
        campgroundId,
        isActive: true,
        category: { in: ['general', 'goods'] }
      }
    }) : [];

    // Calculate effective tax rate (sum of all applicable percentage rates)
    let effectiveTaxRate = 0;
    for (const rule of taxRules) {
      if (rule.type === 'percentage' && rule.rate) {
        effectiveTaxRate += Number(rule.rate);
      }
    }

    // Build cart items with proper pricing and tax
    const cartItemsData = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      // Priority: override from DTO > location override > product base price
      const unitPriceCents = item.overridePriceCents
        ?? priceOverrides.get(item.productId)
        ?? product?.priceCents
        ?? 0;
      const subtotalCents = unitPriceCents * item.qty;
      const taxCents = Math.round(subtotalCents * effectiveTaxRate);
      const totalCents = subtotalCents + taxCents;

      return {
        productId: item.productId,
        qty: item.qty,
        unitPriceCents,
        taxCents,
        totalCents,
        originalPriceCents: product?.priceCents ?? unitPriceCents
      };
    });

    return this.prisma.posCart.create({
      data: {
        campgroundId,
        terminalId: dto.terminalId,
        currency: actor?.currency ?? "usd",
        pricingVersion,
        taxVersion,
        items: {
          create: cartItemsData
        }
      },
      include: { items: true }
    });
  }

  async updateCart(cartId: string, dto: UpdateCartDto, actor: any) {
    // Fetch cart with terminal for location-based pricing
    const cart = await this.prisma.posCart.findUnique({
      where: { id: cartId },
      select: { campgroundId: true, terminalId: true }
    });
    if (!cart) throw new NotFoundException("Cart not found");

    const ops: any = {};

    if (dto.add && dto.add.length > 0) {
      // Get location from terminal
      let locationId: string | null = null;
      if (cart.terminalId) {
        const terminal = await this.prisma.posTerminal.findUnique({
          where: { id: cart.terminalId },
          select: { locationId: true }
        });
        locationId = terminal?.locationId ?? null;
      }

      // Fetch products
      const productIds = dto.add.map(i => i.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, priceCents: true }
      });
      const productMap = new Map(products.map(p => [p.id, p]));

      // Fetch location price overrides
      const priceOverrides = new Map<string, number>();
      if (locationId) {
        const overrides = await this.prisma.locationPriceOverride.findMany({
          where: { productId: { in: productIds }, locationId, isActive: true }
        });
        for (const o of overrides) {
          priceOverrides.set(o.productId, o.priceCents);
        }
      }

      // Fetch tax rules
      const taxRules = cart.campgroundId ? await this.prisma.taxRule.findMany({
        where: { campgroundId: cart.campgroundId, isActive: true, category: { in: ['general', 'goods'] } }
      }) : [];
      let effectiveTaxRate = 0;
      for (const rule of taxRules) {
        if (rule.type === 'percentage' && rule.rate) {
          effectiveTaxRate += Number(rule.rate);
        }
      }

      ops.create = dto.add.map((item) => {
        const product = productMap.get(item.productId);
        const unitPriceCents = item.overridePriceCents
          ?? priceOverrides.get(item.productId)
          ?? product?.priceCents
          ?? 0;
        const subtotalCents = unitPriceCents * item.qty;
        const taxCents = Math.round(subtotalCents * effectiveTaxRate);
        const totalCents = subtotalCents + taxCents;

        return {
          productId: item.productId,
          qty: item.qty,
          unitPriceCents,
          taxCents,
          totalCents,
          originalPriceCents: product?.priceCents ?? unitPriceCents
        };
      });
    }

    if (dto.update) {
      ops.update = dto.update.map((item) => ({
        where: { id: item.cartItemId },
        data: {
          qty: item.qty,
          unitPriceCents: item.overridePriceCents ?? undefined
        }
      }));
    }

    if (dto.remove) {
      ops.deleteMany = dto.remove.map((item) => ({ id: item.cartItemId }));
    }

    return this.prisma.posCart.update({
      where: { id: cartId },
      data: { items: ops },
      include: { items: true }
    });
  }

  async checkout(cartId: string, dto: CheckoutCartDto, idempotencyKey?: string, actor?: any) {
    const existing = await this.guardIdempotency(idempotencyKey, { cartId, dto }, actor, "pos/checkout");
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    // Reprice cart items using stored prices and tax
    const cart = await this.prisma.posCart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } }, payments: true }
    });
    if (!cart) throw new NotFoundException("Cart not found");
    if (cart.status !== PosCartStatus.open) throw new ConflictException("Cart not open");

    const expected = this.reprice(cart);
    const expectedTotal = expected.totalCents;
    const tenderTotal = dto.payments.reduce((sum, p) => sum + p.amountCents, 0);

    const delta = tenderTotal - expectedTotal;
    const tolerance = 1; // cents
    if (Math.abs(delta) > tolerance) {
      const resp = await this.prisma.posCart.update({
        where: { id: cartId },
        data: { needsReview: true },
        include: { items: true, payments: true }
      });
      const response = {
        cartId,
        status: "needs_review",
        reason: "tender_mismatch",
        cart: resp,
        expectedTotal,
        tenderTotal,
        delta,
        expectedBreakdown: expected
      };
      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, response);
      return response;
    }

    // If cash is present, ensure there is an open till session for this terminal
    const hasCash = dto.payments.some((p) => p.method === "cash");
    const cashTillSession = hasCash
      ? await this.till.findOpenSessionForTerminal(actor?.campgroundId ?? null, cart.terminalId)
      : null;
    if (hasCash && !cashTillSession) {
      throw new BadRequestException("No open till session for this terminal");
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Process stored value tenders first to catch insufficient balance early
        for (const p of dto.payments.filter((p) => p.method === "gift" || p.method === "store_credit")) {
          await this.storedValue.redeem(
            {
              code: dto.giftCode,
              amountCents: p.amountCents,
              currency: cart.currency,
              redeemCampgroundId: cart.campgroundId,
              referenceType: "pos_cart",
              referenceId: cartId
            },
            p.idempotencyKey,
            actor
          );
        }

        // Process guest wallet payments
        for (const p of dto.payments.filter((p) => p.method === "guest_wallet")) {
          if (!dto.guestId) {
            throw new BadRequestException("guestId required for guest wallet payment");
          }
          await this.guestWallet.debitForPayment(
            cart.campgroundId,
            {
              guestId: dto.guestId,
              walletId: p.walletId,
              amountCents: p.amountCents,
              currency: p.currency,
              referenceType: "pos_cart",
              referenceId: cartId
            },
            p.idempotencyKey,
            actor
          );
          // Record the payment
          await tx.posPayment.create({
            data: {
              cartId,
              method: p.method,
              amountCents: p.amountCents,
              currency: p.currency.toLowerCase(),
              status: PosPaymentStatus.succeeded,
              idempotencyKey: p.idempotencyKey,
              referenceType: p.referenceType ?? "guest_wallet",
              referenceId: p.referenceId ?? dto.guestId
            }
          });
        }

        // Process non-stored-value tenders
        for (const p of dto.payments.filter((p) => p.method !== "gift" && p.method !== "store_credit" && p.method !== "guest_wallet")) {
          if (p.method === "charge_to_site") {
            // Integrate with reservations AR/folio
            const reservationId = dto.reservationId ?? p.referenceId;
            if (!reservationId) {
              throw new BadRequestException("reservationId required for charge_to_site payment");
            }

            // Validate reservation exists and is active
            const reservation = await tx.reservation.findUnique({
              where: { id: reservationId },
              select: { id: true, status: true, siteId: true, guestName: true, site: { select: { name: true } } }
            });
            if (!reservation) {
              throw new BadRequestException("Reservation not found");
            }
            if (!["confirmed", "checked_in", "pending"].includes(reservation.status)) {
              throw new BadRequestException(`Cannot charge to site - reservation status is ${reservation.status}`);
            }

            // Create balanced ledger entries for the charge
            // SECURITY FIX: Use balanced entries (debit A/R, credit POS Revenue)
            await postBalancedLedgerEntries(tx, [
              {
                campgroundId: cart.campgroundId,
                reservationId,
                glCode: "AR",
                account: "Accounts Receivable",
                description: `POS charge from cart #${cartId.slice(-6)}`,
                amountCents: p.amountCents,
                direction: "debit" as const, // Debit increases guest balance owed
                dedupeKey: `pos_cart_${cartId}_${p.idempotencyKey}:debit`
              },
              {
                campgroundId: cart.campgroundId,
                reservationId,
                glCode: "POS_REVENUE",
                account: "POS Revenue",
                description: `POS charge from cart #${cartId.slice(-6)}`,
                amountCents: p.amountCents,
                direction: "credit" as const, // Credit recognizes revenue
                dedupeKey: `pos_cart_${cartId}_${p.idempotencyKey}:credit`
              }
            ]);

            // Update reservation balance
            await tx.reservation.update({
              where: { id: reservationId },
              data: {
                balanceAmount: { increment: p.amountCents },
                totalAmount: { increment: p.amountCents }
              }
            });

            // Record the payment as succeeded
            await tx.posPayment.create({
              data: {
                cartId,
                method: p.method,
                amountCents: p.amountCents,
                currency: p.currency.toLowerCase(),
                status: PosPaymentStatus.succeeded,
                idempotencyKey: p.idempotencyKey,
                referenceType: "reservation",
                referenceId: reservationId
              }
            });

            await this.audit.record({
              campgroundId: actor?.campgroundId ?? cart.campgroundId,
              actorId: actor?.id ?? null,
              action: "pos.payment.charge_to_site",
              entity: "reservation",
              entityId: reservationId,
              after: { cartId, amountCents: p.amountCents, siteName: reservation.site?.name }
            });

            continue;
          }

          if (p.method === "card") {
            const providerPayment = await this.providerIntegrations.routePayment(
              actor?.campgroundId ?? null,
              cart.terminalId ?? null,
              {
                amountCents: p.amountCents,
                currency: p.currency,
                idempotencyKey: p.idempotencyKey,
                cartId,
                metadata: { referenceType: p.referenceType, referenceId: p.referenceId }
              }
            );

            if (providerPayment) {
              const status =
                providerPayment.status === "succeeded"
                  ? PosPaymentStatus.succeeded
                  : providerPayment.status === "failed"
                  ? PosPaymentStatus.failed
                  : PosPaymentStatus.pending;

              await tx.posPayment.create({
                data: {
                  cartId,
                  method: p.method,
                  amountCents: p.amountCents,
                  currency: p.currency.toLowerCase(),
                  status,
                  idempotencyKey: p.idempotencyKey,
                  referenceType: p.referenceType,
                  referenceId: p.referenceId,
                  processorIds: providerPayment.processorIds ?? { provider: providerPayment.provider }
                }
              });

              // Post ledger entries for successful card payments via provider
              if (status === PosPaymentStatus.succeeded) {
                await postBalancedLedgerEntries(tx, [
                  {
                    campgroundId: cart.campgroundId,
                    glCode: "CASH",
                    account: "Cash",
                    description: `POS card payment (provider) for cart #${cartId.slice(-6)}`,
                    amountCents: p.amountCents,
                    direction: "debit" as const,
                    dedupeKey: `pos_card_${cartId}_${p.idempotencyKey}:debit`
                  },
                  {
                    campgroundId: cart.campgroundId,
                    glCode: "POS_REVENUE",
                    account: "POS Revenue",
                    description: `POS card payment (provider) for cart #${cartId.slice(-6)}`,
                    amountCents: p.amountCents,
                    direction: "credit" as const,
                    dedupeKey: `pos_card_${cartId}_${p.idempotencyKey}:credit`
                  }
                ]);
              }

              await this.audit.record({
                campgroundId: actor?.campgroundId ?? cart.campgroundId,
                actorId: actor?.id ?? null,
                action: "pos.payment.external",
                entity: "pos_cart",
                entityId: cartId,
                after: { provider: providerPayment.provider, status }
              });
              continue;
            }

            const stripeAccountId = process.env.STRIPE_ACCOUNT_ID;
            if (!this.stripe.isConfigured() || !stripeAccountId) {
              throw new BadRequestException("Card processing not configured");
            }
            // Create a payment intent via Stripe; Connect application fees omitted for now
            const intent = await this.stripe.createPaymentIntent(
              p.amountCents,
              p.currency.toLowerCase(),
              { cartId, source: "pos" },
              stripeAccountId,
              0,
              "automatic",
              undefined,
              p.idempotencyKey
            );

            // Map Stripe intent status to POS payment status
            let stripePaymentStatus: PosPaymentStatus;
            if (intent.status === "succeeded") {
              stripePaymentStatus = PosPaymentStatus.succeeded;
            } else if (intent.status === "canceled") {
              stripePaymentStatus = PosPaymentStatus.failed;
            } else {
              // requires_payment_method, requires_confirmation, requires_action,
              // processing, requires_capture - all kept as pending
              stripePaymentStatus = PosPaymentStatus.pending;
            }

            await tx.posPayment.create({
              data: {
                cartId,
                method: p.method,
                amountCents: p.amountCents,
                currency: p.currency.toLowerCase(),
                status: stripePaymentStatus,
                idempotencyKey: p.idempotencyKey,
                referenceType: p.referenceType,
                referenceId: p.referenceId,
                processorIds: { intentId: intent.id, clientSecret: intent.client_secret }
              }
            });

            // Only post ledger entries when payment actually succeeds
            if (stripePaymentStatus === PosPaymentStatus.succeeded) {
              await postBalancedLedgerEntries(tx, [
                {
                  campgroundId: cart.campgroundId,
                  glCode: "CASH",
                  account: "Cash",
                  description: `POS card payment (Stripe) for cart #${cartId.slice(-6)}`,
                  amountCents: p.amountCents,
                  direction: "debit" as const,
                  dedupeKey: `pos_stripe_${cartId}_${p.idempotencyKey}:debit`
                },
                {
                  campgroundId: cart.campgroundId,
                  glCode: "POS_REVENUE",
                  account: "POS Revenue",
                  description: `POS card payment (Stripe) for cart #${cartId.slice(-6)}`,
                  amountCents: p.amountCents,
                  direction: "credit" as const,
                  dedupeKey: `pos_stripe_${cartId}_${p.idempotencyKey}:credit`
                }
              ]);
            }

            // If payment requires client action, return early with pending status
            if (stripePaymentStatus === PosPaymentStatus.pending) {
              // Don't close the cart - keep it in current state for retry
              return {
                cartId,
                status: "pending_payment",
                paymentIntentId: intent.id,
                clientSecret: intent.client_secret,
                paymentStatus: intent.status,
                message: "Payment requires additional action",
                totalCents: expected.totalCents,
                breakdown: expected
              };
            }

            if (stripePaymentStatus === PosPaymentStatus.failed) {
              throw new BadRequestException("Card payment failed");
            }
            continue;
          }

          // Cash or other tenders: mark succeeded
          const payment = await tx.posPayment.create({
            data: {
              cartId,
              method: p.method,
              amountCents: p.amountCents,
              currency: p.currency.toLowerCase(),
              status: PosPaymentStatus.succeeded,
              idempotencyKey: p.idempotencyKey,
              referenceType: p.referenceType,
              referenceId: p.referenceId
            }
          });
          if (p.method === "cash" && cashTillSession) {
            await tx.tillMovement.create({
              data: {
                sessionId: cashTillSession.id,
                type: TillMovementType.cash_sale,
                amountCents: p.amountCents,
                currency: payment.currency,
                actorUserId: actor?.id,
                sourceCartId: cartId,
                note: `cart:${cartId}`
              }
            });
          }

          // Post ledger entries for cash and other payment methods
          await postBalancedLedgerEntries(tx, [
            {
              campgroundId: cart.campgroundId,
              glCode: "CASH",
              account: "Cash",
              description: `POS ${p.method} payment for cart #${cartId.slice(-6)}`,
              amountCents: p.amountCents,
              direction: "debit" as const,
              dedupeKey: `pos_${p.method}_${cartId}_${p.idempotencyKey}:debit`
            },
            {
              campgroundId: cart.campgroundId,
              glCode: "POS_REVENUE",
              account: "POS Revenue",
              description: `POS ${p.method} payment for cart #${cartId.slice(-6)}`,
              amountCents: p.amountCents,
              direction: "credit" as const,
              dedupeKey: `pos_${p.method}_${cartId}_${p.idempotencyKey}:credit`
            }
          ]);
        }

        await tx.posCart.update({
          where: { id: cartId },
          data: {
            status: PosCartStatus.checked_out,
            netCents: expected.netCents,
            taxCents: expected.taxCents,
            feeCents: expected.feeCents,
            grossCents: expected.totalCents,
            needsReview: false
          }
        });

        return {
          cartId,
          status: "checked_out",
          totalCents: expected.totalCents,
          breakdown: expected
        };
      });

      const receiptEmail = actor?.email ?? actor?.guestEmail ?? null;
      if (receiptEmail) {
        try {
          const lineItems = (cart.items ?? []).map((i: any) => ({
            label: i?.product?.name ?? i.productId,
            amountCents: i.totalCents ?? 0
          }));
          await this.email.sendPaymentReceipt({
            guestEmail: receiptEmail,
            guestName: actor?.name ?? actor?.displayName ?? "Guest",
            campgroundName: actor?.campgroundName ?? "Campground",
            amountCents: expected.totalCents,
            paymentMethod: dto.payments.map((p) => p.method).join(", "),
            source: "pos",
            lineItems,
            taxCents: expected.taxCents,
            feeCents: expected.feeCents,
            totalCents: expected.totalCents,
            kind: "pos"
          });
        } catch (emailErr) {
          this.logger.warn(`POS receipt email failed for cart ${cartId}: ${emailErr}`);
        }
      }

      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
      return result;
    } catch (err) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  async replayOffline(dto: OfflineReplayDto, idempotencyKey?: string, actor?: any) {
    const started = Date.now();
    const scope = this.scopeKey(actor);

    if (dto.clientTxId) {
      const seqExisting = await this.idempotency.findBySequence(scope, "pos/offline/replay", dto.clientTxId);
      if (seqExisting?.responseJson) {
        this.logger.warn(`Duplicate offline replay detected for seq ${dto.clientTxId} scope ${scope}`);
        return seqExisting.responseJson;
      }
      if (seqExisting?.status === IdempotencyStatus.inflight) {
        throw new ConflictException("Replay already in progress");
      }
      if (seqExisting) {
        this.logger.warn(`Replay seq ${dto.clientTxId} already processed without snapshot for scope ${scope}`);
      }
    }

    const existing = await this.guardIdempotency(idempotencyKey, dto, actor, "pos/offline/replay", dto.clientTxId, dto.recordedTotalsHash);
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    // Best-effort reprice using server cart if provided
    const cartId = (dto.payload as any)?.cartId as string | undefined;
    if (!cartId) {
      const response = {
        clientTxId: dto.clientTxId,
        status: "needs_review",
        reason: "missing_cart_id",
        recordedTotalsHash: dto.recordedTotalsHash
      };
      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, response);
      return response;
    }

    const cart = await this.prisma.posCart.findUnique({
      where: { id: cartId },
      include: { items: true }
    });
    if (!cart) {
      const response = { clientTxId: dto.clientTxId, status: "needs_review", reason: "cart_not_found" };
      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, response);
      return response;
    }

    const expected = this.reprice(cart);
    const expectedHash = this.hashTotals(expected);

    if (!dto.recordedTotalsHash) {
      const response = {
        clientTxId: dto.clientTxId,
        status: "needs_review",
        reason: "missing_recorded_totals_hash",
        cartId,
        expectedBreakdown: expected,
        expectedHash
      };
      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, response);
      return response;
    }

    const matches = dto.recordedTotalsHash === expectedHash;
    const response = matches
      ? {
          clientTxId: dto.clientTxId,
          status: "accepted",
          cartId,
          expectedBreakdown: expected
        }
      : {
          clientTxId: dto.clientTxId,
          status: "needs_review",
          reason: "totals_mismatch",
          cartId,
          expectedBreakdown: expected,
          expectedHash,
          recordedTotalsHash: dto.recordedTotalsHash
        };

    if (response.status === "needs_review") {
      await this.prisma.posCart.update({ where: { id: cartId }, data: { needsReview: true } }).catch(() => null);
    }

    const payloadHash = dto.payload ? crypto.createHash("sha256").update(JSON.stringify(dto.payload)).digest("hex") : undefined;
    const tender = this.extractTender(dto.payload);
    const items = this.extractItems(dto.payload);

    // Persist offline replay for reconciliation / review
    try {
      const offlineId = dto.clientTxId ? `offline_${dto.clientTxId}` : undefined;
      if (offlineId) {
        await this.prisma.posOfflineReplay.upsert({
          where: { id: offlineId },
          update: {
            recordedTotalsHash: dto.recordedTotalsHash ?? null,
            expectedHash,
            payloadHash,
            status: response.status,
            reason: (response as any).reason ?? null,
            payload: dto.payload as any,
            tender: tender as any,
            items: items as any,
            expectedBreakdown: expected as any,
            campgroundId: actor?.campgroundId ?? null,
            cartId
          },
          create: {
            id: offlineId,
            clientTxId: dto.clientTxId ?? null,
            cartId,
            campgroundId: actor?.campgroundId ?? null,
            recordedTotalsHash: dto.recordedTotalsHash ?? null,
            expectedHash,
            payloadHash,
            status: response.status,
            reason: (response as any).reason ?? null,
            payload: dto.payload as any,
            tender: tender as any,
            items: items as any,
            expectedBreakdown: expected as any
          }
        } as any);
      } else {
        await this.prisma.posOfflineReplay.create({
          data: {
            clientTxId: dto.clientTxId ?? null,
            cartId,
            campgroundId: actor?.campgroundId ?? null,
            recordedTotalsHash: dto.recordedTotalsHash ?? null,
            expectedHash,
            payloadHash,
            status: response.status,
            reason: (response as any).reason ?? null,
            payload: dto.payload as any,
            tender: tender as any,
            items: items as any,
            expectedBreakdown: expected as any
          }
        } as any);
      }
    } catch (persistErr) {
      this.logger.warn(`Failed to persist offline replay ${dto.clientTxId ?? "unknown"}: ${persistErr}`);
    }

    if (idempotencyKey) await this.idempotency.complete(idempotencyKey, response);
    this.observability.recordOfflineReplay(response.status === "accepted", Date.now() - started, {
      clientTxId: dto.clientTxId,
      cartId,
      status: response.status,
      campgroundId: actor?.campgroundId ?? null
    });
    return response;
  }

  async createReturn(dto: CreateReturnDto, idempotencyKey?: string, actor?: any) {
    const existing = await this.guardIdempotency(idempotencyKey, dto, actor, "pos/returns");
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    const cart = await this.prisma.posCart.findUnique({
      where: { id: dto.originalCartId },
      include: { items: true }
    });
    if (!cart) throw new NotFoundException("Original cart not found");
    if (cart.status !== PosCartStatus.checked_out) throw new ConflictException("Only checked out carts can be returned");

    // Choose items to reverse
    const itemsToReverse = dto.items?.length
      ? cart.items.filter((i) => dto.items?.some((sel) => sel.cartItemId === i.id))
      : cart.items;

    if (!itemsToReverse.length) {
      throw new BadRequestException("No items to return");
    }

    // Compute reversal totals (best-effort; assumes per-line tax/fee stored)
    let net = 0;
    let tax = 0;
    let fee = 0;
    let gross = 0;
    const details: any[] = [];
    for (const item of itemsToReverse) {
      const sel = dto.items?.find((s) => s.cartItemId === item.id);
      const qty = sel?.qty ?? item.qty ?? 1;
      const unit = item.unitPriceCents ?? (item.totalCents && item.qty ? item.totalCents / item.qty : item.totalCents);
      const lineNet = unit * qty;
      const lineTax = (item.taxCents ?? 0) * (qty / (item.qty || qty));
      const lineFee = (item.feeCents ?? 0) * (qty / (item.qty || qty));
      const lineTotal = lineNet + lineTax + lineFee;
      net += lineNet;
      tax += lineTax;
      fee += lineFee;
      gross += lineTotal;
      details.push({ cartItemId: item.id, qty, lineNet, lineTax, lineFee, lineTotal });
    }

    const returnRecord = await this.prisma.posReturn.create({
      data: {
        originalCartId: cart.id,
        status: "pending",
        reasonCode: dto.reasonCode,
        restock: dto.restock ?? false,
        netCents: Math.round(net),
        taxCents: Math.round(tax),
        feeCents: Math.round(fee),
        grossCents: Math.round(gross)
      }
    });

    const response = {
      status: "needs_review",
      reason: "return_pending_refund",
      originalCartId: cart.id,
      returnId: returnRecord.id,
      totals: {
        netCents: Math.round(net),
        taxCents: Math.round(tax),
        feeCents: Math.round(fee),
        grossCents: Math.round(gross)
      },
      items: details
    };

    if (idempotencyKey) await this.idempotency.complete(idempotencyKey, response);
    return response;
  }

  /**
   * Scan a product for POS - handles batch tracking, expiration, and markdown calculation.
   * Returns pricing info including any applicable markdowns for expiring items.
   *
   * @param allowExpired If true, allows selling expired items (requires manager override)
   */
  async scanProduct(
    campgroundId: string,
    productId: string,
    locationId: string | null,
    qty: number = 1,
    options?: { allowExpired?: boolean; existingPromoDiscountCents?: number }
  ): Promise<{
    productId: string;
    productName: string;
    sku: string | null;
    basePriceCents: number;
    effectivePriceCents: number;
    qty: number;
    // Batch tracking info
    useBatchTracking: boolean;
    batchId: string | null;
    expirationDate: Date | null;
    daysUntilExpiration: number | null;
    expirationTier: ExpirationTier | null;
    // Markdown info
    markdownApplied: boolean;
    markdownRuleId: string | null;
    originalPriceCents: number;
    markdownDiscountCents: number;
    discountSource: "markdown" | "promotion" | "none";
    // Warning flags
    isExpired: boolean;
    requiresOverride: boolean;
    warningMessage: string | null;
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sku: true,
        priceCents: true,
        useBatchTracking: true,
        trackInventory: true,
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const basePriceCents = product.priceCents;
    let batchId: string | null = null;
    let expirationDate: Date | null = null;
    let daysUntilExpiration: number | null = null;
    let expirationTier: ExpirationTier | null = null;
    let isExpired = false;
    let requiresOverride = false;
    let warningMessage: string | null = null;

    // Handle batch-tracked products
    if (product.useBatchTracking) {
      try {
        // Preview FEFO allocation to determine which batch will be used
        const allocations = await this.batchInventory.allocateFEFO(
          productId,
          locationId,
          qty,
          { previewOnly: true, allowExpired: options?.allowExpired }
        );

        if (allocations.length > 0) {
          const primaryBatch = allocations[0];
          batchId = primaryBatch.batchId;
          expirationDate = primaryBatch.expirationDate;
          daysUntilExpiration = primaryBatch.daysUntilExpiration;

          // Determine expiration tier
          if (expirationDate) {
            expirationTier = await this.batchInventory.getExpirationTier({
              productId,
              expirationDate,
            });

            isExpired = expirationTier === ExpirationTier.expired;

            if (isExpired && !options?.allowExpired) {
              requiresOverride = true;
              warningMessage = `Item expired on ${expirationDate.toLocaleDateString()}. Manager override required.`;
            } else if (expirationTier === ExpirationTier.critical) {
              warningMessage = `Item expires in ${daysUntilExpiration} day(s). Consider markdown.`;
            } else if (expirationTier === ExpirationTier.warning) {
              warningMessage = `Item approaching expiration (${daysUntilExpiration} days).`;
            }
          }
        }
      } catch (error) {
        if (error instanceof ExpiredBatchException) {
          isExpired = true;
          requiresOverride = true;
          warningMessage = error.message;
        } else {
          throw error;
        }
      }
    }

    // Calculate markdown (only if we have a batch with expiration)
    let markdownApplied = false;
    let markdownRuleId: string | null = null;
    let markdownDiscountCents = 0;
    let discountSource: "markdown" | "promotion" | "none" = "none";
    let effectivePriceCents = basePriceCents;

    if (batchId) {
      const bestDiscount = await this.markdownRules.getBestDiscount(
        campgroundId,
        productId,
        batchId,
        basePriceCents,
        options?.existingPromoDiscountCents ?? 0
      );

      discountSource = bestDiscount.source;

      if (bestDiscount.source === "markdown") {
        markdownApplied = true;
        markdownRuleId = bestDiscount.markdownRuleId;
        markdownDiscountCents = bestDiscount.discountCents;
        effectivePriceCents = basePriceCents - markdownDiscountCents;
      } else if (bestDiscount.source === "promotion") {
        // Promotion wins - keep base price, let promotion system handle discount
        effectivePriceCents = basePriceCents - bestDiscount.discountCents;
      }
    }

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      basePriceCents,
      effectivePriceCents,
      qty,
      useBatchTracking: product.useBatchTracking,
      batchId,
      expirationDate,
      daysUntilExpiration,
      expirationTier,
      markdownApplied,
      markdownRuleId,
      originalPriceCents: basePriceCents,
      markdownDiscountCents,
      discountSource,
      isExpired,
      requiresOverride,
      warningMessage,
    };
  }

  /**
   * Add item to cart with batch tracking and markdown support.
   * This is the recommended method for POS item addition.
   */
  async addItemToCart(
    cartId: string,
    productId: string,
    qty: number,
    actor: any,
    options?: {
      overridePriceCents?: number;
      allowExpired?: boolean;
      existingPromoDiscountCents?: number;
    }
  ) {
    const cart = await this.prisma.posCart.findUnique({
      where: { id: cartId },
      select: { id: true, campgroundId: true, terminalId: true },
    });

    if (!cart) throw new NotFoundException("Cart not found");

    // Get terminal's location if available
    const terminal = cart.terminalId
      ? await this.prisma.posTerminal.findUnique({
          where: { id: cart.terminalId },
          select: { locationId: true },
        })
      : null;

    const locationId = terminal?.locationId ?? null;

    // Scan product to get batch/markdown info
    const scanResult = await this.scanProduct(
      cart.campgroundId,
      productId,
      locationId,
      qty,
      {
        allowExpired: options?.allowExpired,
        existingPromoDiscountCents: options?.existingPromoDiscountCents,
      }
    );

    // Block expired items unless override is provided
    if (scanResult.requiresOverride && !options?.allowExpired) {
      return {
        success: false,
        error: "EXPIRED_ITEM_REQUIRES_OVERRIDE",
        message: scanResult.warningMessage,
        scanResult,
      };
    }

    // Determine final unit price
    const unitPriceCents = options?.overridePriceCents ?? scanResult.effectivePriceCents;
    const totalCents = unitPriceCents * qty;

    // Create cart item with batch/markdown metadata
    const cartItem = await this.prisma.posCartItem.create({
      data: {
        cartId,
        productId,
        qty,
        unitPriceCents,
        totalCents,
        // Batch tracking fields
        batchId: scanResult.batchId,
        // Markdown tracking fields
        markdownApplied: scanResult.markdownApplied,
        markdownRuleId: scanResult.markdownRuleId,
        originalPriceCents: scanResult.basePriceCents,
        markdownDiscountCents: scanResult.markdownDiscountCents,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    });

    // Record markdown application if applicable (for reporting)
    if (scanResult.markdownApplied && scanResult.markdownRuleId && scanResult.batchId) {
      try {
        await this.markdownRules.recordMarkdownApplication(
          cart.campgroundId,
          scanResult.markdownRuleId,
          scanResult.batchId,
          cartId,
          scanResult.basePriceCents,
          scanResult.effectivePriceCents,
          qty,
          scanResult.daysUntilExpiration ?? 0
        );
      } catch (err) {
        this.logger.warn(`Failed to record markdown application: ${err}`);
      }
    }

    return {
      success: true,
      cartItem,
      scanResult,
      warning: scanResult.warningMessage,
    };
  }

  private scopeKey(actor?: any) {
    return actor?.tenantId ?? actor?.campgroundId ?? "global";
  }

  private async guardIdempotency(
    key?: string,
    body?: any,
    actor?: any,
    endpoint?: string,
    sequence?: string | number | null,
    checksum?: string | null
  ) {
    if (!key) return null;
    return this.idempotency.start(key, body ?? {}, actor?.campgroundId ?? null, {
      tenantId: actor?.tenantId ?? null,
      endpoint,
      sequence,
      rateAction: "apply",
      checksum: checksum ?? undefined,
      requestBody: body ?? {}
    });
  }

  /**
   * Reprice cart items and calculate totals with tax
   */
  private reprice(cart: { items: { totalCents: number; qty?: number; unitPriceCents?: number; taxCents?: number; feeCents?: number }[] }) {
    let net = 0;
    let tax = 0;
    let fee = 0;
    for (const i of cart.items) {
      const base = i.unitPriceCents && i.qty ? i.unitPriceCents * i.qty : i.totalCents;
      net += base;
      tax += i.taxCents ?? 0;
      fee += i.feeCents ?? 0;
    }
    return { netCents: net, taxCents: tax, feeCents: fee, totalCents: net + tax + fee };
  }

  /**
   * Calculate tax for POS items using campground tax rules
   */
  async calculatePosTax(campgroundId: string, subtotalCents: number): Promise<{ taxCents: number; breakdown: Array<{ name: string; rate: number; amount: number }> }> {
    const taxRules = await this.prisma.taxRule.findMany({
      where: {
        campgroundId,
        isActive: true,
        category: { in: ['general', 'goods', 'services'] }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (taxRules.length === 0) {
      return { taxCents: 0, breakdown: [] };
    }

    let totalTax = 0;
    const breakdown: Array<{ name: string; rate: number; amount: number }> = [];

    for (const rule of taxRules) {
      let taxAmount = 0;

      if (rule.type === 'percentage' && rule.rate) {
        const rate = Number(rule.rate);
        taxAmount = Math.round(subtotalCents * rate);
        if (taxAmount > 0) {
          breakdown.push({ name: rule.name, rate: rate * 100, amount: taxAmount });
        }
      } else if (rule.type === 'flat' && rule.rate) {
        taxAmount = Math.round(Number(rule.rate) * 100);
        if (taxAmount > 0) {
          breakdown.push({ name: rule.name, rate: 0, amount: taxAmount });
        }
      }

      totalTax += taxAmount;
    }

    return { taxCents: totalTax, breakdown };
  }

  private extractTender(payload: any) {
    const payments = Array.isArray(payload?.payments) ? payload.payments : [];
    return payments.map((p: any) => ({
      method: p?.method ?? p?.type ?? "unknown",
      amountCents: p?.amountCents ?? p?.amount ?? 0,
      referenceId: p?.referenceId ?? p?.id ?? null,
      tipCents: p?.tipCents ?? 0
    }));
  }

  private extractItems(payload: any) {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((i: any) => ({
      productId: i?.productId ?? i?.id ?? null,
      qty: i?.qty ?? 1,
      unitPriceCents: i?.unitPriceCents ?? null,
      taxCents: i?.taxCents ?? 0,
      feeCents: i?.feeCents ?? 0,
      totalCents: i?.totalCents ?? i?.amountCents ?? 0,
      description: i?.name ?? i?.description ?? null
    }));
  }

  private hashTotals(breakdown: { netCents: number; taxCents: number; feeCents: number; totalCents: number }) {
    const json = JSON.stringify(breakdown);
    return crypto.createHash("sha256").update(json).digest("hex");
  }
}
