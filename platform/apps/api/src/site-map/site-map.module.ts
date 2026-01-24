import { Module } from "@nestjs/common";
import { SiteMapService } from "./site-map.service";
import { SiteMapController } from "./site-map.controller";
import { UploadsModule } from "../uploads/uploads.module";
@Module({
  imports: [UploadsModule],
  controllers: [SiteMapController],
  providers: [SiteMapService],
  exports: [SiteMapService],
})
export class SiteMapModule {}
