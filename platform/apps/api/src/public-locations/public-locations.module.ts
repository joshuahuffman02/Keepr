import { Module } from "@nestjs/common";
import {
  PublicLocationsController,
  PublicAttractionsController,
} from "./public-locations.controller";
import { PublicLocationsService } from "./public-locations.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [PublicLocationsController, PublicAttractionsController],
  providers: [PublicLocationsService],
  exports: [PublicLocationsService],
})
export class PublicLocationsModule {}
