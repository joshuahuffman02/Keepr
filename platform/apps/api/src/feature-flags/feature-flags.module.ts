import { Module } from "@nestjs/common";
import { FeatureFlagsController } from "./feature-flags.controller";
import { AdminModule } from "../admin/admin.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AdminModule, AuthModule],
  controllers: [FeatureFlagsController],
})
export class FeatureFlagsModule {}
