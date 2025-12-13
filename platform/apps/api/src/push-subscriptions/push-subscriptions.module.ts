import { Module } from "@nestjs/common";
import { PushSubscriptionsService } from "./push-subscriptions.service";
import { PushSubscriptionsController } from "./push-subscriptions.controller";
import { PrismaService } from "../prisma/prisma.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [PushSubscriptionsController],
  providers: [PushSubscriptionsService],
})
export class PushSubscriptionsModule {}

