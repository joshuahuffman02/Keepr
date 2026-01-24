import { Module } from "@nestjs/common";
import { SignaturesController } from "./signatures.controller";
import { SignaturesService } from "./signatures.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";
import { SmsModule } from "../sms/sms.module";
import { AuditModule } from "../audit/audit.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PrismaModule, EmailModule, SmsModule, AuditModule, PermissionsModule],
  controllers: [SignaturesController],
  providers: [SignaturesService],
  exports: [SignaturesService],
})
export class SignaturesModule {}
