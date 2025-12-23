import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { BatchInventoryService } from "./batch-inventory.service";
import { MarkdownRulesService } from "./markdown-rules.service";
import { ExpirationAlertService } from "./expiration-alert.service";
import { SlowMovingInventoryService } from "./slow-moving.service";
import { BatchInventoryController } from "./batch-inventory.controller";
import { MarkdownRulesController } from "./markdown-rules.controller";
import { StoreModule } from "../store/store.module";
import { PosModule } from "../pos/pos.module";
import { DeveloperApiModule } from "../developer-api/developer-api.module";

@Module({
    imports: [
        PrismaModule,
        forwardRef(() => StoreModule),
        forwardRef(() => PosModule),
        DeveloperApiModule,
    ],
    controllers: [BatchInventoryController, MarkdownRulesController],
    providers: [
        BatchInventoryService,
        MarkdownRulesService,
        ExpirationAlertService,
        SlowMovingInventoryService,
    ],
    exports: [
        BatchInventoryService,
        MarkdownRulesService,
        ExpirationAlertService,
        SlowMovingInventoryService,
    ],
})
export class InventoryModule {}
