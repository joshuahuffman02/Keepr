import { Module } from "@nestjs/common";
import { ValueStackService } from "./value-stack.service";
import { ValueStackController, PublicValueStackController } from "./value-stack.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ValueStackController, PublicValueStackController],
  providers: [ValueStackService],
  exports: [ValueStackService],
})
export class ValueStackModule {}
