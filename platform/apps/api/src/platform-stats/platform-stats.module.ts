import { Module } from "@nestjs/common";
import { PlatformStatsService } from "./platform-stats.service";
import { PlatformStatsController } from "./platform-stats.controller";

@Module({
  providers: [PlatformStatsService],
  controllers: [PlatformStatsController],
  exports: [PlatformStatsService],
})
export class PlatformStatsModule {}
