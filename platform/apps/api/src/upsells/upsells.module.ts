import { Module } from "@nestjs/common";
import { UpsellsController } from "./upsells.controller";
import { UpsellsService } from "./upsells.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [UpsellsController],
  providers: [UpsellsService],
  exports: [UpsellsService]
})
export class UpsellsModule {}

