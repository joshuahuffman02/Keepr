import { Module } from "@nestjs/common";
import { ClaimsService } from "./claims.service";
import { ClaimsController, AdminClaimsController } from "./claims.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ClaimsController, AdminClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
