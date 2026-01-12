import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepositPolicyDto } from "./dto/create-deposit-policy.dto";
import { UpdateDepositPolicyDto } from "./dto/update-deposit-policy.dto";
import { DepositStrategy, DepositApplyTo } from "@prisma/client";
import type { DepositPolicy } from "@prisma/client";
import { AuditService } from "../audit/audit.service";

type DepositPolicyStore = Pick<
  PrismaService["depositPolicy"],
  "findMany" | "findFirst" | "findUnique" | "create" | "update" | "delete"
>;

type CampgroundStore = Pick<PrismaService["campground"], "findUnique">;

type DepositPoliciesStore = {
  depositPolicy: DepositPolicyStore;
  campground: CampgroundStore;
};

type DepositPoliciesAudit = Pick<AuditService, "record">;

export interface DepositCalculation {
  depositAmountCents: number;
  policy: {
    id: string;
    name: string;
    strategy: DepositStrategy;
    value: number;
    applyTo: DepositApplyTo;
  };
  depositPolicyVersion: string;
}

@Injectable()
export class DepositPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  list(campgroundId: string) {
    return this.prisma.depositPolicy.findMany({
      where: { campgroundId },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }]
    });
  }

  async create(campgroundId: string, dto: CreateDepositPolicyDto, actorId?: string | null) {
    const policy = await this.prisma.depositPolicy.create({
      data: {
        id: randomUUID(),
        ...dto,
        campgroundId,
        siteClassId: dto.siteClassId ?? null,
        retryPlanId: dto.retryPlanId ?? null,
        updatedAt: new Date()
      }
    });

    await this.audit.record({
      campgroundId,
      actorId: actorId ?? null,
      action: "deposit_policy.create",
      entity: "DepositPolicy",
      entityId: policy.id,
      before: null,
      after: policy
    });

    return policy;
  }

  async update(campgroundId: string, id: string, dto: UpdateDepositPolicyDto, actorId?: string | null) {
    const existing = await this.prisma.depositPolicy.findFirst({ where: { id, campgroundId } });
    if (!existing) throw new NotFoundException("Deposit policy not found");
    const { siteClassId, retryPlanId, ...rest } = dto;
    const updated = await this.prisma.depositPolicy.update({
      where: { id },
      data: {
        ...rest,
        siteClassId: siteClassId === undefined ? undefined : siteClassId ?? null,
        retryPlanId: retryPlanId === undefined ? undefined : retryPlanId ?? null
      }
    });

    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId: actorId ?? null,
      action: "deposit_policy.update",
      entity: "DepositPolicy",
      entityId: id,
      before: existing,
      after: updated
    });

    return updated;
  }

  async remove(campgroundId: string, id: string, actorId?: string | null) {
    const existing = await this.prisma.depositPolicy.findFirst({ where: { id, campgroundId } });
    if (!existing) throw new NotFoundException("Deposit policy not found");
    await this.prisma.depositPolicy.delete({ where: { id } });

    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId: actorId ?? null,
      action: "deposit_policy.delete",
      entity: "DepositPolicy",
      entityId: id,
      before: existing,
      after: null
    });

    return existing;
  }

  /**
   * Resolve the applicable deposit policy for a reservation.
   * Priority: siteClass-specific > campground default > campground-wide policy
   */
  async resolve(campgroundId: string, siteClassId: string | null): Promise<DepositPolicy | null> {
    // 1. Try siteClass-specific policy
    if (siteClassId) {
      const siteClassPolicy = await this.prisma.depositPolicy.findFirst({
        where: { campgroundId, siteClassId, active: true },
        orderBy: { createdAt: "desc" }
      });
      if (siteClassPolicy) return siteClassPolicy;
    }

    // 2. Try campground default policy
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { defaultDepositPolicyId: true, depositRule: true, depositPercentage: true }
    });

    if (campground?.defaultDepositPolicyId) {
      const defaultPolicy = await this.prisma.depositPolicy.findUnique({
        where: { id: campground.defaultDepositPolicyId }
      });
      if (defaultPolicy?.active) return defaultPolicy;
    }

    // 3. Fallback to any active campground-wide policy
    const campgroundPolicy = await this.prisma.depositPolicy.findFirst({
      where: { campgroundId, siteClassId: null, active: true },
      orderBy: { createdAt: "desc" }
    });
    if (campgroundPolicy) return campgroundPolicy;

    // 4. Return null (caller can treat as no deposit requirement)
    return null;
  }

  /**
   * Calculate deposit amount using resolved policy.
   */
  async calculateDeposit(
    campgroundId: string,
    siteClassId: string | null,
    totalAmountCents: number,
    lodgingOnlyCents: number,
    nights: number
  ): Promise<DepositCalculation | null> {
    const policy = await this.resolve(campgroundId, siteClassId);

    if (!policy) return null;

    const baseCents = policy.applyTo === DepositApplyTo.lodging_only
      ? lodgingOnlyCents
      : totalAmountCents;

    let depositAmountCents = 0;

    switch (policy.strategy) {
      case DepositStrategy.first_night:
        depositAmountCents = Math.ceil(baseCents / nights);
        break;
      case DepositStrategy.percent:
        depositAmountCents = Math.ceil(baseCents * (policy.value / 100));
        break;
      case DepositStrategy.fixed:
        depositAmountCents = policy.value;
        break;
    }

    // Apply min/max caps
    if (policy.minCap !== null && depositAmountCents < policy.minCap) {
      depositAmountCents = policy.minCap;
    }
    if (policy.maxCap !== null && depositAmountCents > policy.maxCap) {
      depositAmountCents = policy.maxCap;
    }

    // Never exceed total
    depositAmountCents = Math.min(depositAmountCents, totalAmountCents);

    const depositPolicyVersion = `dp:${policy.id}:v${policy.version}`;

    return {
      depositAmountCents,
      policy: {
        id: policy.id,
        name: policy.name,
        strategy: policy.strategy,
        value: policy.value,
        applyTo: policy.applyTo
      },
      depositPolicyVersion
    };
  }
}
