import { Module } from '@nestjs/common';
import { SeasonalRatesService } from './seasonal-rates.service';
import { SeasonalRatesController } from './seasonal-rates.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [SeasonalRatesController],
    providers: [SeasonalRatesService],
    exports: [SeasonalRatesService],
})
export class SeasonalRatesModule { }
