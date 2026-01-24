import { Module } from "@nestjs/common";
import { MarketplaceController } from "./marketplace.controller";
import { IntegrationRegistryService } from "./integration-registry.service";
import { IntegrationFrameworkService } from "./framework/integration-framework.service";
import { CredentialEncryptionService } from "./framework/credential-encryption.service";
import { PrismaModule } from "../prisma/prisma.module";
import { QuickBooksMarketplaceProvider } from "./providers/quickbooks-marketplace.provider";

/**
 * Marketplace Module
 *
 * Provides the integration marketplace functionality including:
 * - Browsing available integrations
 * - Connecting/disconnecting integrations
 * - Managing connection credentials
 * - Triggering syncs
 * - Handling webhooks
 */
@Module({
  imports: [PrismaModule],
  controllers: [MarketplaceController],
  providers: [
    CredentialEncryptionService,
    IntegrationFrameworkService,
    IntegrationRegistryService,
    QuickBooksMarketplaceProvider,
  ],
  exports: [IntegrationFrameworkService, IntegrationRegistryService, CredentialEncryptionService],
})
export class MarketplaceModule {}
