import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SignaturesModule } from "../signatures/signatures.module";
import { PoliciesController } from "./policies.controller";
import { PoliciesService } from "./policies.service";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PrismaModule, SignaturesModule, PermissionsModule],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
