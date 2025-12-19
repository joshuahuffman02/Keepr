import { Module } from "@nestjs/common";
import { SiteMapService } from "./site-map.service";
import { SiteMapController } from "./site-map.controller";
@Module({
  controllers: [SiteMapController],
  providers: [SiteMapService],
  exports: [SiteMapService]
})
export class SiteMapModule {}
