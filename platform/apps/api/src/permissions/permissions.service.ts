import { Injectable, ForbiddenException } from "@nestjs/common";
import { ApprovalStatus, PermissionEffect, UserRole, PlatformRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/auth.types";

type CheckAccessInput = {
  user: AuthUser | null;
  campgroundId?: string | null;
  region?: string | null;
  resource: string;
  action: string;
  field?: string;
};

const PLATFORM_RULES: Record<PlatformRole, { resource: string; action: string }[]> = {
  support_agent: [
    { resource: "support", action: "read" },
    { resource: "support", action: "write" },
  ],
  support_lead: [
    { resource: "support", action: "read" },
    { resource: "support", action: "write" },
    { resource: "support", action: "assign" },
    { resource: "support", action: "analytics" },
  ],
  regional_support: [
    { resource: "support", action: "read" },
    { resource: "support", action: "write" },
    { resource: "support", action: "assign" },
  ],
  ops_engineer: [
    { resource: "operations", action: "read" },
    { resource: "operations", action: "write" },
  ],
  platform_admin: [{ resource: "*", action: "*" }],
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  isPlatformStaff(user: AuthUser | null | undefined): boolean {
    return !!this.getPlatformRole(user) && this.isPlatformActive(user);
  }

  private getPlatformRole(user: AuthUser | null | undefined): PlatformRole | null {
    return user?.platformRole ?? null;
  }

  private isPlatformActive(user: AuthUser | null | undefined) {
    if (!user) return false;
    if (user.platformActive === false) return false;
    return true;
  }

  private inPlatformRegion(user: AuthUser | null | undefined, region?: string | null) {
    if (!region) return true;
    const platformRegion = user?.platformRegion;
    const userRegion = user?.region;
    if (platformRegion) return platformRegion === region;
    if (userRegion) return userRegion === region;
    return true;
  }

  private getRole(
    user: AuthUser | null | undefined,
    campgroundId?: string | null,
  ): UserRole | null {
    if (!user) return null;
    if (user.role) return user.role;
    if (Array.isArray(user.ownershipRoles) && user.ownershipRoles.includes("owner"))
      return UserRole.owner;

    const membership = campgroundId
      ? user.memberships.find((membership) => membership.campgroundId === campgroundId)
      : null;
    if (membership?.role) return membership.role;

    if (user.memberships.length > 0) {
      const roles = user.memberships
        .map((membership) => membership.role)
        .filter((role): role is UserRole => role !== null);
      if (roles.length > 0) return this.prioritizeRole(roles);
    }
    return null;
  }

  private prioritizeRole(roles: UserRole[]): UserRole {
    const order: UserRole[] = [
      UserRole.owner,
      UserRole.manager,
      UserRole.finance,
      UserRole.front_desk,
      UserRole.maintenance,
      UserRole.marketing,
      UserRole.readonly,
    ];
    return order.find((r) => roles.includes(r)) ?? roles[0];
  }

  private splitRegionsFromFields(fields: string[] = []) {
    const regions: string[] = [];
    const cleanFields: string[] = [];
    for (const f of fields) {
      if (typeof f === "string" && f.startsWith("__region:")) {
        regions.push(f.replace("__region:", ""));
      } else {
        cleanFields.push(f);
      }
    }
    return { regions, cleanFields };
  }

  private buildFieldsWithRegions(fields: string[] = [], regions: string[] = []) {
    const deduped = new Set<string>(fields.filter(Boolean));
    for (const r of regions.filter(Boolean)) {
      deduped.add(`__region:${r}`);
    }
    return Array.from(deduped);
  }

  async listRules(campgroundId?: string | null, region?: string | null) {
    const rules = await this.prisma.permissionRule.findMany({
      where: {
        AND: [campgroundId ? { campgroundId } : {}, region ? { campgroundId: null } : {}],
      },
      orderBy: [{ campgroundId: "asc" }, { role: "asc" }, { resource: "asc" }, { action: "asc" }],
    });

    return rules.map((rule) => {
      const { regions, cleanFields } = this.splitRegionsFromFields(rule.fields ?? []);
      return { ...rule, fields: cleanFields, regions };
    });
  }

  async upsertRule(params: {
    campgroundId?: string | null;
    role: UserRole;
    resource: string;
    action: string;
    fields?: string[];
    regions?: string[];
    effect?: PermissionEffect;
    createdById?: string | null;
  }) {
    const fields = this.buildFieldsWithRegions(params.fields ?? [], params.regions ?? []);
    const campgroundId = params.campgroundId ?? null;
    const existing = await this.prisma.permissionRule.findFirst({
      where: {
        campgroundId,
        role: params.role,
        resource: params.resource,
        action: params.action,
      },
    });

    if (existing) {
      return this.prisma.permissionRule.update({
        where: { id: existing.id },
        data: {
          fields,
          effect: params.effect ?? PermissionEffect.allow,
        },
      });
    }

    return this.prisma.permissionRule.create({
      data: {
        id: randomUUID(),
        campgroundId,
        role: params.role,
        resource: params.resource,
        action: params.action,
        fields,
        effect: params.effect ?? PermissionEffect.allow,
        createdById: params.createdById ?? null,
      },
    });
  }

  async deleteRule(params: {
    campgroundId?: string | null;
    role: UserRole;
    resource: string;
    action: string;
  }) {
    const rule = await this.prisma.permissionRule.findFirst({
      where: {
        campgroundId: params.campgroundId ?? null,
        role: params.role,
        resource: params.resource,
        action: params.action,
      },
    });

    if (!rule) {
      throw new ForbiddenException("Permission rule not found");
    }

    return this.prisma.permissionRule.delete({ where: { id: rule.id } });
  }

  private isRegionScoped(user: AuthUser | null | undefined, region?: string | null) {
    if (!region) return true;
    if (!user?.region) return true;
    return user.region === region;
  }

  private isCampgroundScoped(user: AuthUser | null | undefined, campgroundId?: string | null) {
    if (!campgroundId) return true;
    const memberships = user?.memberships ?? [];
    return memberships.some((membership) => membership.campgroundId === campgroundId);
  }

  async checkAccess(
    input: CheckAccessInput,
  ): Promise<{ allowed: boolean; deniedFields?: string[] }> {
    const platformRole = this.getPlatformRole(input.user);
    if (platformRole && this.isPlatformActive(input.user)) {
      const platformResult = this.checkPlatformRules({
        user: input.user,
        role: platformRole,
        resource: input.resource,
        action: input.action,
        region: input.region,
      });
      if (platformResult.allowed) {
        return platformResult;
      }
    }

    if (input.resource === "support") {
      return { allowed: false };
    }

    const role = this.getRole(input.user, input.campgroundId);
    if (!role) return { allowed: false };

    if (!this.isRegionScoped(input.user, input.region)) return { allowed: false };
    if (
      !this.isCampgroundScoped(input.user, input.campgroundId) &&
      role !== UserRole.owner &&
      role !== UserRole.manager
    ) {
      return { allowed: false };
    }

    if (role === UserRole.owner || role === UserRole.manager) return { allowed: true };

    const rules = await this.prisma.permissionRule.findMany({
      where: {
        role,
        resource: input.resource,
        action: input.action,
        OR: [{ campgroundId: input.campgroundId ?? null }, { campgroundId: null }],
      },
    });

    if (!rules.length) return { allowed: false };

    // Prefer campground-scoped rules over global rules
    const scopedFirst = [...rules].sort((a, b) => {
      const aScoped = a.campgroundId ? 1 : 0;
      const bScoped = b.campgroundId ? 1 : 0;
      return bScoped - aScoped;
    });

    for (const rule of scopedFirst) {
      const { regions, cleanFields } = this.splitRegionsFromFields(rule.fields ?? []);
      if (regions.length && input.region && !regions.includes(input.region)) {
        continue;
      }
      const fieldTargeted = cleanFields.length > 0;
      const fieldMatch = !input.field || !fieldTargeted || cleanFields.includes(input.field);

      if (!fieldMatch) continue;

      if (rule.effect === PermissionEffect.deny) {
        return { allowed: false, deniedFields: cleanFields.length ? cleanFields : undefined };
      }

      // First matching allow (scoped-first ordering) wins
      return { allowed: true };
    }

    return { allowed: false };
  }

  private checkPlatformRules(args: {
    user: AuthUser | null;
    role: PlatformRole;
    resource: string;
    action: string;
    region?: string | null;
  }): { allowed: boolean } {
    if (!this.inPlatformRegion(args.user, args.region)) return { allowed: false };
    if (args.role === "platform_admin") return { allowed: true };
    const rules = PLATFORM_RULES[args.role] ?? [];
    const match = rules.some((r) => {
      const resourceMatch = r.resource === "*" || r.resource === args.resource;
      const actionMatch = r.action === "*" || r.action === args.action;
      return resourceMatch && actionMatch;
    });
    return { allowed: match };
  }

  async requestApproval(params: {
    campgroundId?: string | null;
    action: string;
    requestedBy: string;
  }) {
    const autoApprove = ApprovalStatus.approved;

    return this.prisma.approvalRequest.create({
      data: {
        id: randomUUID(),
        campgroundId: params.campgroundId ?? null,
        action: params.action,
        requestedBy: params.requestedBy,
        status: autoApprove,
        decidedBy: params.requestedBy,
        decidedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async decideApproval(id: string, actorId: string, approve: boolean) {
    const req = await this.prisma.approvalRequest.findUnique({ where: { id } });
    if (!req) throw new ForbiddenException("Approval request not found");
    if (req.status !== ApprovalStatus.pending) return req;
    return this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: approve ? ApprovalStatus.approved : ApprovalStatus.rejected,
        decidedBy: actorId,
        decidedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async listApprovals(campgroundId?: string | null) {
    return this.prisma.approvalRequest.findMany({
      where: { campgroundId: campgroundId ?? undefined },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
