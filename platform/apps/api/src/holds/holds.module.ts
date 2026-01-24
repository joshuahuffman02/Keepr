import { Module } from "@nestjs/common";
import { HoldsService } from "./holds.service";
import { HoldsController } from "./holds.controller";
import { PrismaService } from "../prisma/prisma.service";
import { WaitlistModule } from "../waitlist/waitlist.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [WaitlistModule, PermissionsModule],
  controllers: [HoldsController],
  providers: [HoldsService],
  exports: [HoldsService],
})
export class HoldsModule {}
