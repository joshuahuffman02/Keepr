import { Module } from "@nestjs/common";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";
import { BlocksController } from "./blocks.controller";
import { BlocksService } from "./blocks.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [GroupsController, BlocksController],
  providers: [GroupsService, BlocksService],
  exports: [GroupsService, BlocksService],
})
export class GroupsModule {}
