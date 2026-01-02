"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";

export default function LocalizationSettingsPage() {
  const { toast } = useToast();
  const localesQuery = useQuery({ queryKey: ["locales"], queryFn: apiClient.listLocales });
  const settingsQuery = useQuery({ queryKey: ["localization-settings"], queryFn: apiClient.getLocalizationSettings });

  const [locale, setLocale] = useState("en-US");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("America/Denver");

  useEffect(() => {
    if (settingsQuery.data) {
      setLocale(settingsQuery.data.locale ?? "en-US");
      setCurrency(settingsQuery.data.currency ?? "USD");
      setTimezone(settingsQuery.data.timezone ?? "America/Denver");
    }
  }, [settingsQuery.data]);

  const previewQuery = useQuery({
    queryKey: ["localization-preview", locale, currency, timezone],
    queryFn: () => apiClient.getLocalizationPreview({ locale, currency, timezone }),
    enabled: !!locale && !!currency && !!timezone,
  });

  const updateMutation = useMutation({
    mutationFn: apiClient.updateLocalizationSettings,
    onSuccess: (data) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("campreserv:locale", data.locale);
        localStorage.setItem("campreserv:currency", data.currency);
      }
      toast({ title: "Localization updated" });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err?.message ?? "Try again", variant: "destructive" }),
  });

  const selectedLocaleMeta = useMemo(() => localesQuery.data?.find((l) => l.code === locale), [localesQuery.data, locale]);
  const currencies = useMemo(() => Array.from(new Set((localesQuery.data ?? []).map((l) => l.currency))), [localesQuery.data]);
  const timezones = useMemo(() => Array.from(new Set((localesQuery.data ?? []).map((l) => l.timezone))), [localesQuery.data]);

  const handleSave = () => {
    updateMutation.mutate({ locale, currency, timezone });
  };

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Localization", href: "/settings/localization" },
        ]}
      />

      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-foreground">Localization & language</h1>
        <p className="text-sm text-muted-foreground">Choose language, locale-aware formatting, and currency defaults.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Language & locale</CardTitle>
            <CardDescription>Applies to the current user and flows to API headers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Language</div>
              <select
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
              >
                {(localesQuery.data ?? []).map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="text-xs text-muted-foreground mt-1">Includes date/number formats.</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Currency</div>
              <select
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Time zone</div>
              <select
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              Save
            </Button>
            <div className="text-xs text-muted-foreground">
              Headers `x-locale` and `x-currency` are sent with each request when set.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Shows formatting with the selected language and currency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground">
            <div>Sample number: {previewQuery.data?.formattedNumber ?? "—"}</div>
            <div>Sample currency: {previewQuery.data?.formattedCurrency ?? "—"}</div>
            <div>Date/time: {previewQuery.data?.formattedDate ?? "—"}</div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      <Card>
        <CardHeader>
          <CardTitle>Import/Export</CardTitle>
          <CardDescription>Upload translations or download current bundle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Contact support to enable translation bundle management for your property.</div>
        </CardContent>
      </Card>
    </div>
  );
}
