import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { IotSimulatorService } from './iot-simulator.service';
import { IotController } from './iot.controller';

@Module({
    imports: [PrismaModule, ScheduleModule.forRoot()],
    controllers: [IotController],
    providers: [IotSimulatorService],
    exports: [IotSimulatorService],
})
export class IotModule { }
