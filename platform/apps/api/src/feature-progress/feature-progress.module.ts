import { Module } from "@nestjs/common";
import { FeatureProgressController } from "./feature-progress.controller";
import { FeatureProgressService } from "./feature-progress.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [FeatureProgressController],
  providers: [FeatureProgressService],
  exports: [FeatureProgressService],
})
export class FeatureProgressModule {}
