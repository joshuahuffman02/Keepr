import { Module } from "@nestjs/common";
import { SiteClassesService } from "./site-classes.service";
import { SiteClassesController } from "./site-classes.controller";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PermissionsModule],
  controllers: [SiteClassesController],
  providers: [SiteClassesService],
})
export class SiteClassesModule {}
