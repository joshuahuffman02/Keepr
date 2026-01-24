import { BadGatewayException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

type FxRate = {
  base: string;
  quote: string;
  rate: number;
  asOf: string;
};

type TaxProfile = {
  id: string;
  name: string;
  region: string;
  type: "vat" | "gst" | "sales";
  rate: number;
  inclusive: boolean;
  notes?: string;
};

type CurrencyTaxConfig = {
  baseCurrency: string;
  reportingCurrency: string;
  fxProvider: string;
  fxRates: FxRate[];
  taxProfiles: TaxProfile[];
  parkCurrencies: { parkId: string; currency: string; taxProfileId: string }[];
  updatedAt: string;
};

type ConversionResult = {
  amount: number;
  from: string;
  to: string;
  rate: number;
  converted: number;
  asOf: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class CurrencyTaxService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyTaxService.name);
  private lastRefreshError: string | null = null;

  private config: CurrencyTaxConfig = {
    baseCurrency: "USD",
    reportingCurrency: "USD",
    // TODO: Integrate real FX provider (OpenExchangeRates, XE.com, or ECB)
    // Set FX_PROVIDER environment variable and implement provider-specific fetching
    // For now, using manual rates for testing - update via API or implement scheduled refresh
    fxProvider: process.env.FX_PROVIDER || "manual",
    fxRates: [
      { base: "USD", quote: "CAD", rate: 1.34, asOf: new Date().toISOString() },
      { base: "USD", quote: "EUR", rate: 0.92, asOf: new Date().toISOString() },
      { base: "CAD", quote: "EUR", rate: 0.69, asOf: new Date().toISOString() },
    ],
    taxProfiles: [
      {
        id: "us-default",
        name: "US sales/lodging",
        region: "US",
        type: "sales",
        rate: 0.085,
        inclusive: false,
      },
      {
        id: "ca-gst-pst",
        name: "GST/PST (BC)",
        region: "CA-BC",
        type: "gst",
        rate: 0.12,
        inclusive: false,
        notes: "GST 5% + PST 7%",
      },
      { id: "eu-vat", name: "EU VAT (DE)", region: "DE", type: "vat", rate: 0.19, inclusive: true },
    ],
    parkCurrencies: [
      { parkId: "cg-redwood", currency: "USD", taxProfileId: "us-default" },
      { parkId: "cg-lakeview", currency: "CAD", taxProfileId: "ca-gst-pst" },
      { parkId: "cg-alpine", currency: "EUR", taxProfileId: "eu-vat" },
    ],
    updatedAt: new Date().toISOString(),
  };

  getConfig(): CurrencyTaxConfig {
    return this.config;
  }

  updateConfig(payload: Partial<CurrencyTaxConfig>): CurrencyTaxConfig {
    this.config = {
      ...this.config,
      ...payload,
      fxRates: payload.fxRates ?? this.config.fxRates,
      taxProfiles: payload.taxProfiles ?? this.config.taxProfiles,
      parkCurrencies: payload.parkCurrencies ?? this.config.parkCurrencies,
      updatedAt: new Date().toISOString(),
    };
    return this.config;
  }

  /**
   * Initialize FX rates on module startup
   */
  async onModuleInit(): Promise<void> {
    const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY;
    if (apiKey) {
      this.logger.log("OpenExchangeRates API key found, fetching initial rates...");
      await this.refreshRates();
    } else {
      this.logger.warn(
        "No OPEN_EXCHANGE_RATES_API_KEY set - using manual FX rates. Set this env var for live rates.",
      );
    }
  }

  /**
   * Fetch latest FX rates from OpenExchangeRates API
   * Runs hourly via cron job when API key is configured.
   *
   * Free tier: 1000 requests/month (hourly = ~720/month, well under limit)
   * Docs: https://docs.openexchangerates.org/reference/latest-json
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshRates(): Promise<void> {
    const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY;

    if (!apiKey) {
      // Graceful degradation - use manual rates if no API key
      return;
    }

    const baseCurrency = this.config.baseCurrency;
    const currencies = ["USD", "CAD", "EUR", "GBP", "AUD", "MXN", "NZD", "JPY", "CHF"];
    const symbols = currencies.join(",");

    try {
      const url = `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=${baseCurrency}&symbols=${symbols}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new BadGatewayException(
          `OpenExchangeRates API error: ${response.status} ${errorText}`,
        );
      }

      const data = await response.json();
      if (!isRecord(data) || !isRecord(data.rates)) {
        throw new BadGatewayException("Invalid response from OpenExchangeRates - no rates object");
      }

      // Convert API response to our FxRate format
      const asOf =
        typeof data.timestamp === "number"
          ? new Date(data.timestamp * 1000).toISOString()
          : new Date().toISOString();

      const newRates: FxRate[] = [];

      // Create rates for each currency pair
      for (const [quote, rate] of Object.entries(data.rates)) {
        if (quote !== baseCurrency && typeof rate === "number") {
          newRates.push({
            base: baseCurrency,
            quote,
            rate,
            asOf,
          });
        }
      }

      // Also add cross-rates for major pairs (CAD/EUR, etc.)
      const cad = typeof data.rates.CAD === "number" ? data.rates.CAD : null;
      const eur = typeof data.rates.EUR === "number" ? data.rates.EUR : null;
      const gbp = typeof data.rates.GBP === "number" ? data.rates.GBP : null;

      if (cad && eur) {
        newRates.push({ base: "CAD", quote: "EUR", rate: eur / cad, asOf });
        newRates.push({ base: "EUR", quote: "CAD", rate: cad / eur, asOf });
      }
      if (cad && gbp) {
        newRates.push({ base: "CAD", quote: "GBP", rate: gbp / cad, asOf });
      }

      // Update config with new rates
      this.config.fxRates = newRates;
      this.config.updatedAt = new Date().toISOString();
      this.lastRefreshError = null;

      this.logger.log(
        `FX rates refreshed: ${newRates.length} rates updated from OpenExchangeRates`,
      );
    } catch (error) {
      this.lastRefreshError = getErrorMessage(error) || "Unknown error";
      this.logger.error(`Failed to refresh FX rates: ${this.lastRefreshError}`);
      // Don't throw - keep using stale rates rather than breaking the service
    }
  }

  /**
   * Get FX refresh status for health checks
   */
  getRefreshStatus(): {
    lastUpdated: string;
    error: string | null;
    provider: string;
    rateCount: number;
  } {
    return {
      lastUpdated: this.config.updatedAt,
      error: this.lastRefreshError,
      provider: process.env.OPEN_EXCHANGE_RATES_API_KEY ? "openexchangerates" : "manual",
      rateCount: this.config.fxRates.length,
    };
  }

  convert(amount: number, from: string, to: string): ConversionResult {
    if (from === to) {
      return { amount, from, to, rate: 1, converted: amount, asOf: new Date().toISOString() };
    }
    const direct = this.config.fxRates.find((r) => r.base === from && r.quote === to);
    if (direct) {
      return {
        amount,
        from,
        to,
        rate: direct.rate,
        converted: Number((amount * direct.rate).toFixed(2)),
        asOf: direct.asOf,
      };
    }
    const inverse = this.config.fxRates.find((r) => r.base === to && r.quote === from);
    if (inverse) {
      const rate = 1 / inverse.rate;
      return {
        amount,
        from,
        to,
        rate: Number(rate.toFixed(6)),
        converted: Number((amount * rate).toFixed(2)),
        asOf: inverse.asOf,
      };
    }
    const base = this.config.baseCurrency;
    const toBase: ConversionResult = this.convert(amount, from, base);
    const final: ConversionResult = this.convert(toBase.converted, base, to);
    return {
      amount,
      from,
      to,
      rate: Number((toBase.rate * final.rate).toFixed(6)),
      converted: final.converted,
      asOf: new Date().toISOString(),
    };
  }

  summary(): {
    exposureByCurrency: Record<string, number>;
    fxRates: FxRate[];
    taxProfiles: TaxProfile[];
    reportingCurrency: string;
    updatedAt: string;
  } {
    const exposureByCurrency = this.config.parkCurrencies.reduce<Record<string, number>>(
      (acc, row) => {
        acc[row.currency] = (acc[row.currency] ?? 0) + 1;
        return acc;
      },
      {},
    );
    return {
      exposureByCurrency,
      fxRates: this.config.fxRates,
      taxProfiles: this.config.taxProfiles,
      reportingCurrency: this.config.reportingCurrency,
      updatedAt: this.config.updatedAt,
    };
  }
}
