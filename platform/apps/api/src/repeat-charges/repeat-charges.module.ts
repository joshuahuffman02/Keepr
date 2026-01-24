import { Module, forwardRef } from "@nestjs/common";
import { RepeatChargesService } from "./repeat-charges.service";
import { RepeatChargesController } from "./repeat-charges.controller";
import { PrismaService } from "../prisma/prisma.service";
import { SeasonalRatesModule } from "../seasonal-rates/seasonal-rates.module";
import { PaymentsModule } from "../payments/payments.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [SeasonalRatesModule, forwardRef(() => PaymentsModule), PermissionsModule],
  controllers: [RepeatChargesController],
  providers: [RepeatChargesService],
  exports: [RepeatChargesService],
})
export class RepeatChargesModule {}
