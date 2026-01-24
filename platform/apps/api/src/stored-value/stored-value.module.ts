import { Module } from "@nestjs/common";
import { StoredValueController } from "./stored-value.controller";
import { StoredValueService } from "./stored-value.service";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PermissionsModule],
  controllers: [StoredValueController],
  providers: [StoredValueService, IdempotencyService],
  exports: [StoredValueService],
})
export class StoredValueModule {}
