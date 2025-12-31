import { Module } from "@nestjs/common";
import { PublicCampgroundsController } from "./public-campgrounds.controller";
import { PublicCampgroundsService } from "./public-campgrounds.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [PublicCampgroundsController],
  providers: [PublicCampgroundsService],
  exports: [PublicCampgroundsService],
})
export class PublicCampgroundsModule {}
