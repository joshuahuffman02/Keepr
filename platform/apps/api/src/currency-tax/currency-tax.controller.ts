import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrencyTaxService } from "./currency-tax.service";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("currency-tax")
export class CurrencyTaxController {
  constructor(private readonly currencyTax: CurrencyTaxService) {}

  @Get()
  getConfig() {
    return this.currencyTax.getConfig();
  }

  @Post()
  updateConfig(
    @Body()
    body: {
      baseCurrency?: string;
      reportingCurrency?: string;
      fxProvider?: string;
      fxRates?: { base: string; quote: string; rate: number; asOf?: string }[];
      taxProfiles?: {
        id: string;
        name: string;
        region: string;
        type: "vat" | "gst" | "sales";
        rate: number;
        inclusive: boolean;
        notes?: string;
      }[];
      parkCurrencies?: { parkId: string; currency: string; taxProfileId: string }[];
    },
  ) {
    const normalized = {
      ...body,
      fxRates: body.fxRates?.map((r) => ({
        ...r,
        asOf: r.asOf ?? new Date().toISOString(),
      })),
    };
    return this.currencyTax.updateConfig(normalized);
  }

  @Post("convert")
  convert(@Body() body: { amount: number; from: string; to: string }) {
    return this.currencyTax.convert(body.amount, body.from, body.to);
  }

  @Get("summary")
  summary() {
    return this.currencyTax.summary();
  }

  @Get("status")
  getRefreshStatus() {
    return this.currencyTax.getRefreshStatus();
  }

  @Post("refresh")
  async triggerRefresh() {
    await this.currencyTax.refreshRates();
    return this.currencyTax.getRefreshStatus();
  }
}
