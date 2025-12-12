import { Module } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { IdempotencyService } from '../payments/idempotency.service';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
    imports: [PrismaModule, EmailModule, ObservabilityModule],
    controllers: [WaitlistController],
    providers: [WaitlistService, IdempotencyService],
    exports: [WaitlistService],
})
export class WaitlistModule { }
