import { Module } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { CampaignsController } from "./campaigns.controller";
import { PrismaService } from "../prisma/prisma.service";
import { EmailModule } from "../email/email.module";
import { SmsModule } from "../sms/sms.module";
import { CampaignsScheduler } from "./campaigns.scheduler";
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [EmailModule, SmsModule, ScheduleModule.forRoot()],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignsScheduler]
})
export class CampaignsModule { }

