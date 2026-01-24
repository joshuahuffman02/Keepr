import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "requiredPermission";
export type PermissionDescriptor = { resource: string; action: string };

export const RequirePermission = (descriptor: PermissionDescriptor) =>
  SetMetadata(PERMISSION_KEY, descriptor);
