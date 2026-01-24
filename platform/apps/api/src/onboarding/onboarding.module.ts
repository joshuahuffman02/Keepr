import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";
import { PaymentsModule } from "../payments/payments.module";
import { IdempotencyService } from "../payments/idempotency.service";
import { OnboardingService } from "./onboarding.service";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingTokenGateService } from "./onboarding-token-gate.service";
import { OnboardingGoLiveCheckService } from "./onboarding-go-live-check.service";
import {
  OnboardingAiImportService,
  DocumentClassifierService,
  OnboardingAiImportController,
} from "./ai-import";

@Module({
  imports: [PrismaModule, EmailModule, forwardRef(() => PaymentsModule)],
  controllers: [OnboardingController, OnboardingAiImportController],
  providers: [
    OnboardingService,
    IdempotencyService,
    OnboardingTokenGateService,
    OnboardingGoLiveCheckService,
    OnboardingAiImportService,
    DocumentClassifierService,
  ],
  exports: [
    OnboardingService,
    OnboardingTokenGateService,
    OnboardingAiImportService,
    OnboardingGoLiveCheckService,
  ],
})
export class OnboardingModule {}
