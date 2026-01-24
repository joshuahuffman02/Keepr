import { Module } from "@nestjs/common";
import { PublicEventsController } from "./public-events.controller";
import { PublicEventsService } from "./public-events.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [PublicEventsController],
  providers: [PublicEventsService],
  exports: [PublicEventsService],
})
export class PublicEventsModule {}
