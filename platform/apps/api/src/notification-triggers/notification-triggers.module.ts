import { Module } from "@nestjs/common";
import {
  NotificationTriggersController,
  NotificationTriggersByIdController,
} from "./notification-triggers.controller";
import { NotificationTriggersService } from "./notification-triggers.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";
import { SmsModule } from "../sms/sms.module";

@Module({
  imports: [PrismaModule, EmailModule, SmsModule],
  controllers: [NotificationTriggersController, NotificationTriggersByIdController],
  providers: [NotificationTriggersService],
  exports: [NotificationTriggersService],
})
export class NotificationTriggersModule {}
