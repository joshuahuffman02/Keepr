import { Module, forwardRef } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { PrismaModule } from "../prisma/prisma.module";
import { GamificationModule } from "../gamification/gamification.module";
import { EmailModule } from "../email/email.module";
import { OpTasksController } from "./op-tasks.controller";
import { OpReservationListener } from "./op-reservation.listener";
import {
  OpTaskService,
  OpTemplateService,
  OpTriggerService,
  OpRecurrenceService,
  OpTeamService,
  OpSlaService,
} from "./services";
import { OpGamificationService } from "./services/op-gamification.service";

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    forwardRef(() => GamificationModule),
    EmailModule,
  ],
  controllers: [OpTasksController],
  providers: [
    OpTaskService,
    OpTemplateService,
    OpTriggerService,
    OpRecurrenceService,
    OpTeamService,
    OpSlaService,
    OpGamificationService,
    OpReservationListener,
  ],
  exports: [
    OpTaskService,
    OpTemplateService,
    OpTriggerService,
    OpRecurrenceService,
    OpTeamService,
    OpSlaService,
    OpGamificationService,
  ],
})
export class OpTasksModule {}
