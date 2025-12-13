import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "./ai.service";
import { AiController } from "./ai.controller";

@Module({
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}

