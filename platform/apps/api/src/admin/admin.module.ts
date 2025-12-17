import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditLogService } from "./audit-log.service";
import { AuditLogController } from "./audit-log.controller";
import { FeatureFlagService } from "./feature-flag.service";
import { FeatureFlagController } from "./feature-flag.controller";
import { AnnouncementService } from "./announcement.service";
import { AnnouncementController } from "./announcement.controller";
import { AdminCampgroundController } from "./admin-campground.controller";
import { GuestAnalyticsService } from "./guest-analytics.service";
import { GuestAnalyticsController } from "./guest-analytics.controller";
import { GuestSegmentService } from "./guest-segment.service";
import { GuestSegmentController } from "./guest-segment.controller";

@Module({
    imports: [PrismaModule],
    controllers: [
        AuditLogController,
        FeatureFlagController,
        AnnouncementController,
        AdminCampgroundController,
        GuestAnalyticsController,
        GuestSegmentController,
    ],
    providers: [
        AuditLogService,
        FeatureFlagService,
        AnnouncementService,
        GuestAnalyticsService,
        GuestSegmentService,
    ],
    exports: [
        AuditLogService,
        FeatureFlagService,
        AnnouncementService,
        GuestAnalyticsService,
        GuestSegmentService,
    ],
})
export class AdminModule { }

