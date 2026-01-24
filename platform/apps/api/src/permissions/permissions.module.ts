import { Module } from "@nestjs/common";
import { PermissionsController } from "./permissions.controller";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "./permissions.service";
import { PermissionGuard } from "./permission.guard";
import { ScopeGuard } from "./scope.guard";
import { Reflector } from "@nestjs/core";

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionGuard, ScopeGuard, Reflector],
  exports: [PermissionsService, PermissionGuard, ScopeGuard],
})
export class PermissionsModule {}
