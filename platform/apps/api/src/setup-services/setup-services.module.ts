import { Module } from "@nestjs/common";
import { SetupServicesController } from "./setup-services.controller";
import { SetupServicesService } from "./setup-services.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [SetupServicesController],
  providers: [SetupServicesService],
  exports: [SetupServicesService],
})
export class SetupServicesModule {}
