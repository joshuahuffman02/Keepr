import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { IssueStoredValueDto, RedeemStoredValueDto, AdjustStoredValueDto, ReloadStoredValueDto, RefundStoredValueDto, VoidStoredValueDto } from "./stored-value.dto";
import { IdempotencyStatus, StoredValueDirection, StoredValueStatus, TaxRuleType } from "@prisma/client";
import crypto from "crypto";
import { ObservabilityService } from "../observability/observability.service";

@Injectable()
export class StoredValueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly observability: ObservabilityService
  ) {}

  async issue(dto: IssueStoredValueDto, idempotencyKey?: string, actor?: any) {
    const scope = { campgroundId: actor?.campgroundId ?? dto.tenantId ?? null, tenantId: actor?.tenantId ?? dto.tenantId ?? null };
    const existing = await this.guardIdempotency(
      idempotencyKey,
      dto,
      scope,
      "stored-value/issue",
      dto.referenceId ?? dto.code ?? dto.customerId ?? null
    );
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    const issuerCampgroundId = scope.campgroundId ?? dto.tenantId ?? null;
    const now = new Date();
    const issueScope = await this.resolveIssueScope(issuerCampgroundId, dto);

    try {
      await this.validateTaxableLoad(issuerCampgroundId, dto.taxableLoad);
      const result = await this.prisma.$transaction(async (tx: any) => {
        const codeValue = dto.code || this.generateCode();
        const pinValue = dto.codeOptions?.pin || this.generatePinIfRequested(dto.codeOptions);

        const existingAccount = dto.reloadAccountId
          ? await tx.storedValueAccount.findUnique({ where: { id: dto.reloadAccountId } })
          : null;
        if (existingAccount) {
          this.ensureActive(existingAccount);
          this.ensureCurrency(existingAccount, dto.currency);
          this.ensureTaxableFlag(existingAccount.metadata, dto.taxableLoad);
          this.ensureScopeMatches(existingAccount, issueScope);
        }

        const account =
          existingAccount ??
          (await tx.storedValueAccount.create({
            data: {
              campgroundId: issuerCampgroundId ?? dto.tenantId,
              scopeType: issueScope.scopeType,
              scopeId: issueScope.scopeId,
              type: dto.type,
              currency: dto.currency.toLowerCase(),
              status: StoredValueStatus.active,
              issuedAt: now,
              expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
              createdBy: actor?.id,
              createdVia: "api",
              metadata: this.mergeMetadata(dto.metadata, dto.taxableLoad)
            }
          }));

        if (codeValue) {
          await tx.storedValueCode.create({
            data: {
              accountId: account.id,
              code: codeValue,
              pinHash: pinValue ? this.hashPin(pinValue) : undefined
            }
          });
        }

        const { balanceCents: currentBalance } = await this.getBalances(tx, account.id);
        const before = currentBalance;
        const after = before + dto.amountCents;

        await tx.storedValueLedger.create({
          data: {
            campgroundId: account.campgroundId,
            issuerCampgroundId: account.campgroundId,
            scopeType: issueScope.scopeType,
            scopeId: issueScope.scopeId,
            accountId: account.id,
            direction: StoredValueDirection.issue,
            amountCents: dto.amountCents,
            currency: dto.currency.toLowerCase(),
            beforeBalanceCents: before,
            afterBalanceCents: after,
            referenceType: "stored_value_issue",
            referenceId: account.id,
            idempotencyKey: idempotencyKey ?? `issue-${account.id}-${now.getTime()}`,
            actorType: actor?.role,
            actorId: actor?.id,
            channel: dto.metadata?.channel ?? "staff",
            reason: dto.taxableLoad ? "taxable_load" : "nontaxable_load"
          }
        });

        return {
          accountId: account.id,
          balanceCents: after,
          expiresAt: account.expiresAt,
          code: codeValue,
          pinRequired: Boolean(pinValue),
          pin: dto.codeOptions?.pin ? undefined : pinValue // only return generated pins, never echo provided
        };
      });

      if (dto.taxableLoad) {
        await this.assertLiabilityRollForward(issuerCampgroundId);
      }

      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
      return result;
    } catch (err) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  async reload(dto: ReloadStoredValueDto, idempotencyKey?: string, actor?: any) {
    const scope = { campgroundId: actor?.campgroundId ?? null, tenantId: actor?.tenantId ?? null };
    const existing = await this.guardIdempotency(
      idempotencyKey,
      dto,
      scope,
      "stored-value/reload",
      dto.referenceId ?? dto.accountId
    );
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    const account = await this.prisma.storedValueAccount.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException("Account not found");
    this.ensureActive(account);
    this.ensureCurrency(account, dto.currency);
    this.ensureTaxableFlag(account.metadata, dto.taxableLoad);
    const accountScope = this.normalizeScope(account);
    const transactionCampgroundId = actor?.campgroundId ?? account.campgroundId;

    const now = new Date();

    try {
      await this.validateTaxableLoad(scope.campgroundId ?? account.campgroundId ?? null, dto.taxableLoad);
      const result = await this.prisma.$transaction(async (tx: any) => {
        const { balanceCents } = await this.getBalances(tx, account.id);
        const after = balanceCents + dto.amountCents;

        await tx.storedValueLedger.create({
          data: {
            campgroundId: transactionCampgroundId,
            issuerCampgroundId: account.campgroundId,
            scopeType: accountScope.scopeType,
            scopeId: accountScope.scopeId,
            accountId: account.id,
            direction: StoredValueDirection.issue,
            amountCents: dto.amountCents,
            currency: account.currency,
            beforeBalanceCents: balanceCents,
            afterBalanceCents: after,
            referenceType: dto.referenceType ?? "stored_value_reload",
            referenceId: dto.referenceId ?? dto.accountId,
            idempotencyKey: idempotencyKey ?? `reload-${account.id}-${now.getTime()}`,
            actorType: actor?.role,
            actorId: actor?.id,
            channel: "staff",
            reason: dto.taxableLoad ? "taxable_load" : "nontaxable_load"
          }
        });

        return { accountId: account.id, balanceCents: after };
      });

      if (dto.taxableLoad) {
        await this.assertLiabilityRollForward(scope.campgroundId ?? account.campgroundId ?? null);
      }

      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
      return result;
    } catch (err) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  async redeem(dto: RedeemStoredValueDto, idempotencyKey?: string, actor?: any) {
    const started = Date.now();
    const scope = { campgroundId: actor?.campgroundId ?? null, tenantId: actor?.tenantId ?? null };
    const existing = await this.guardIdempotency(idempotencyKey, dto, scope, "stored-value/redeem", `${dto.referenceType}:${dto.referenceId}`);
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    const account = await this.getAccount(dto);
    this.ensureActive(account);
    this.ensureCurrency(account, dto.currency);
    let redeemContext: { transactionCampgroundId: string; scopeType: string; scopeId: string | null } | null = null;

    try {
      const context = await this.resolveRedeemContext(account, dto.redeemCampgroundId, actor);
      redeemContext = context;
      const result = await this.prisma.$transaction(async (tx: any) => {
        const { balanceCents, availableCents } = await this.getBalances(tx, account.id);

        if (!dto.holdOnly && availableCents < dto.amountCents) {
          throw new BadRequestException("Insufficient balance");
        }

        if (!dto.holdOnly) {
          const alreadyRedeemed = await tx.storedValueLedger.findFirst({
            where: {
              accountId: account.id,
              referenceType: dto.referenceType,
              referenceId: dto.referenceId,
              direction: StoredValueDirection.redeem
            }
          });
          if (alreadyRedeemed) {
            throw new ConflictException("Gift card already redeemed for this reference");
          }
        }

        if (dto.holdOnly) {
          const hold = await tx.storedValueHold.create({
            data: {
              accountId: account.id,
              amountCents: dto.amountCents,
              status: "open",
              expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min default
              referenceType: dto.referenceType,
              referenceId: dto.referenceId,
              idempotencyKey: idempotencyKey ?? `hold-${account.id}-${Date.now()}`
            }
          });
          return { accountId: account.id, availableCents: availableCents - dto.amountCents, holdId: hold.id };
        }

        const before = balanceCents;
        const after = before - dto.amountCents;

        await tx.storedValueLedger.create({
          data: {
            campgroundId: context.transactionCampgroundId,
            issuerCampgroundId: account.campgroundId,
            scopeType: context.scopeType,
            scopeId: context.scopeId,
            accountId: account.id,
            direction: StoredValueDirection.redeem,
            amountCents: dto.amountCents,
            currency: account.currency,
            beforeBalanceCents: before,
            afterBalanceCents: after,
            referenceType: dto.referenceType,
            referenceId: dto.referenceId,
            idempotencyKey: idempotencyKey ?? `redeem-${account.id}-${Date.now()}`,
            actorType: actor?.role,
            actorId: actor?.id,
            channel: dto.channel ?? "pos"
          }
        });

        return { accountId: account.id, balanceCents: after };
      });

      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
      this.observability.recordRedeemOutcome(true, Date.now() - started, {
        campgroundId: redeemContext.transactionCampgroundId ?? actor?.campgroundId ?? dto.referenceId,
        referenceType: dto.referenceType,
      });
      return result;
    } catch (err) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      this.observability.recordRedeemOutcome(false, Date.now() - started, {
        error: (err as any)?.message ?? "redeem_failed",
        campgroundId: redeemContext?.transactionCampgroundId ?? actor?.campgroundId ?? dto.referenceId,
      });
      throw err;
    }
  }

  async captureHold(holdId: string, idempotencyKey?: string, actor?: any) {
    const scope = { campgroundId: actor?.campgroundId ?? null, tenantId: actor?.tenantId ?? null };
    const existing = await this.guardIdempotency(idempotencyKey, { holdId }, scope, "stored-value/hold-capture");
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    const hold = await this.prisma.storedValueHold.findUnique({ where: { id: holdId } });
    if (!hold) throw new NotFoundException("Hold not found");
    if (hold.status !== "open") throw new ConflictException("Hold not open");
    if (hold.expiresAt < new Date()) throw new ConflictException("Hold expired");

    const account = await this.prisma.storedValueAccount.findUnique({ where: { id: hold.accountId } });
    if (!account) throw new NotFoundException("Account not found");
    this.ensureActive(account);
    const accountScope = this.normalizeScope(account);
    const transactionCampgroundId = actor?.campgroundId ?? account.campgroundId;

    try {
      const result = await this.prisma.$transaction(async (tx: any) => {
        const { balanceCents, availableCents } = await this.getBalances(tx, account.id);
        // hold already counted as open; available excludes it. Capture should not double subtract.
        if (availableCents < 0) throw new BadRequestException("Insufficient available balance");

        const before = balanceCents;
        const after = before - hold.amountCents;

        await tx.storedValueLedger.create({
          data: {
            campgroundId: transactionCampgroundId,
            issuerCampgroundId: account.campgroundId,
            scopeType: accountScope.scopeType,
            scopeId: accountScope.scopeId,
            accountId: account.id,
            direction: StoredValueDirection.hold_capture,
            amountCents: hold.amountCents,
            currency: account.currency,
            beforeBalanceCents: before,
            afterBalanceCents: after,
            referenceType: hold.referenceType,
            referenceId: hold.referenceId,
            idempotencyKey: idempotencyKey ?? `hold-capture-${hold.id}`,
            actorType: actor?.role,
            actorId: actor?.id
          }
        });

        await tx.storedValueHold.update({
          where: { id: hold.id },
          data: { status: "captured" }
        });

        return { accountId: account.id, balanceCents: after };
      });

      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
      return result;
    } catch (err) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  async refundToCredit(dto: RefundStoredValueDto, idempotencyKey?: string, actor?: any) {
    const scope = { campgroundId: actor?.campgroundId ?? null, tenantId: actor?.tenantId ?? null };
    const existing = await this.guardIdempotency(
      idempotencyKey,
      dto,
      scope,
      "stored-value/refund",
      dto.referenceId ?? `${dto.accountId}:${dto.amountCents}`
    );
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    const account = await this.prisma.storedValueAccount.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException("Account not found");
    this.ensureActive(account);
    const accountScope = this.normalizeScope(account);
    const transactionCampgroundId = actor?.campgroundId ?? account.campgroundId;
    this.ensureCurrency(account, dto.currency);

    try {
      const result = await this.prisma.$transaction(async (tx: any) => {
        const { balanceCents } = await this.getBalances(tx, account.id);
        const after = balanceCents + dto.amountCents;
        await tx.storedValueLedger.create({
          data: {
            campgroundId: transactionCampgroundId,
            issuerCampgroundId: account.campgroundId,
            scopeType: accountScope.scopeType,
            scopeId: accountScope.scopeId,
            accountId: account.id,
            direction: StoredValueDirection.refund,
            amountCents: dto.amountCents,
            currency: account.currency,
            beforeBalanceCents: balanceCents,
            afterBalanceCents: after,
            referenceType: dto.referenceType ?? "stored_value_refund",
            referenceId: dto.referenceId ?? dto.accountId,
            idempotencyKey: idempotencyKey ?? `refund-${account.id}-${Date.now()}`,
            actorType: actor?.role,
            actorId: actor?.id,
            reason: "refund_to_credit"
          }
        });
        return { accountId: account.id, balanceCents: after };
      });
      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
      return result;
    } catch (err) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  async voidOrChargeback(dto: VoidStoredValueDto, idempotencyKey?: string, actor?: any) {
    const scope = { campgroundId: actor?.campgroundId ?? null, tenantId: actor?.tenantId ?? null };
    const existing = await this.guardIdempotency(idempotencyKey, dto, scope, "stored-value/void", dto.referenceId ?? dto.accountId);
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    const account = await this.prisma.storedValueAccount.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException("Account not found");
    const accountScope = this.normalizeScope(account);
    const transactionCampgroundId = actor?.campgroundId ?? account.campgroundId;

    try {
      const result = await this.prisma.$transaction(async (tx: any) => {
        const { balanceCents } = await this.getBalances(tx, account.id);
        if (balanceCents <= 0) {
          await tx.storedValueAccount.update({ where: { id: account.id }, data: { status: StoredValueStatus.frozen } });
          return { accountId: account.id, balanceCents };
        }

        await tx.storedValueLedger.create({
          data: {
            campgroundId: transactionCampgroundId,
            issuerCampgroundId: account.campgroundId,
            scopeType: accountScope.scopeType,
            scopeId: accountScope.scopeId,
            accountId: account.id,
            direction: StoredValueDirection.expire,
            amountCents: balanceCents,
            currency: account.currency,
            beforeBalanceCents: balanceCents,
            afterBalanceCents: 0,
            referenceType: "void_or_chargeback",
            referenceId: dto.referenceId ?? account.id,
            idempotencyKey: idempotencyKey ?? `void-${account.id}-${Date.now()}`,
            actorType: actor?.role,
            actorId: actor?.id,
            reason: dto.reason ?? "void"
          }
        });

        await tx.storedValueAccount.update({
          where: { id: account.id },
          data: { status: StoredValueStatus.frozen }
        });

        return { accountId: account.id, balanceCents: 0, status: "frozen" };
      });

      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
      return result;
    } catch (err) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  async releaseHold(holdId: string, idempotencyKey?: string, actor?: any) {
    const scope = { campgroundId: actor?.campgroundId ?? null, tenantId: actor?.tenantId ?? null };
    const existing = await this.guardIdempotency(idempotencyKey, { holdId }, scope, "stored-value/hold-release");
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    const hold = await this.prisma.storedValueHold.findUnique({ where: { id: holdId } });
    if (!hold) throw new NotFoundException("Hold not found");
    if (hold.status !== "open") throw new ConflictException("Hold not open");

    try {
      const result = await this.prisma.$transaction(async (tx: any) => {
        await tx.storedValueHold.update({
          where: { id: hold.id },
          data: { status: "released" }
        });
        return { holdId: hold.id, status: "released" };
      });

      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
      return result;
    } catch (err) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  /**
   * Sweep and expire open holds past their TTL.
   */
  async expireOpenHolds(cutoff?: Date) {
    const now = cutoff ?? new Date();
    const expiredIds = await this.prisma.storedValueHold.findMany({
      where: { status: "open", expiresAt: { lt: now } },
      select: { id: true }
    });
    if (!expiredIds.length) return { released: 0 };
    await this.prisma.storedValueHold.updateMany({
      where: { id: { in: expiredIds.map((h: any) => h.id) } },
      data: { status: "expired" }
    });
    return { released: expiredIds.length };
  }

  /**
   * Sweep expired accounts and move remaining balance to expire ledger, marking account expired.
   */
  async expireBalances(cutoff?: Date) {
    const now = cutoff ?? new Date();
    const accounts = await this.prisma.storedValueAccount.findMany({
      where: { status: StoredValueStatus.active, expiresAt: { not: null, lt: now } },
      select: { id: true, campgroundId: true, currency: true, expiresAt: true, scopeType: true, scopeId: true }
    });
    if (!accounts.length) return { expired: 0, zeroed: 0 };

    let expiredCount = 0;
    let zeroedCount = 0;

    for (const acc of accounts) {
      await this.prisma.$transaction(async (tx: any) => {
        const { balanceCents } = await this.getBalances(tx, acc.id);
        if (balanceCents <= 0) {
          await tx.storedValueAccount.update({
            where: { id: acc.id },
            data: { status: StoredValueStatus.expired }
          });
          zeroedCount += 1;
          return;
        }

        const accountScope = this.normalizeScope(acc);
        await tx.storedValueLedger.create({
          data: {
            campgroundId: acc.campgroundId,
            issuerCampgroundId: acc.campgroundId,
            scopeType: accountScope.scopeType,
            scopeId: accountScope.scopeId,
            accountId: acc.id,
            direction: StoredValueDirection.expire,
            amountCents: balanceCents,
            currency: acc.currency,
            beforeBalanceCents: balanceCents,
            afterBalanceCents: 0,
            referenceType: "expire",
            referenceId: acc.id,
            idempotencyKey: `expire-${acc.id}-${now.getTime()}`
          }
        });

        await tx.storedValueAccount.update({
          where: { id: acc.id },
          data: { status: StoredValueStatus.expired }
        });
        expiredCount += 1;
      });
    }

    return { expired: expiredCount, zeroed: zeroedCount };
  }

  async adjust(dto: AdjustStoredValueDto, idempotencyKey?: string, actor?: any) {
    const scope = { campgroundId: actor?.campgroundId ?? null, tenantId: actor?.tenantId ?? null };
    const existing = await this.guardIdempotency(idempotencyKey, dto, scope, "stored-value/adjust");
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) return existing.responseJson;
    if (existing?.status === IdempotencyStatus.inflight && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < 60000) {
      throw new ConflictException("Request already in progress");
    }

    const account = await this.prisma.storedValueAccount.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException("Account not found");
    this.ensureActive(account);
    const accountScope = this.normalizeScope(account);
    const transactionCampgroundId = actor?.campgroundId ?? account.campgroundId;

    try {
      const result = await this.prisma.$transaction(async (tx: any) => {
        const { balanceCents } = await this.getBalances(tx, account.id);
        const after = balanceCents + dto.deltaCents;
        if (after < 0) throw new BadRequestException("Adjustment would result in negative balance");

        await tx.storedValueLedger.create({
          data: {
            campgroundId: transactionCampgroundId,
            issuerCampgroundId: account.campgroundId,
            scopeType: accountScope.scopeType,
            scopeId: accountScope.scopeId,
            accountId: account.id,
            direction: StoredValueDirection.adjust,
            amountCents: dto.deltaCents,
            currency: account.currency,
            beforeBalanceCents: balanceCents,
            afterBalanceCents: after,
            referenceType: "adjustment",
            referenceId: dto.accountId,
            idempotencyKey: idempotencyKey ?? `adjust-${dto.accountId}-${Date.now()}`,
            actorType: actor?.role,
            actorId: actor?.id,
            reason: dto.reason
          }
        });

        return { accountId: account.id, balanceCents: after };
      });

      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, result);
      return result;
    } catch (err) {
      if (idempotencyKey) await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  async balanceByAccount(accountId: string) {
    await this.idempotency.throttleScope(undefined, undefined, "lookup").catch((err) => {
      this.observability.recordRedeemOutcome(false, undefined, { error: err?.message ?? "throttled_lookup", accountId });
      throw err;
    });
    // Computes balance from ledger for now
    const { balanceCents, availableCents } = await this.getBalances(this.prisma, accountId);
    return { accountId, balanceCents, availableCents };
  }

  async balanceByCode(code: string) {
    await this.idempotency.throttleScope(undefined, undefined, "lookup").catch((err) => {
      this.observability.recordRedeemOutcome(false, undefined, { error: err?.message ?? "throttled_lookup", code });
      throw err;
    });
    const account = await this.prisma.storedValueCode.findUnique({
      where: { code },
      select: { accountId: true }
    });
    if (!account) return { code, balanceCents: 0 };
    return this.balanceByAccount(account.accountId);
  }

  async listAccounts(campgroundId: string) {
    const scopeCampground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, organizationId: true }
    });
    if (!scopeCampground) return [];

    const accounts = await this.prisma.storedValueAccount.findMany({
      where: {
        guestId: null,
        OR: [
          { scopeType: "campground", scopeId: campgroundId },
          { scopeType: "organization", scopeId: scopeCampground.organizationId },
          { scopeType: "global" }
        ]
      },
      select: {
        id: true,
        campgroundId: true,
        scopeType: true,
        scopeId: true,
        type: true,
        currency: true,
        status: true,
        issuedAt: true,
        expiresAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        campground: { select: { id: true, name: true } },
        codes: {
          select: { id: true, code: true, active: true, createdAt: true },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { issuedAt: "desc" }
    });

    if (!accounts.length) return [];

    const ledger = await this.prisma.storedValueLedger.findMany({
      where: { accountId: { in: accounts.map((acc: any) => acc.id) } },
      select: { accountId: true, direction: true, amountCents: true }
    });

    const balances = new Map<string, number>();
    const issued = new Map<string, number>();
    for (const entry of ledger) {
      const current = balances.get(entry.accountId) ?? 0;
      balances.set(entry.accountId, current + this.directionToSigned(entry.direction, entry.amountCents));
      if (entry.direction === StoredValueDirection.issue) {
        issued.set(entry.accountId, (issued.get(entry.accountId) ?? 0) + entry.amountCents);
      }
    }

    return accounts.map((account: any) => ({
      ...account,
      balanceCents: balances.get(account.id) ?? 0,
      issuedCents: issued.get(account.id) ?? 0
    }));
  }

  async listLedger(campgroundId: string) {
    return this.prisma.storedValueLedger.findMany({
      where: { campgroundId, account: { guestId: null } },
      select: {
        id: true,
        accountId: true,
        campgroundId: true,
        issuerCampgroundId: true,
        scopeType: true,
        scopeId: true,
        direction: true,
        amountCents: true,
        currency: true,
        beforeBalanceCents: true,
        afterBalanceCents: true,
        referenceType: true,
        referenceId: true,
        channel: true,
        reason: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async liabilitySnapshot(campgroundId: string, opts?: { enforce?: boolean }) {
    const accounts = await this.prisma.storedValueAccount.findMany({
      where: { campgroundId },
      select: { id: true, metadata: true }
    });
    if (!accounts.length) return { campgroundId, taxableCents: 0, nonTaxableCents: 0, totalCents: 0 };

    const accountIds = accounts.map((a: any) => a.id);
    const ledger = await this.prisma.storedValueLedger.findMany({
      where: { accountId: { in: accountIds } },
      select: { accountId: true, direction: true, amountCents: true }
    });

    const balancesByAccount = new Map<string, number>();
    for (const row of ledger) {
      const current = balancesByAccount.get(row.accountId) ?? 0;
      balancesByAccount.set(row.accountId, current + this.directionToSigned(row.direction, row.amountCents));
    }

    let taxableCents = 0;
    let nonTaxableCents = 0;
    for (const acc of accounts) {
      const bal = balancesByAccount.get(acc.id) ?? 0;
      if (this.isTaxable(acc.metadata)) {
        taxableCents += bal;
      } else {
        nonTaxableCents += bal;
      }
    }

    const rollForwardCents = ledger.reduce(
      (sum: number, row: any) => sum + this.directionToSigned(row.direction, row.amountCents),
      0
    );
    const totalCents = taxableCents + nonTaxableCents;
    const driftCents = rollForwardCents - totalCents;

    const rollForwardOk = driftCents === 0;
    if (opts?.enforce && !rollForwardOk) {
      throw new ConflictException(`Liability roll-forward drift detected (${driftCents} cents)`);
    }

    return { campgroundId, taxableCents, nonTaxableCents, totalCents, rollForwardCents, driftCents, rollForwardOk };
  }

  private directionToSigned(direction: StoredValueDirection, amount: number) {
    if ([StoredValueDirection.issue, StoredValueDirection.refund, StoredValueDirection.adjust].includes(direction)) return amount;
    if ([StoredValueDirection.redeem, StoredValueDirection.expire, StoredValueDirection.hold_capture].includes(direction)) return -Math.abs(amount);
    return 0;
  }

  private async getBalances(tx: any, accountId: string) {
    const ledger = await tx.storedValueLedger.findMany({
      where: { accountId },
      select: { direction: true, amountCents: true }
    });
    const balanceCents = ledger.reduce(
      (sum: number, row: any) => sum + this.directionToSigned(row.direction, row.amountCents),
      0
    );
    const openHolds = await tx.storedValueHold.aggregate({
      where: { accountId, status: "open" },
      _sum: { amountCents: true }
    });
    const held = openHolds._sum.amountCents ?? 0;
    return { balanceCents, availableCents: balanceCents - held };
  }

  private async guardIdempotency(
    key: string | undefined,
    body: any,
    scope: { campgroundId?: string | null; tenantId?: string | null },
    endpoint: string,
    sequence?: string | number | null
  ) {
    if (!key) return null;
    return this.idempotency.start(key, body ?? {}, scope.campgroundId ?? null, {
      tenantId: scope.tenantId ?? null,
      endpoint,
      sequence,
      rateAction: "apply"
    });
  }

  private ensureActive(account: any) {
    if (account.status !== StoredValueStatus.active) {
      throw new ForbiddenException("Stored value account not active");
    }
    if (account.expiresAt && account.expiresAt < new Date()) {
      throw new ForbiddenException("Stored value account expired");
    }
  }

  private ensureCurrency(account: any, currency: string) {
    if (account.currency !== currency.toLowerCase()) {
      throw new BadRequestException("Currency mismatch");
    }
  }

  private ensureTaxableFlag(metadata: any, incoming?: boolean) {
    if (incoming === undefined || incoming === null) return;
    const existing = this.isTaxable(metadata);
    if (existing !== incoming) {
      throw new ConflictException("Taxable load flag mismatch");
    }
  }

  private async validateTaxableLoad(campgroundId: string | null, taxableLoad?: boolean) {
    if (!taxableLoad) return;
    if (!campgroundId) {
      throw new BadRequestException("taxable_load requires campground context");
    }
    const activeRate = await this.prisma.taxRule.findFirst({
      where: { campgroundId, type: TaxRuleType.rate, isActive: true }
    });
    if (!activeRate) {
      throw new BadRequestException("Taxable load requires an active tax rule");
    }
  }

  private isTaxable(metadata: any) {
    if (!metadata) return false;
    return Boolean((metadata as any).taxableLoad);
  }

  private mergeMetadata(metadata: any, taxableLoad?: boolean) {
    const merged = { ...(metadata ?? {}) };
    if (taxableLoad !== undefined) {
      merged.taxableLoad = taxableLoad;
    }
    return merged;
  }

  private normalizeScope(account: { scopeType?: string | null; scopeId?: string | null; campgroundId?: string | null }) {
    const scopeType = account?.scopeType ?? "campground";
    if (scopeType === "global") {
      return { scopeType: "global", scopeId: null as string | null };
    }
    if (scopeType === "organization") {
      return { scopeType: "organization", scopeId: account?.scopeId ?? null };
    }
    const scopeId = account?.scopeId ?? account?.campgroundId ?? null;
    return { scopeType: "campground", scopeId };
  }

  private ensureScopeMatches(account: any, expected: { scopeType: string; scopeId: string | null }) {
    const normalized = this.normalizeScope(account);
    if (normalized.scopeType !== expected.scopeType || (normalized.scopeId ?? null) !== (expected.scopeId ?? null)) {
      throw new ConflictException("Stored value scope mismatch");
    }
  }

  private async resolveIssueScope(issuerCampgroundId: string | null, dto: IssueStoredValueDto) {
    const scopeType = dto.scopeType ?? "campground";
    if (scopeType === "global") {
      return { scopeType: "global", scopeId: null as string | null };
    }
    if (scopeType === "organization") {
      const scopeId =
        dto.scopeId ??
        (issuerCampgroundId ? await this.getOrganizationIdForCampground(issuerCampgroundId) : null);
      if (!scopeId) {
        throw new BadRequestException("organization scope requires scopeId");
      }
      return { scopeType: "organization", scopeId };
    }
    const scopeId = dto.scopeId ?? issuerCampgroundId ?? dto.tenantId ?? null;
    if (!scopeId) {
      throw new BadRequestException("campground scope requires scopeId");
    }
    return { scopeType: "campground", scopeId };
  }

  private async resolveRedeemContext(account: any, redeemCampgroundId?: string | null, actor?: any) {
    const transactionCampgroundId = redeemCampgroundId ?? actor?.campgroundId ?? account?.campgroundId ?? null;
    if (!transactionCampgroundId) {
      throw new BadRequestException("campground context required for redemption");
    }

    const accountScope = this.normalizeScope(account);
    if (accountScope.scopeType === "campground") {
      const scopeId = accountScope.scopeId ?? account?.campgroundId ?? null;
      if (scopeId && scopeId !== transactionCampgroundId) {
        throw new ForbiddenException("Stored value not valid for this campground");
      }
    } else if (accountScope.scopeType === "organization") {
      if (!accountScope.scopeId) {
        throw new BadRequestException("organization scope missing scopeId");
      }
      const orgId = await this.getOrganizationIdForCampground(transactionCampgroundId);
      if (!orgId || orgId !== accountScope.scopeId) {
        throw new ForbiddenException("Stored value not valid for this organization");
      }
    }

    return {
      transactionCampgroundId,
      scopeType: accountScope.scopeType,
      scopeId: accountScope.scopeId
    };
  }

  private async getOrganizationIdForCampground(campgroundId: string) {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true }
    });
    return campground?.organizationId ?? null;
  }

  private async assertLiabilityRollForward(campgroundId?: string | null) {
    if (!campgroundId) return;
    await this.liabilitySnapshot(campgroundId, { enforce: true });
  }

  private async getAccount(dto: RedeemStoredValueDto) {
    if (!dto.accountId && !dto.code) {
      throw new BadRequestException("accountId or code required");
    }
    if (dto.accountId) {
      const acc = await this.prisma.storedValueAccount.findUnique({ where: { id: dto.accountId } });
      if (!acc) throw new NotFoundException("Account not found");
      const pinCode = await this.prisma.storedValueCode.findFirst({
        where: { accountId: dto.accountId, pinHash: { not: null } },
        select: { pinHash: true }
      });
      if (pinCode?.pinHash) {
        if (!dto.pin) throw new ForbiddenException("PIN required");
        if (!this.verifyPin(dto.pin, pinCode.pinHash)) throw new ForbiddenException("Invalid PIN");
      }
      return acc;
    }
    const code = await this.prisma.storedValueCode.findUnique({
      where: { code: dto.code! },
      select: {
        pinHash: true,
        account: true
      }
    });
    if (!code?.account) throw new NotFoundException("Account not found");
    if (code.pinHash) {
      if (!dto.pin) throw new ForbiddenException("PIN required");
      if (!this.verifyPin(dto.pin, code.pinHash)) throw new ForbiddenException("Invalid PIN");
    }
    return code.account;
  }

  private hashPin(pin: string) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(pin, salt, 10000, 32, "sha256").toString("hex");
    return `${salt}:${hash}`;
  }

  private verifyPin(pin: string, stored: string) {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const candidate = crypto.pbkdf2Sync(pin, salt, 10000, 32, "sha256").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
  }

  private generateCode(length = 16) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.randomBytes(length);
    let code = "";
    for (let i = 0; i < length; i++) {
      code += alphabet[bytes[i] % alphabet.length];
    }
    return code;
  }

  private generatePinIfRequested(codeOptions?: { pin?: string; generatePin?: boolean }) {
    if (codeOptions?.pin) return codeOptions.pin;
    if (!codeOptions?.generatePin) return undefined;
    const pin = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    return pin;
  }
}
