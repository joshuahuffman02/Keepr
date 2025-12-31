import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PushSubscriptionsService } from "./push-subscriptions.service";
import { MobilePushService } from "./mobile-push.service";
import { PushSubscriptionsController } from "./push-subscriptions.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  controllers: [PushSubscriptionsController],
  providers: [PushSubscriptionsService, MobilePushService],
  exports: [MobilePushService],
})
export class PushSubscriptionsModule {}

