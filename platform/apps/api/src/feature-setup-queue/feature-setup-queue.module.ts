import { Module } from "@nestjs/common";
import { FeatureSetupQueueController } from "./feature-setup-queue.controller";
import { FeatureSetupQueueService } from "./feature-setup-queue.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [FeatureSetupQueueController],
  providers: [FeatureSetupQueueService],
  exports: [FeatureSetupQueueService],
})
export class FeatureSetupQueueModule {}
