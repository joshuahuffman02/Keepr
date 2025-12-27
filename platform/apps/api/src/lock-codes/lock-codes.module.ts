import { Module } from '@nestjs/common';
import { LockCodesService } from './lock-codes.service';
import { LockCodesController } from './lock-codes.controller';

@Module({
    controllers: [LockCodesController],
    providers: [LockCodesService],
    exports: [LockCodesService],
})
export class LockCodesModule { }
