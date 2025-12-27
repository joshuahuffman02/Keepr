import { Module } from '@nestjs/common';
import { StayRulesService } from './stay-rules.service';
import { StayRulesController } from './stay-rules.controller';

@Module({
    controllers: [StayRulesController],
    providers: [StayRulesService],
    exports: [StayRulesService],
})
export class StayRulesModule { }
