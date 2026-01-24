import { Injectable } from "@nestjs/common";
import { translations, t, getSupportedLocales } from "./translations";

type LocaleOption = {
  code: string;
  label: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  region: string;
  rtl: boolean;
};

type LocalizationSettings = {
  locale: string;
  currency: string;
  timezone: string;
  updatedAt: string;
  orgLocale?: string;
  orgCurrency?: string;
};

const isTranslationLocale = (value: string): value is keyof typeof translations =>
  Object.prototype.hasOwnProperty.call(translations, value);

@Injectable()
export class LocalizationService {
  private readonly locales: LocaleOption[] = [
    {
      code: "en-US",
      label: "English (United States)",
      currency: "USD",
      timezone: "America/Denver",
      dateFormat: "MM/dd/yyyy",
      numberFormat: "1,234.56",
      region: "North America",
      rtl: false,
    },
    {
      code: "en-CA",
      label: "English (Canada)",
      currency: "CAD",
      timezone: "America/Toronto",
      dateFormat: "yyyy-MM-dd",
      numberFormat: "1,234.56",
      region: "North America",
      rtl: false,
    },
    {
      code: "en-GB",
      label: "English (United Kingdom)",
      currency: "GBP",
      timezone: "Europe/London",
      dateFormat: "dd/MM/yyyy",
      numberFormat: "1,234.56",
      region: "Europe",
      rtl: false,
    },
    {
      code: "en-AU",
      label: "English (Australia)",
      currency: "AUD",
      timezone: "Australia/Sydney",
      dateFormat: "dd/MM/yyyy",
      numberFormat: "1,234.56",
      region: "Oceania",
      rtl: false,
    },
    {
      code: "es-ES",
      label: "Español (España)",
      currency: "EUR",
      timezone: "Europe/Madrid",
      dateFormat: "dd/MM/yyyy",
      numberFormat: "1.234,56",
      region: "Europe",
      rtl: false,
    },
    {
      code: "es-MX",
      label: "Español (México)",
      currency: "MXN",
      timezone: "America/Mexico_City",
      dateFormat: "dd/MM/yyyy",
      numberFormat: "1,234.56",
      region: "North America",
      rtl: false,
    },
    {
      code: "fr-CA",
      label: "Français (Canada)",
      currency: "CAD",
      timezone: "America/Montreal",
      dateFormat: "yyyy-MM-dd",
      numberFormat: "1 234,56",
      region: "North America",
      rtl: false,
    },
    {
      code: "fr-FR",
      label: "Français (France)",
      currency: "EUR",
      timezone: "Europe/Paris",
      dateFormat: "dd/MM/yyyy",
      numberFormat: "1 234,56",
      region: "Europe",
      rtl: false,
    },
    {
      code: "de-DE",
      label: "Deutsch (Deutschland)",
      currency: "EUR",
      timezone: "Europe/Berlin",
      dateFormat: "dd.MM.yyyy",
      numberFormat: "1.234,56",
      region: "Europe",
      rtl: false,
    },
    {
      code: "de-AT",
      label: "Deutsch (Österreich)",
      currency: "EUR",
      timezone: "Europe/Vienna",
      dateFormat: "dd.MM.yyyy",
      numberFormat: "1.234,56",
      region: "Europe",
      rtl: false,
    },
    {
      code: "it-IT",
      label: "Italiano (Italia)",
      currency: "EUR",
      timezone: "Europe/Rome",
      dateFormat: "dd/MM/yyyy",
      numberFormat: "1.234,56",
      region: "Europe",
      rtl: false,
    },
    {
      code: "pt-BR",
      label: "Português (Brasil)",
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      dateFormat: "dd/MM/yyyy",
      numberFormat: "1.234,56",
      region: "South America",
      rtl: false,
    },
    {
      code: "nl-NL",
      label: "Nederlands (Nederland)",
      currency: "EUR",
      timezone: "Europe/Amsterdam",
      dateFormat: "dd-MM-yyyy",
      numberFormat: "1.234,56",
      region: "Europe",
      rtl: false,
    },
    {
      code: "ja-JP",
      label: "日本語 (日本)",
      currency: "JPY",
      timezone: "Asia/Tokyo",
      dateFormat: "yyyy/MM/dd",
      numberFormat: "1,234",
      region: "Asia",
      rtl: false,
    },
  ];

  private readonly userSettings = new Map<string, LocalizationSettings>();

  listLocales() {
    return this.locales;
  }

  getSettings(userKey: string, orgKey?: string) {
    const key = this.makeKey(userKey, orgKey);
    const existing = this.userSettings.get(key);
    if (existing) return existing;
    const fallback = {
      locale: "en-US",
      currency: "USD",
      timezone: "America/Denver",
      updatedAt: new Date().toISOString(),
      orgLocale: orgKey ? "en-US" : undefined,
      orgCurrency: orgKey ? "USD" : undefined,
    };
    this.userSettings.set(key, fallback);
    return fallback;
  }

  updateSettings(
    userKey: string,
    orgKey: string | undefined,
    payload: Partial<LocalizationSettings>,
  ) {
    const key = this.makeKey(userKey, orgKey);
    const current = this.getSettings(userKey, orgKey);
    const next: LocalizationSettings = {
      ...current,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    this.userSettings.set(key, next);
    return next;
  }

  preview(locale: string, currency: string, timezone: string) {
    const sampleDate = new Date("2025-01-15T15:30:00Z");
    const formattedDate = new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone,
    }).format(sampleDate);

    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(98765.4321);

    const formattedCurrency = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(1234.56);

    return {
      sampleDate: sampleDate.toISOString(),
      formattedDate,
      formattedNumber,
      formattedCurrency,
      translatedPhrases: this.translationsFor(locale),
    };
  }

  private makeKey(userKey: string, orgKey?: string) {
    return `${orgKey ?? "org-default"}:${userKey}`;
  }

  private translationsFor(locale: string) {
    // Return a subset of translations for preview
    const keys = [
      "nav.dashboard",
      "dashboard.revenue",
      "dashboard.occupancy",
      "common.save",
      "common.cancel",
      "reservations.title",
      "guests.title",
      "checkin.title",
    ];

    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = t(locale, key);
    }
    return result;
  }

  /**
   * Translate a single key
   */
  translate(locale: string, key: string): string {
    return t(locale, key);
  }

  /**
   * Translate multiple keys at once
   */
  translateBatch(locale: string, keys: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = t(locale, key);
    }
    return result;
  }

  /**
   * Get all translations for a locale (for frontend hydration)
   */
  getAllTranslations(locale: string): Record<string, string> {
    const localeData = isTranslationLocale(locale) ? translations[locale] : translations["en-US"];
    return localeData;
  }

  /**
   * Get supported locales list
   */
  getSupportedLocales(): string[] {
    return getSupportedLocales();
  }

  /**
   * Get locales by region
   */
  getLocalesByRegion(): Record<string, LocaleOption[]> {
    const byRegion: Record<string, LocaleOption[]> = {};
    for (const locale of this.locales) {
      if (!byRegion[locale.region]) {
        byRegion[locale.region] = [];
      }
      byRegion[locale.region].push(locale);
    }
    return byRegion;
  }
}
