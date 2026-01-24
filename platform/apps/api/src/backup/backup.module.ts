import { Module } from "@nestjs/common";
import { BackupController } from "./backup.controller";
import { BackupService, BackupProvider, HttpBackupProvider } from "./backup.service";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PermissionsModule],
  controllers: [BackupController],
  providers: [
    BackupService,
    PrismaService,
    {
      provide: BackupProvider,
      useFactory: () => new HttpBackupProvider(),
    },
  ],
  exports: [BackupService, BackupProvider],
})
export class BackupModule {}
