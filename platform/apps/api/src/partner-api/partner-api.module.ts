import { Module, forwardRef } from "@nestjs/common";
import { PartnerApiController } from "./partner-api.controller";
import { PartnerApiService } from "./partner-api.service";
import { PrismaService } from "../prisma/prisma.service";
import { ApiTokenGuard } from "../developer-api/guards/api-token.guard";
import { ApiScopeGuard } from "../developer-api/guards/api-scope.guard";
import { InventoryModule } from "../inventory/inventory.module";

@Module({
  imports: [forwardRef(() => InventoryModule)],
  controllers: [PartnerApiController],
  providers: [PartnerApiService, PrismaService, ApiTokenGuard, ApiScopeGuard],
  exports: [PartnerApiService],
})
export class PartnerApiModule {}
