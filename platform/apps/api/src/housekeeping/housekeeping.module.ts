import { Module } from "@nestjs/common";
import { HousekeepingController } from "./housekeeping.controller";
import { HousekeepingService } from "./housekeeping.service";
import { InspectionService } from "./inspection.service";
import { PrismaModule } from "../prisma/prisma.module";
import { TasksModule } from "../tasks/tasks.module";

@Module({
  imports: [PrismaModule, TasksModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService, InspectionService],
  exports: [HousekeepingService, InspectionService],
})
export class HousekeepingModule {}
