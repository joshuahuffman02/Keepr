import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

type UserRole = string;

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const campgroundId =
            request.params?.campgroundId ||
            request.query?.campgroundId ||
            request.body?.campgroundId ||
            request.campgroundId ||
            request.headers['x-campground-id'];

        if (!user || !user.memberships) {
            return false;
        }

        // Check if user has required role for the specified campground
        const membership = user.memberships.find(
            (m: any) => m.campgroundId === campgroundId
        );

        if (!membership) {
            return false;
        }

        return requiredRoles.includes(membership.role);
    }
}
