import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentsModule } from "../payments/payments.module";
import { AuthModule } from "../auth/auth.module";
import { PermissionsModule } from "../permissions/permissions.module";

// Services
import { CustomerService } from "./customer.service";
import { PaymentMethodService } from "./payment-method.service";
import { TerminalService } from "./terminal.service";
import { TerminalPaymentService } from "./terminal-payment.service";
import { SavedCardService } from "./saved-card.service";
import { RefundService } from "./refund.service";

// Controllers
import {
  PaymentMethodController,
  TerminalController,
  SavedCardController,
  RefundController,
} from "./stripe-payments.controller";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => PermissionsModule),
  ],
  controllers: [PaymentMethodController, TerminalController, SavedCardController, RefundController],
  providers: [
    CustomerService,
    PaymentMethodService,
    TerminalService,
    TerminalPaymentService,
    SavedCardService,
    RefundService,
  ],
  exports: [
    CustomerService,
    PaymentMethodService,
    TerminalService,
    TerminalPaymentService,
    SavedCardService,
    RefundService,
  ],
})
export class StripePaymentsModule {}
