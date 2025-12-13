import { Module } from "@nestjs/common";
import { StoredValueController } from "./stored-value.controller";
import { StoredValueService } from "./stored-value.service";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";

@Module({
  controllers: [StoredValueController],
  providers: [StoredValueService, IdempotencyService],
  exports: [StoredValueService]
})
export class StoredValueModule {}
