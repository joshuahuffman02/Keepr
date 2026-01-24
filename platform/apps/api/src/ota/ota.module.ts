import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { OtaController } from "./ota.controller";
import { OtaPublicController } from "./ota-public.controller";
import { OtaService } from "./ota.service";

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [OtaController, OtaPublicController],
  providers: [OtaService],
  exports: [OtaService],
})
export class OtaModule {}
