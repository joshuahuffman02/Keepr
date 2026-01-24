import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SocialPlannerController } from "./social-planner.controller";
import { SocialPlannerService } from "./social-planner.service";
import { SocialPlannerScheduler } from "./social-planner.scheduler";

@Module({
  controllers: [SocialPlannerController],
  providers: [SocialPlannerService, SocialPlannerScheduler],
  exports: [SocialPlannerService],
})
export class SocialPlannerModule {}
