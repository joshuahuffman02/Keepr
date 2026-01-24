import { Module } from "@nestjs/common";
import { CurrencyTaxService } from "./currency-tax.service";
import { CurrencyTaxController } from "./currency-tax.controller";

@Module({
  controllers: [CurrencyTaxController],
  providers: [CurrencyTaxService],
  exports: [CurrencyTaxService],
})
export class CurrencyTaxModule {}
