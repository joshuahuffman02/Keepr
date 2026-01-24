import { Module } from "@nestjs/common";
import { LocalizationService } from "./localization.service";
import { LocalizationController } from "./localization.controller";

@Module({
  controllers: [LocalizationController],
  providers: [LocalizationService],
  exports: [LocalizationService],
})
export class LocalizationModule {}
