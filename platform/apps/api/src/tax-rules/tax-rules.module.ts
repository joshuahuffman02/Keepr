import { Module } from '@nestjs/common';
import { TaxRulesService } from './tax-rules.service';
import { TaxRulesController } from './tax-rules.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [TaxRulesController],
    providers: [TaxRulesService],
    exports: [TaxRulesService],
})
export class TaxRulesModule { }
