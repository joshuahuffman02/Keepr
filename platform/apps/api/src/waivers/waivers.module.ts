import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WaiversService } from "./waivers.service";

@Module({
  imports: [PrismaModule],
  providers: [WaiversService],
  exports: [WaiversService],
})
export class WaiversModule {}
