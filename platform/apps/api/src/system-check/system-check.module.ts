import { Module } from "@nestjs/common";
import { SystemCheckService } from "./system-check.service";
import { SystemCheckController } from "./system-check.controller";

@Module({
  controllers: [SystemCheckController],
  providers: [SystemCheckService],
  exports: [SystemCheckService],
})
export class SystemCheckModule {}
