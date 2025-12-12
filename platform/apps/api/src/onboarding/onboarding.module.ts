import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";
import { IdempotencyService } from "../payments/idempotency.service";
import { OnboardingService } from "./onboarding.service";
import { OnboardingController } from "./onboarding.controller";

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, IdempotencyService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
