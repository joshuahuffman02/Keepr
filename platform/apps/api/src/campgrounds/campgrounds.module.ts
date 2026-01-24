import { Module } from "@nestjs/common";
import { CampgroundsService } from "./campgrounds.service";
import { CampgroundsController } from "./campgrounds.controller";
import { PrismaService } from "../prisma/prisma.service";
import { EmailModule } from "../email/email.module";
import { AuditModule } from "../audit/audit.module";
import { CampgroundsIngestScheduler } from "./campgrounds.scheduler";
import { CampgroundAssetsService } from "./campground-assets.service";
import { CampgroundReviewConnectors } from "./campground-review-connectors.service";

@Module({
  imports: [EmailModule, AuditModule],
  controllers: [CampgroundsController],
  providers: [
    CampgroundsService,
    PrismaService,
    CampgroundsIngestScheduler,
    CampgroundAssetsService,
    CampgroundReviewConnectors,
  ],
  exports: [CampgroundsService],
})
export class CampgroundsModule {}
