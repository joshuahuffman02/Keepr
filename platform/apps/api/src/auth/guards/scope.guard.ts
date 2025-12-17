import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Decorator to skip scope validation for specific routes
 */
export const SKIP_SCOPE_VALIDATION = 'skipScopeValidation';
export const SkipScopeValidation = () => Reflect.metadata(SKIP_SCOPE_VALIDATION, true);

/**
 * Platform roles that can access any campground
 */
const PLATFORM_ADMIN_ROLES = ['platform_admin', 'platform_superadmin', 'support'];

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
    constructor(private reflector: Reflector) { }

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
        const user = request.user;

        // If no authenticated user, skip validation (might be a public route)
        if (!user) {
            return true;
        }

        // Get campground ID from header or request property
        const campgroundId = request.campgroundId || request.headers['x-campground-id'];

        // If no campground specified, skip validation
        if (!campgroundId) {
            return true;
        }

        // Platform admins can access any campground
        if (user.platformRole && PLATFORM_ADMIN_ROLES.includes(user.platformRole)) {
            return true;
        }

        // Check if user has membership for this campground
        if (!user.memberships || !Array.isArray(user.memberships)) {
            throw new ForbiddenException(
                'You do not have access to this campground'
            );
        }

        const hasMembership = user.memberships.some(
            (m: any) => m.campgroundId === campgroundId
        );

        if (!hasMembership) {
            throw new ForbiddenException(
                `You do not have access to campground ${campgroundId}`
            );
        }

        return true;
    }
}
