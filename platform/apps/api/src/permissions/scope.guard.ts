import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsService } from "./permissions.service";
import { SCOPE_KEY, ScopeDescriptor } from "./scope.decorator";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";

type ScopeRequest = Request & {
  user?: AuthUser;
  permissionDenied?: { allowed: boolean; deniedFields?: string[] };
};

const getStringValue = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : null;
  }
  return null;
};

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const descriptor = this.reflector.getAllAndOverride<ScopeDescriptor | undefined>(SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!descriptor) return true;

    const request = context.switchToHttp().getRequest<ScopeRequest>();
    const user = request.user;
    const campgroundId = this.extractCampgroundId(request);
    const region = this.extractRegion(request);
    const isPlatform = this.permissions.isPlatformStaff(user);

    const inRegionScope = isPlatform
      ? true
      : region
        ? !user?.region || user.region === region
        : true;
    const inCampgroundScope = campgroundId
      ? isPlatform ||
        (Array.isArray(user?.memberships) &&
          user.memberships.some((membership) => membership.campgroundId === campgroundId))
      : true;

    if (!user || !inRegionScope || !inCampgroundScope) {
      return false;
    }

    const result = await this.permissions.checkAccess({
      user,
      campgroundId,
      region,
      resource: descriptor.resource,
      action: descriptor.action,
    });

    if (!result.allowed) {
      request.permissionDenied = result;
    }

    return result.allowed;
  }

  private extractRegion(request: ScopeRequest): string | null {
    return (
      getStringValue(request.query?.region) ||
      getStringValue(request.body?.region) ||
      getStringValue(request.params?.region) ||
      getStringValue(request.headers?.["x-region-id"]) ||
      null
    );
  }

  private extractCampgroundId(request: ScopeRequest): string | null {
    return (
      getStringValue(request.params?.campgroundId) ||
      getStringValue(request.query?.campgroundId) ||
      getStringValue(request.body?.campgroundId) ||
      getStringValue(request.headers?.["x-campground-id"]) ||
      null
    );
  }
}
