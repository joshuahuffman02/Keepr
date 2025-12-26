import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../prisma/prisma.module';
import { OpTasksController } from './op-tasks.controller';
import { OpReservationListener } from './op-reservation.listener';
import {
  OpTaskService,
  OpTemplateService,
  OpTriggerService,
  OpRecurrenceService,
  OpTeamService,
  OpSlaService,
} from './services';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
  ],
  controllers: [OpTasksController],
  providers: [
    OpTaskService,
    OpTemplateService,
    OpTriggerService,
    OpRecurrenceService,
    OpTeamService,
    OpSlaService,
    OpReservationListener,
  ],
  exports: [
    OpTaskService,
    OpTemplateService,
    OpTriggerService,
    OpRecurrenceService,
    OpTeamService,
    OpSlaService,
  ],
})
export class OpTasksModule {}
