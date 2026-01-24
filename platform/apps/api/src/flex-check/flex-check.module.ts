import { Module } from "@nestjs/common";
import { FlexCheckController } from "./flex-check.controller";
import { FlexCheckService } from "./flex-check.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [FlexCheckController],
  providers: [FlexCheckService],
  exports: [FlexCheckService],
})
export class FlexCheckModule {}
