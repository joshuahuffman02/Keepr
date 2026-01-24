import { Module } from "@nestjs/common";
import { StayRulesService } from "./stay-rules.service";
import { StayRulesController } from "./stay-rules.controller";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PermissionsModule],
  controllers: [StayRulesController],
  providers: [StayRulesService],
  exports: [StayRulesService],
})
export class StayRulesModule {}
