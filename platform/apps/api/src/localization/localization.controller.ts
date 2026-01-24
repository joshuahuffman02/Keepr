import { Body, Controller, Get, Headers, Post, Query, UseGuards } from "@nestjs/common";
import { LocalizationService } from "./localization.service";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("localization")
export class LocalizationController {
  constructor(private readonly localization: LocalizationService) {}

  @Get("locales")
  locales() {
    return this.localization.listLocales();
  }

  @Get("settings")
  settings(
    @Headers("x-user-id") userHeader?: string,
    @Headers("x-organization-id") orgHeader?: string,
  ) {
    const userKey = userHeader || "demo-user";
    return this.localization.getSettings(userKey, orgHeader);
  }

  @Post("settings")
  update(
    @Body()
    body: {
      locale?: string;
      currency?: string;
      timezone?: string;
      orgLocale?: string;
      orgCurrency?: string;
    },
    @Headers("x-user-id") userHeader?: string,
    @Headers("x-organization-id") orgHeader?: string,
  ) {
    const userKey = userHeader || "demo-user";
    return this.localization.updateSettings(userKey, orgHeader, body);
  }

  @Get("preview")
  preview(
    @Query("locale") locale = "en-US",
    @Query("currency") currency = "USD",
    @Query("timezone") timezone = "America/Denver",
  ) {
    return this.localization.preview(locale, currency, timezone);
  }
}
