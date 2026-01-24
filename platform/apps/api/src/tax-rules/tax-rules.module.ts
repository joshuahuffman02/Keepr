import { Module } from "@nestjs/common";
import { TaxRulesService } from "./tax-rules.service";
import { TaxRulesController } from "./tax-rules.controller";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PermissionsModule],
  controllers: [TaxRulesController],
  providers: [TaxRulesService],
  exports: [TaxRulesService],
})
export class TaxRulesModule {}
