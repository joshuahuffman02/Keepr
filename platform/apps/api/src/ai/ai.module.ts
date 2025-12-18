import { Module, forwardRef } from '@nestjs/common';
import { AiPrivacyService } from './ai-privacy.service';
import { AiProviderService } from './ai-provider.service';
import { AiFeatureGateService } from './ai-feature-gate.service';
import { AiReplyAssistService } from './ai-reply-assist.service';
import { AiInsightsService } from './ai-insights.service';
import { AiBookingAssistService } from './ai-booking-assist.service';
import { AiSupportService } from './ai-support.service';
import { AiController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicReservationsModule } from '../public-reservations/public-reservations.module';

@Module({
  imports: [PrismaModule, forwardRef(() => PublicReservationsModule)],
  controllers: [AiController],
  providers: [
    AiPrivacyService,
    AiProviderService,
    AiFeatureGateService,
    AiReplyAssistService,
    AiInsightsService,
    AiBookingAssistService,
    AiSupportService,
  ],
  exports: [
    AiPrivacyService,
    AiProviderService,
    AiFeatureGateService,
    AiReplyAssistService,
    AiInsightsService,
    AiBookingAssistService,
    AiSupportService,
  ],
})
export class AiModule { }
