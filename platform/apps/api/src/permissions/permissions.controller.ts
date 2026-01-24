import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { PermissionEffect, UserRole } from "@prisma/client";
import { PermissionsService } from "./permissions.service";
import { ScopeGuard } from "./scope.guard";
import { RequireScope } from "./scope.decorator";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";

type AuthRequest = Request & { user: AuthUser };

@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get("whoami")
  async whoami(@Req() req: AuthRequest) {
    const user = req.user;
    const memberships = user.memberships.map((membership) => ({
      campgroundId: membership.campgroundId,
      role: membership.role,
      campground: membership.campground
        ? {
            id: membership.campground.id,
            name: membership.campground.name,
            slug: membership.campground.slug,
          }
        : undefined,
    }));

    const [supportRead, supportAssign, supportAnalytics, operationsAccess] = await Promise.all([
      this.permissions.checkAccess({
        user,
        campgroundId: null,
        resource: "support",
        action: "read",
      }),
      this.permissions.checkAccess({
        user,
        campgroundId: null,
        resource: "support",
        action: "assign",
      }),
      this.permissions.checkAccess({
        user,
        campgroundId: null,
        resource: "support",
        action: "analytics",
      }),
      this.permissions.checkAccess({
        user,
        campgroundId: null,
        resource: "operations",
        action: "write",
      }),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        region: user.region ?? null,
        platformRole: user.platformRole ?? null,
        platformRegion: user.platformRegion ?? null,
        platformActive: user.platformActive ?? true,
        ownershipRoles: user.ownershipRoles ?? [],
        memberships,
      },
      allowed: {
        supportRead: supportRead.allowed,
        supportAssign: supportAssign.allowed,
        supportAnalytics: supportAnalytics.allowed,
        operationsWrite: operationsAccess.allowed,
      },
    };
  }

  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "permissions", action: "read" })
  @Get("policies")
  async getPolicies(
    @Query("campgroundId") campgroundId?: string,
    @Query("region") region?: string,
  ) {
    const rules = await this.permissions.listRules(campgroundId, region);
    return {
      rules,
    };
  }

  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "permissions", action: "write" })
  @Post("rules")
  async upsertRule(
    @Body()
    body: {
      campgroundId?: string;
      role: UserRole;
      resource: string;
      action: string;
      fields?: string[];
      regions?: string[];
      effect?: PermissionEffect;
      createdById?: string;
    },
  ) {
    return this.permissions.upsertRule({
      campgroundId: body.campgroundId ?? null,
      role: body.role,
      resource: body.resource,
      action: body.action,
      fields: body.fields ?? [],
      regions: body.regions ?? [],
      effect: body.effect ?? "allow",
      createdById: body.createdById ?? null,
    });
  }

  @Roles(UserRole.owner, UserRole.manager)
  @RequireScope({ resource: "permissions", action: "write" })
  @Delete("rules")
  async deleteRule(
    @Query("campgroundId") campgroundId: string | undefined,
    @Query("role") role: UserRole,
    @Query("resource") resource: string,
    @Query("action") action: string,
  ) {
    return this.permissions.deleteRule({
      campgroundId: campgroundId ?? null,
      role,
      resource,
      action,
    });
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Post("approvals")
  async submitApproval(
    @Body()
    body: {
      action: string;
      campgroundId?: string;
      requestedBy: string;
    },
  ) {
    return this.permissions.requestApproval({
      action: body.action,
      campgroundId: body.campgroundId ?? null,
      requestedBy: body.requestedBy,
    });
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Post("approvals/:id/decision")
  async decide(@Param("id") id: string, @Body() body: { approve: boolean; actorId: string }) {
    return this.permissions.decideApproval(id, body.actorId, body.approve);
  }

  @Roles(UserRole.owner, UserRole.manager)
  @Get("approvals")
  async listApprovals(@Query("campgroundId") campgroundId?: string) {
    return this.permissions.listApprovals(campgroundId ?? null);
  }
}
