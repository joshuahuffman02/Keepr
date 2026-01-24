import { Module } from "@nestjs/common";
import { NpsController } from "./nps.controller";
import { NpsService } from "./nps.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailModule } from "../email/email.module";
import { SupportModule } from "../support/support.module";

@Module({
  imports: [EmailModule, SupportModule],
  controllers: [NpsController],
  providers: [NpsService],
  exports: [NpsService],
})
export class NpsModule {}
