import { Module } from "@nestjs/common";
import { OtaSyncController } from "./ota-sync.controller";
import { OtaSyncService } from "./ota-sync.service";

@Module({
  controllers: [OtaSyncController],
  providers: [OtaSyncService],
  exports: [OtaSyncService],
})
export class OtaSyncModule {}
