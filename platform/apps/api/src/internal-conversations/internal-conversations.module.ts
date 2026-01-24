import { Module } from "@nestjs/common";
import { InternalConversationsService } from "./internal-conversations.service";
import { InternalConversationsController } from "./internal-conversations.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [InternalConversationsController],
  providers: [InternalConversationsService],
  exports: [InternalConversationsService],
})
export class InternalConversationsModule {}
