import { Module, forwardRef } from '@nestjs/common';
import { RepeatChargesService } from './repeat-charges.service';
import { RepeatChargesController } from './repeat-charges.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SeasonalRatesModule } from '../seasonal-rates/seasonal-rates.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
    imports: [SeasonalRatesModule, forwardRef(() => PaymentsModule)],
    controllers: [RepeatChargesController],
    providers: [RepeatChargesService],
    exports: [RepeatChargesService],
})
export class RepeatChargesModule { }
