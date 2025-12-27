import { Module, forwardRef } from '@nestjs/common';
import { AiPrivacyService } from './ai-privacy.service';
import { AiProviderService } from './ai-provider.service';
import { AiFeatureGateService } from './ai-feature-gate.service';
import { AiReplyAssistService } from './ai-reply-assist.service';
import { AiInsightsService } from './ai-insights.service';
import { AiBookingAssistService } from './ai-booking-assist.service';
import { AiSupportService } from './ai-support.service';
import { AiPartnerService } from './ai-partner.service';
import { AiAutopilotConfigService } from './ai-autopilot-config.service';
import { AiAutoReplyService } from './ai-auto-reply.service';
import { AiSmartWaitlistService } from './ai-smart-waitlist.service';
import { AiAnomalyDetectionService } from './ai-anomaly-detection.service';
import { AiNoShowPredictionService } from './ai-no-show-prediction.service';
import { AiController } from './ai.controller';
import { AiAutopilotController } from './ai-autopilot.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicReservationsModule } from '../public-reservations/public-reservations.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { HoldsModule } from '../holds/holds.module';
import { PricingV2Module } from '../pricing-v2/pricing-v2.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { RepeatChargesModule } from '../repeat-charges/repeat-charges.module';
import { SeasonalRatesModule } from '../seasonal-rates/seasonal-rates.module';
import { OperationsModule } from '../operations/operations.module';
import { EmailModule } from '../email/email.module';
import { AnomaliesModule } from '../anomalies/anomalies.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PublicReservationsModule),
    PermissionsModule,
    AuditModule,
    HoldsModule,
    forwardRef(() => PricingV2Module),
    forwardRef(() => MaintenanceModule),
    OperationsModule,
    forwardRef(() => ReservationsModule),
    forwardRef(() => RepeatChargesModule),
    forwardRef(() => SeasonalRatesModule),
    EmailModule,
    AnomaliesModule,
  ],
  controllers: [AiController, AiAutopilotController],
  providers: [
    AiPrivacyService,
    AiProviderService,
    AiFeatureGateService,
    AiReplyAssistService,
    AiInsightsService,
    AiBookingAssistService,
    AiSupportService,
    AiPartnerService,
    // AI Autopilot Services
    AiAutopilotConfigService,
    AiAutoReplyService,
    AiSmartWaitlistService,
    AiAnomalyDetectionService,
    AiNoShowPredictionService,
  ],
  exports: [
    AiPrivacyService,
    AiProviderService,
    AiFeatureGateService,
    AiReplyAssistService,
    AiInsightsService,
    AiBookingAssistService,
    AiSupportService,
    AiPartnerService,
    // AI Autopilot Exports
    AiAutopilotConfigService,
    AiAutoReplyService,
    AiSmartWaitlistService,
    AiAnomalyDetectionService,
    AiNoShowPredictionService,
  ],
})
export class AiModule { }
