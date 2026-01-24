import { Module } from "@nestjs/common";
import { GuestEquipmentService } from "./guest-equipment.service";
import { GuestEquipmentController } from "./guest-equipment.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [GuestEquipmentController],
  providers: [GuestEquipmentService],
  exports: [GuestEquipmentService],
})
export class GuestEquipmentModule {}
