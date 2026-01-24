import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ApprovalStatus, Prisma, UserRole } from "@prisma/client";

type ApprovalEntry = { approver: string; at: string };
type ApprovalAction = "refund" | "payout" | "config_change";

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(campgroundId?: string) {
    const where: Prisma.ApprovalRequestWhereInput = campgroundId ? { campgroundId } : {};

    const [requests, policies] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.approvalPolicy.findMany({
        where: campgroundId ? { OR: [{ campgroundId }, { campgroundId: null }] } : {},
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Transform to match frontend expectations
    const transformedRequests = requests.map((r) => ({
      id: r.id,
      type: this.normalizeAction(r.action),
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      reason: r.reason || "",
      requester: r.requesterName || r.requestedBy,
      approvals: this.normalizeApprovals(r.approvals),
      requiredApprovals: r.requiredApprovals,
      metadata: this.normalizeMetadata(r.payload),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      policyId: r.policyId,
    }));

    const transformedPolicies = policies.map((p) => ({
      id: p.id,
      name: p.name,
      appliesTo: this.normalizeActions(p.appliesTo),
      thresholdCents: p.thresholdCents,
      currency: p.currency,
      approversNeeded: p.approversNeeded,
      description: p.description || "",
      isActive: p.isActive,
      approverRoles: p.approverRoles,
      campgroundId: p.campgroundId,
    }));

    return { requests: transformedRequests, policies: transformedPolicies };
  }

  async create(payload: {
    type: "refund" | "payout" | "config_change";
    amount: number;
    currency: string;
    reason: string;
    requester: string;
    metadata?: Record<string, unknown>;
    campgroundId?: string;
    requestedBy: string;
  }) {
    // Find matching policy
    const policy = await this.resolvePolicy(
      payload.type,
      payload.amount,
      payload.currency,
      payload.campgroundId,
    );

    const requiredApprovals = policy?.approversNeeded ?? 1;

    const request = await this.prisma.approvalRequest.create({
      data: {
        id: randomUUID(),
        campgroundId: payload.campgroundId,
        action: payload.type,
        requestedBy: payload.requestedBy,
        requesterName: payload.requester,
        amount: Math.round(payload.amount * 100), // Convert to cents
        currency: payload.currency,
        reason: payload.reason,
        payload: toJsonValue(payload.metadata),
        status: "pending",
        requiredApprovals,
        approvals: [],
        policyId: policy?.id,
        updatedAt: new Date(),
      },
    });

    return {
      id: request.id,
      type: request.action,
      amount: request.amount,
      currency: request.currency,
      status: request.status,
      reason: request.reason,
      requester: request.requesterName,
      approvals: [],
      requiredApprovals: request.requiredApprovals,
      metadata: request.payload,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      policyId: request.policyId,
    };
  }

  async approve(id: string, approver: string) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Approval request ${id} not found`);
    }

    const existingApprovals = this.normalizeApprovals(request.approvals);
    const alreadyApproved = existingApprovals.some((a) => a.approver === approver);

    let newApprovals = existingApprovals;
    if (!alreadyApproved) {
      newApprovals = [...existingApprovals, { approver, at: new Date().toISOString() }];
    }

    const approvalsCount = newApprovals.length;
    const newStatus: ApprovalStatus =
      approvalsCount >= request.requiredApprovals ? "approved" : "pending";

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        approvals: newApprovals,
        status: newStatus,
        decidedBy: newStatus === "approved" ? approver : undefined,
        decidedAt: newStatus === "approved" ? new Date() : undefined,
      },
    });

    return {
      id: updated.id,
      type: updated.action,
      amount: updated.amount,
      currency: updated.currency,
      status: updated.status,
      reason: updated.reason,
      requester: updated.requesterName,
      approvals: newApprovals,
      requiredApprovals: updated.requiredApprovals,
      metadata: updated.payload,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      policyId: updated.policyId,
    };
  }

  async reject(id: string, approver: string, reason?: string) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Approval request ${id} not found`);
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: "rejected",
        decidedBy: approver,
        decidedAt: new Date(),
        payload: {
          ...this.normalizeMetadata(request.payload),
          rejectionReason: reason,
          rejectedBy: approver,
        },
      },
    });

    return {
      id: updated.id,
      type: updated.action,
      amount: updated.amount,
      currency: updated.currency,
      status: updated.status,
      reason: updated.reason,
      requester: updated.requesterName,
      approvals: this.normalizeApprovals(updated.approvals),
      requiredApprovals: updated.requiredApprovals,
      metadata: updated.payload,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      policyId: updated.policyId,
    };
  }

  async policiesList(campgroundId?: string) {
    const policies = await this.prisma.approvalPolicy.findMany({
      where: campgroundId ? { OR: [{ campgroundId }, { campgroundId: null }] } : {},
      orderBy: { createdAt: "desc" },
    });

    return policies.map((p) => ({
      id: p.id,
      name: p.name,
      appliesTo: p.appliesTo,
      thresholdCents: p.thresholdCents,
      currency: p.currency,
      approversNeeded: p.approversNeeded,
      description: p.description,
      isActive: p.isActive,
      approverRoles: p.approverRoles,
      campgroundId: p.campgroundId,
    }));
  }

  // Policy CRUD operations
  async createPolicy(payload: {
    name: string;
    appliesTo: string[];
    thresholdCents?: number;
    currency?: string;
    approversNeeded?: number;
    description?: string;
    approverRoles?: UserRole[];
    campgroundId?: string;
    createdById?: string;
  }) {
    // Get the primary action (first in appliesTo array)
    const action = payload.appliesTo[0] || "config_change";

    const policy = await this.prisma.approvalPolicy.create({
      data: {
        id: randomUUID(),
        name: payload.name,
        action,
        appliesTo: payload.appliesTo,
        thresholdCents: payload.thresholdCents,
        currency: payload.currency ?? "USD",
        approversNeeded: payload.approversNeeded ?? 1,
        description: payload.description,
        approverRoles: payload.approverRoles ?? [],
        Campground: payload.campgroundId ? { connect: { id: payload.campgroundId } } : undefined,
        User: payload.createdById ? { connect: { id: payload.createdById } } : undefined,
        updatedAt: new Date(),
      },
    });

    return {
      id: policy.id,
      name: policy.name,
      appliesTo: policy.appliesTo,
      thresholdCents: policy.thresholdCents,
      currency: policy.currency,
      approversNeeded: policy.approversNeeded,
      description: policy.description,
      isActive: policy.isActive,
      approverRoles: policy.approverRoles,
      campgroundId: policy.campgroundId,
    };
  }

  async updatePolicy(
    id: string,
    payload: {
      name?: string;
      appliesTo?: string[];
      thresholdCents?: number | null;
      currency?: string;
      approversNeeded?: number;
      description?: string | null;
      approverRoles?: UserRole[];
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.approvalPolicy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Policy ${id} not found`);
    }

    const policy = await this.prisma.approvalPolicy.update({
      where: { id },
      data: {
        name: payload.name,
        action: payload.appliesTo?.[0] ?? existing.action,
        appliesTo: payload.appliesTo,
        thresholdCents: payload.thresholdCents,
        currency: payload.currency,
        approversNeeded: payload.approversNeeded,
        description: payload.description,
        approverRoles: payload.approverRoles,
        isActive: payload.isActive,
      },
    });

    return {
      id: policy.id,
      name: policy.name,
      appliesTo: policy.appliesTo,
      thresholdCents: policy.thresholdCents,
      currency: policy.currency,
      approversNeeded: policy.approversNeeded,
      description: policy.description,
      isActive: policy.isActive,
      approverRoles: policy.approverRoles,
      campgroundId: policy.campgroundId,
    };
  }

  async deletePolicy(id: string) {
    const existing = await this.prisma.approvalPolicy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Policy ${id} not found`);
    }

    await this.prisma.approvalPolicy.delete({
      where: { id },
    });

    return { success: true, id };
  }

  private async resolvePolicy(
    type: string,
    amountCents: number,
    currency: string,
    campgroundId?: string,
  ) {
    // First try campground-specific policies, then fall back to global
    const policies = await this.prisma.approvalPolicy.findMany({
      where: {
        isActive: true,
        OR: campgroundId ? [{ campgroundId }, { campgroundId: null }] : [{ campgroundId: null }],
      },
      orderBy: [
        { campgroundId: "desc" }, // Campground-specific first
        { thresholdCents: "desc" }, // Higher thresholds first
      ],
    });

    return policies.find((p) => {
      const matchesType = p.appliesTo.includes(type);
      const matchesCurrency = !p.currency || p.currency === currency;
      const meetsThreshold = p.thresholdCents ? amountCents >= p.thresholdCents : true;
      return matchesType && matchesCurrency && meetsThreshold;
    });
  }

  private normalizeAction(value: string): ApprovalAction {
    return this.isApprovalAction(value) ? value : "config_change";
  }

  private normalizeActions(values: string[]): ApprovalAction[] {
    return values.map((value) => this.normalizeAction(value));
  }

  private normalizeApprovals(value: unknown): ApprovalEntry[] {
    if (!Array.isArray(value)) return [];
    return value.filter(this.isApprovalEntry);
  }

  private normalizeMetadata(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isApprovalAction(value: string): value is ApprovalAction {
    return value === "refund" || value === "payout" || value === "config_change";
  }

  private isApprovalEntry(value: unknown): value is ApprovalEntry {
    if (!this.isRecord(value)) return false;
    return typeof value.approver === "string" && typeof value.at === "string";
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
