import { Injectable, CanActivate, ExecutionContext, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

type RoleType = string;

// Platform-level roles that don't require campground membership
const PLATFORM_ROLES = [
  "platform_admin",
  "support_agent",
  "support_lead",
  "regional_support",
  "ops_engineer",
];

export const ROLES_KEY = "roles";
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: unknown = request.user;

    if (!this.isRecord(user)) {
      return false;
    }

    // Check if any required roles are platform-level roles
    const requiresPlatformRole = requiredRoles.some((role) => PLATFORM_ROLES.includes(role));

    // If user has a platform role that matches, allow access
    const platformRole = typeof user.platformRole === "string" ? user.platformRole : undefined;
    if (platformRole && requiredRoles.includes(platformRole)) {
      return true;
    }

    // For platform-only routes, if user doesn't have matching platform role, deny
    if (requiresPlatformRole && requiredRoles.every((role) => PLATFORM_ROLES.includes(role))) {
      return false;
    }

    // For campground-scoped routes, check membership roles
    const campgroundId =
      request.params?.campgroundId ||
      request.query?.campgroundId ||
      request.body?.campgroundId ||
      request.campgroundId ||
      request.headers["x-campground-id"];

    const memberships = Array.isArray(user.memberships) ? user.memberships : [];
    if (memberships.length === 0) {
      return false;
    }

    // Check if user has required role for the specified campground
    const membership = memberships.find(
      (member) => this.isMembership(member) && member.campgroundId === campgroundId,
    );

    if (!membership) {
      return false;
    }

    return requiredRoles.includes(membership.role);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private isMembership(value: unknown): value is { campgroundId?: string | null; role?: string } {
    if (!this.isRecord(value)) return false;
    const campgroundId = value.campgroundId;
    const role = value.role;
    const validCampgroundId =
      typeof campgroundId === "string" || campgroundId === null || campgroundId === undefined;
    const validRole = typeof role === "string" || role === undefined;
    return validCampgroundId && validRole;
  }
}
