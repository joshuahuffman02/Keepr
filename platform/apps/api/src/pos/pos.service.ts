import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { CheckoutCartDto, CreateCartDto, OfflineReplayDto, UpdateCartDto, CreateReturnDto } from "./pos.dto";
import { IdempotencyStatus, PosCartStatus, PosPaymentStatus, TillMovementType } from "@prisma/client";
import { StoredValueService } from "../stored-value/stored-value.service";
import { StripeService } from "../payments/stripe.service";
import crypto from "crypto";
import { TillService } from "./till.service";
import { ObservabilityService } from "../observability/observability.service";
import { PosProviderService } from "./pos-provider.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly storedValue: StoredValueService,
    private readonly stripe: StripeService,
    private readonly till: TillService,
    private readonly observability: ObservabilityService,
    private readonly providerIntegrations: PosProviderService,
    private readonly audit: AuditService,
    private readonly email: EmailService
  ) {}

  async createCart(dto: CreateCartDto, actor: any) {
    // TODO: pricing/tax versions; create items
    return this.prisma.posCart.create({
      data: {
        campgroundId: actor?.campgroundId,
        terminalId: dto.terminalId,
        currency: actor?.currency ?? "usd",
        pricingVersion: dto.pricingVersion,
        taxVersion: dto.taxVersion,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            unitPriceCents: item.overridePriceCents ?? 0,
            totalCents: (item.overridePriceCents ?? 0) * item.qty
          }))
        }
      },
      include: { items: true }
    });
  }

  async updateCart(cartId: string, dto: UpdateCartDto, actor: any) {
    // Minimal stub; real implementation should validate ownership and recompute totals
    const ops: any = {};
    if (dto.add) {
      ops.create = dto.add.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        unitPriceCents: item.overridePriceCents ?? 0,
        totalCents: (item.overridePriceCents ?? 0) * item.qty
      }));
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
      data: {
        items: ops
      },
      include: { items: true }
    });
  }

  async checkout(cartId: string, dto: CheckoutCartDto, idempotencyKey?: string, actor?: any) {
    const existing = await this.guardIdempotency(idempotencyKey, { cartId, dto }, actor, "pos/checkout");
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    // Basic reprice: TODO replace with real pricing/tax engines
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
              referenceType: "pos_cart",
              referenceId: cartId
            },
            p.idempotencyKey,
            actor
          );
        }

        // Process non-stored-value tenders
        for (const p of dto.payments.filter((p) => p.method !== "gift" && p.method !== "store_credit")) {
          if (p.method === "charge_to_site") {
            // TODO: integrate with reservations AR/folio; mark pending for now
            await tx.posPayment.create({
              data: {
                cartId,
                method: p.method,
                amountCents: p.amountCents,
                currency: p.currency.toLowerCase(),
                status: PosPaymentStatus.pending,
                idempotencyKey: p.idempotencyKey,
                referenceType: p.referenceType,
                referenceId: p.referenceId
              }
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
            await tx.posPayment.create({
              data: {
                cartId,
                method: p.method,
                amountCents: p.amountCents,
                currency: p.currency.toLowerCase(),
                status: PosPaymentStatus.succeeded,
                idempotencyKey: p.idempotencyKey,
                referenceType: p.referenceType,
                referenceId: p.referenceId,
                processorIds: { intentId: intent.id }
              }
            });
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

  // TODO: Replace with full pricing/tax/fee engine
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
