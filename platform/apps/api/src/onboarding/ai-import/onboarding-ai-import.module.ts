import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { OnboardingAiImportService } from "./onboarding-ai-import.service";
import { OnboardingAiImportController } from "./onboarding-ai-import.controller";
import { DocumentClassifierService } from "./document-classifier.service";
import { OnboardingModule } from "../onboarding.module";

@Module({
  imports: [PrismaModule, forwardRef(() => OnboardingModule)],
  controllers: [OnboardingAiImportController],
  providers: [OnboardingAiImportService, DocumentClassifierService],
  exports: [OnboardingAiImportService, DocumentClassifierService],
})
export class OnboardingAiImportModule {}
