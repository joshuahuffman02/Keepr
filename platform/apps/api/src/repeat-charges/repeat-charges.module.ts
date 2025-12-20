import { Module } from '@nestjs/common';
import { RepeatChargesService } from './repeat-charges.service';
import { RepeatChargesController } from './repeat-charges.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SeasonalRatesModule } from '../seasonal-rates/seasonal-rates.module';

@Module({
    imports: [SeasonalRatesModule],
    controllers: [RepeatChargesController],
    providers: [RepeatChargesService],
    exports: [RepeatChargesService],
})
export class RepeatChargesModule { }
