import { Module } from "@nestjs/common";
import { CompetitiveController } from "./competitive.controller";
import { CompetitiveService } from "./competitive.service";

@Module({
  controllers: [CompetitiveController],
  providers: [CompetitiveService],
  exports: [CompetitiveService],
})
export class CompetitiveModule {}
