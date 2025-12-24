import { Module } from "@nestjs/common";
import { MenuConfigController } from "./menu-config.controller";
import { MenuConfigService } from "./menu-config.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [MenuConfigController],
  providers: [MenuConfigService],
  exports: [MenuConfigService],
})
export class MenuConfigModule {}
