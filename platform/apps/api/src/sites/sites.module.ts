import { Module } from "@nestjs/common";
import { SitesService } from "./sites.service";
import { SitesController } from "./sites.controller";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService]
})
export class SitesModule {}
