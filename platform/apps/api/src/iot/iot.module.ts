import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "../prisma/prisma.module";
import { IotSimulatorService } from "./iot-simulator.service";
import { IotController } from "./iot.controller";
import { QRCodeService } from "./qr-code.service";
import { QRCodeController, QRCodePublicController } from "./qr-code.controller";

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [IotController, QRCodeController, QRCodePublicController],
  providers: [IotSimulatorService, QRCodeService],
  exports: [IotSimulatorService, QRCodeService],
})
export class IotModule {}
