import { Module } from "@nestjs/common";
import { GiftCardsController } from "./gift-cards.controller";
import { GiftCardsService } from "./gift-cards.service";
import { StoredValueModule } from "../stored-value/stored-value.module";

@Module({
  imports: [StoredValueModule],
  controllers: [GiftCardsController],
  providers: [GiftCardsService],
  exports: [GiftCardsService]
})
export class GiftCardsModule {}
