import { Module } from "@nestjs/common";
import { SmsService } from "./sms.service";
import { UsageTrackerModule } from "../org-billing/usage-tracker.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [UsageTrackerModule, PrismaModule],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
