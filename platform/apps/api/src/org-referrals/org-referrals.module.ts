import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OrgReferralsService } from "./org-referrals.service";
import { OrgReferralsController } from "./org-referrals.controller";

@Module({
  imports: [PrismaModule],
  controllers: [OrgReferralsController],
  providers: [OrgReferralsService],
  exports: [OrgReferralsService]
})
export class OrgReferralsModule {}
