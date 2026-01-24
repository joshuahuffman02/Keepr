import { Module } from "@nestjs/common";
import { FormsService } from "./forms.service";
import { FormsController } from "./forms.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
