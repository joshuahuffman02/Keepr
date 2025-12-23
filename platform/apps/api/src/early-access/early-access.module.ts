import { Module, OnModuleInit } from "@nestjs/common";
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
  constructor(private readonly earlyAccessService: EarlyAccessService) {}

  async onModuleInit() {
    // Initialize early access spots on app startup
    try {
      await this.earlyAccessService.initializeSpots();
      console.log("[EarlyAccess] Spots initialized successfully");
    } catch (err) {
      console.error("[EarlyAccess] Failed to initialize spots:", err);
    }
  }
}
