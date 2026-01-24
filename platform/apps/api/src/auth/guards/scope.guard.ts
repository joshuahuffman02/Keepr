import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

/**
 * Decorator to skip scope validation for specific routes
 */
export const SKIP_SCOPE_VALIDATION = "skipScopeValidation";
export const SkipScopeValidation = () => Reflect.metadata(SKIP_SCOPE_VALIDATION, true);

/**
 * Platform roles that can access any campground
 */
const PLATFORM_ADMIN_ROLES = ["platform_admin", "platform_superadmin", "support"];

/**
 * ScopeGuard validates that an authenticated user has access to the campground
 * specified in the X-Campground-Id header.
 *
 * This guard should be used after JwtAuthGuard to ensure req.user is populated.
 *
 * Rules:
 * - If user is not authenticated, scope validation is skipped (public routes)
 * - If X-Campground-Id is not provided, scope validation is skipped
 * - If user has a platform admin role, they can access any campground
 * - Otherwise, user must have a membership for the specified campground
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if scope validation should be skipped for this route
    const skipValidation = this.reflector.getAllAndOverride<boolean>(SKIP_SCOPE_VALIDATION, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipValidation) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: unknown = request.user;

    // If no authenticated user, skip validation (might be a public route)
    if (!this.isRecord(user)) {
      return true;
    }

    // Get campground ID from header or request property
    const headerCampground = request.headers["x-campground-id"];
    const campgroundId =
      request.campgroundId ||
      (Array.isArray(headerCampground) ? headerCampground[0] : headerCampground);

    // Get campgroundId from route params if not in header (for routes like /campgrounds/:campgroundId/*)
    const routeCampgroundId = request.params?.campgroundId;
    const effectiveCampgroundId = campgroundId || routeCampgroundId;

    // If no campground specified, skip validation for routes that don't require it
    // Note: Critical routes should use @Roles() which requires a specific campground membership
    if (!effectiveCampgroundId) {
      return true;
    }

    // If header and route param both exist and don't match, reject
    if (campgroundId && routeCampgroundId && campgroundId !== routeCampgroundId) {
      throw new ForbiddenException("Campground ID mismatch between header and route parameter");
    }

    // Platform admins can access any campground
    const platformRole = typeof user.platformRole === "string" ? user.platformRole : undefined;
    if (platformRole && PLATFORM_ADMIN_ROLES.includes(platformRole)) {
      return true;
    }

    // Check if user has membership for this campground
    const memberships = Array.isArray(user.memberships) ? user.memberships : [];
    if (memberships.length === 0) {
      throw new ForbiddenException("You do not have access to this campground");
    }

    const hasMembership = memberships.some(
      (member) => this.isMembership(member) && member.campgroundId === effectiveCampgroundId,
    );

    if (!hasMembership) {
      throw new ForbiddenException(`You do not have access to campground ${effectiveCampgroundId}`);
    }

    return true;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private isMembership(value: unknown): value is { campgroundId?: string | null } {
    if (!this.isRecord(value)) return false;
    const campgroundId = value.campgroundId;
    return typeof campgroundId === "string" || campgroundId === null || campgroundId === undefined;
  }
}
