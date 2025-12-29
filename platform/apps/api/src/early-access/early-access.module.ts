import { Module, OnModuleInit, Logger } from "@nestjs/common";
import { EarlyAccessController } from "./early-access.controller";
import { EarlyAccessService } from "./early-access.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [EarlyAccessController],
  providers: [EarlyAccessService],
  exports: [EarlyAccessService]
})
export class EarlyAccessModule implements OnModuleInit {
  private readonly logger = new Logger(EarlyAccessModule.name);

  constructor(private readonly earlyAccessService: EarlyAccessService) {}

  async onModuleInit() {
    // Initialize early access spots on app startup
    try {
      await this.earlyAccessService.initializeSpots();
      this.logger.log("Spots initialized successfully");
    } catch (err) {
      this.logger.error("Failed to initialize spots:", err instanceof Error ? err.stack : err);
    }
  }
}
