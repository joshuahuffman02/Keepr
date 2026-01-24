import { Module } from "@nestjs/common";
import { AbandonedCartService } from "./abandoned-cart.service";
import { AbandonedCartController } from "./abandoned-cart.controller";

@Module({
  imports: [],
  controllers: [AbandonedCartController],
  providers: [AbandonedCartService],
  exports: [AbandonedCartService],
})
export class AbandonedCartModule {}
