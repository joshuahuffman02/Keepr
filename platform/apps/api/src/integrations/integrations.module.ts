import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { PrismaService } from "../prisma/prisma.service";
import { QuickBooksModule } from "./quickbooks/quickbooks.module";
import { MarketplaceModule } from "./marketplace.module";
import { OtaSyncModule } from "./ota-sync/ota-sync.module";

@Module({
  imports: [QuickBooksModule, MarketplaceModule, OtaSyncModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [QuickBooksModule, MarketplaceModule, OtaSyncModule],
})
export class IntegrationsModule {}
