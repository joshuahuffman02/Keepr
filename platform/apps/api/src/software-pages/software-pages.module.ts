import { Module } from "@nestjs/common";
import {
  PublicSoftwarePagesController,
  AdminSoftwarePagesController,
} from "./software-pages.controller";
import { SoftwarePagesService } from "./software-pages.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [PublicSoftwarePagesController, AdminSoftwarePagesController],
  providers: [SoftwarePagesService],
  exports: [SoftwarePagesService],
})
export class SoftwarePagesModule {}
