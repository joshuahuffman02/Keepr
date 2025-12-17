import { Module } from '@nestjs/common';
import { SelfCheckinController } from './self-checkin.controller';
import { SelfCheckinService } from './self-checkin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SignaturesModule } from '../signatures/signatures.module';
import { AuditModule } from '../audit/audit.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, SignaturesModule, AuditModule, AccessControlModule, PaymentsModule],
  controllers: [SelfCheckinController],
  providers: [SelfCheckinService],
  exports: [SelfCheckinService],
})
export class SelfCheckinModule {}

