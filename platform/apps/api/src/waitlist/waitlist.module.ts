import { Module } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { WaitlistStatsController } from "./waitlist-stats.controller";
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { IdempotencyService } from '../payments/idempotency.service';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
    imports: [PrismaModule, EmailModule, ObservabilityModule],
    controllers: [WaitlistController, WaitlistStatsController],
    providers: [WaitlistService, IdempotencyService],
    exports: [WaitlistService],
})
export class WaitlistModule { }
