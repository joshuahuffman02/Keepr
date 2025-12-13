import { Module } from "@nestjs/common";
import { FormsService } from "./forms.service";
import { FormsController } from "./forms.controller";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [FormsController],
  providers: [FormsService],
})
export class FormsModule {}

