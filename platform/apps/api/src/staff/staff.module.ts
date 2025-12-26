import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { PayrollService } from "./payroll.service";

@Module({
  imports: [PrismaModule, AuditModule, EmailModule],
  controllers: [StaffController],
  providers: [StaffService, PayrollService],
  exports: [StaffService, PayrollService],
})
export class StaffModule {}

