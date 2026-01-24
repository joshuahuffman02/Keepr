import { Module } from "@nestjs/common";
import { MaintenanceController } from "./maintenance.controller";
import { MaintenanceService } from "./maintenance.service";
import { PrismaModule } from "../prisma/prisma.module";
import { GamificationModule } from "../gamification/gamification.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [PrismaModule, GamificationModule, EmailModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
