import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { PrismaService } from "../prisma/prisma.service";
import { QuickBooksModule } from "./quickbooks/quickbooks.module";
import { MarketplaceModule } from "./marketplace.module";

@Module({
  imports: [QuickBooksModule, MarketplaceModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [QuickBooksModule, MarketplaceModule],
})
export class IntegrationsModule { }

