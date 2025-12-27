import { Module, forwardRef } from "@nestjs/common";
import { CommunicationsController } from "./communications.controller";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { SmsModule } from "../sms/sms.module";
import { NpsModule } from "../nps/nps.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { ObservabilityModule } from "../observability/observability.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [SmsModule, NpsModule, PermissionsModule, ObservabilityModule, forwardRef(() => AiModule)],
  controllers: [CommunicationsController],
  providers: [EmailService],
  exports: []
})
export class CommunicationsModule { }

