import { Module } from "@nestjs/common";
import { LedgerService } from "./ledger.service";
import { LedgerController } from "./ledger.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
