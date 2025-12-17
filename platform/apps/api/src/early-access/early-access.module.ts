import { Module } from "@nestjs/common";
import { EarlyAccessController } from "./early-access.controller";
import { EarlyAccessService } from "./early-access.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [EarlyAccessController],
  providers: [EarlyAccessService],
  exports: [EarlyAccessService]
})
export class EarlyAccessModule {}
