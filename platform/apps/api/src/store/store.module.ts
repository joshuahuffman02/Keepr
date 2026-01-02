import { Module, forwardRef } from "@nestjs/common";
import { StoreService } from "./store.service";
import { StoreController } from "./store.controller";
import { LocationService } from "./location.service";
import { LocationController } from "./location.controller";
import { TransferService } from "./transfer.service";
import { TransferController } from "./transfer.controller";
import { FulfillmentService } from "./fulfillment.service";
import { FulfillmentController } from "./fulfillment.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailService } from "../email/email.service";
import { InventoryModule } from "../inventory/inventory.module";
import { PaymentsModule } from "../payments/payments.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
    imports: [PrismaModule, forwardRef(() => InventoryModule), PaymentsModule, PermissionsModule],
    controllers: [StoreController, LocationController, TransferController, FulfillmentController],
    providers: [StoreService, LocationService, TransferService, FulfillmentService, EmailService],
    exports: [StoreService, LocationService, TransferService, FulfillmentService],
})
export class StoreModule {}
