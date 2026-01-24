import { Module } from "@nestjs/common";
import { RoomMovesController } from "./room-moves.controller";
import { RoomMovesService } from "./room-moves.service";
import { PrismaModule } from "../prisma/prisma.module";
import { HousekeepingModule } from "../housekeeping/housekeeping.module";

@Module({
  imports: [PrismaModule, HousekeepingModule],
  controllers: [RoomMovesController],
  providers: [RoomMovesService],
  exports: [RoomMovesService],
})
export class RoomMovesModule {}
