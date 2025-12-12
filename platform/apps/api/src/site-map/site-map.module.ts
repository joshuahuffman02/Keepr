import { Module } from "@nestjs/common";
import { SiteMapService } from "./site-map.service";
import { SiteMapController } from "./site-map.controller";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [SiteMapController],
  providers: [SiteMapService, PrismaService],
  exports: [SiteMapService]
})
export class SiteMapModule {}
