import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsService } from "./permissions.service";
import { PERMISSION_KEY, PermissionDescriptor } from "./permission.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const descriptor = this.reflector.getAllAndOverride<PermissionDescriptor | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!descriptor) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const campgroundId =
      request.params?.campgroundId || request.headers?.["x-campground-id"] || null;

    const result = await this.permissions.checkAccess({
      user,
      campgroundId,
      resource: descriptor.resource,
      action: descriptor.action,
    });

    if (!result.allowed) {
      request.permissionDenied = result;
    }

    return result.allowed;
  }
}
