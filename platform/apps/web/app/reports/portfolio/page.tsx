"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { ReportsNavBar } from "@/components/reports/ReportsNavBar";

type FxRate = { base: string; quote: string; rate: number };

function formatCurrency(value: number | null | undefined, currency: string, locale: string) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function resolveRate(
  fxRates: FxRate[],
  baseCurrency: string | undefined,
  from: string,
  to: string,
): number {
  if (from === to) return 1;
  const direct = fxRates.find((r) => r.base === from && r.quote === to);
  if (direct) return direct.rate;
  const inverse = fxRates.find((r) => r.base === to && r.quote === from);
  if (inverse) return Number((1 / inverse.rate).toFixed(6));

  if (baseCurrency && from !== baseCurrency && to !== baseCurrency) {
    const toBase = resolveRate(fxRates, baseCurrency, from, baseCurrency);
    const fromBase = resolveRate(fxRates, baseCurrency, baseCurrency, to);
    return Number((toBase * fromBase).toFixed(6)) || 1;
  }

  return 1;
}

export default function PortfolioFxReportPage() {
  const pathname = usePathname();
  const qc = useQueryClient();
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [locale, setLocale] = useState("en-US");
  const [reportingCurrency, setReportingCurrency] = useState<string | null>(null);
  const [fxEnabled, setFxEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPortfolio = localStorage.getItem("campreserv:selectedPortfolio");
    const storedLocale = localStorage.getItem("campreserv:locale");
    const storedReporting = localStorage.getItem("campreserv:reportingCurrency");
    if (storedPortfolio) setPortfolioId(storedPortfolio);
    if (storedLocale) setLocale(storedLocale);
    if (storedReporting) setReportingCurrency(storedReporting);
  }, []);

  const portfoliosQuery = useQuery({
    queryKey: ["portfolios"],
    queryFn: apiClient.getPortfolios,
  });

  useEffect(() => {
    const data = portfoliosQuery.data;
    if (!data) return;
    if (!portfolioId && data.activePortfolioId) setPortfolioId(data.activePortfolioId);
  }, [portfolioId, portfoliosQuery.data]);

  const reportQuery = useQuery({
    queryKey: ["portfolio-report", portfolioId],
    queryFn: () => apiClient.getPortfolioReport(portfolioId!),
    enabled: !!portfolioId,
  });

  const currencyTaxQuery = useQuery({
    queryKey: ["currency-tax"],
    queryFn: apiClient.getCurrencyTaxConfig,
  });

  const localesQuery = useQuery({
    queryKey: ["locales"],
    queryFn: apiClient.listLocales,
  });

  useEffect(() => {
    if (
      localesQuery.data &&
      !localesQuery.isFetching &&
      !localesQuery.isRefetching &&
      !localStorage.getItem("campreserv:locale")
    ) {
      setLocale(localesQuery.data[0]?.code ?? "en-US");
    }
  }, [localesQuery.data, localesQuery.isFetching, localesQuery.isRefetching]);

  useEffect(() => {
    const preferred = currencyTaxQuery.data?.reportingCurrency ?? reportQuery.data?.homeCurrency;
    if (!reportingCurrency && preferred) {
      setReportingCurrency(preferred);
      if (typeof window !== "undefined") {
        localStorage.setItem("campreserv:reportingCurrency", preferred);
      }
    }
  }, [reportingCurrency, currencyTaxQuery.data?.reportingCurrency, reportQuery.data?.homeCurrency]);

  const metrics = reportQuery.data?.metrics ?? [];
  const fxRates = currencyTaxQuery.data?.fxRates ?? [];
  const baseCurrency = currencyTaxQuery.data?.baseCurrency ?? reportQuery.data?.homeCurrency;
  const resolvedReportingCurrency = reportingCurrency ?? reportQuery.data?.homeCurrency ?? "USD";

  const currencyOptions = (() => {
    const codes = new Set<string>();
    metrics.forEach((m) => codes.add(m.currency));
    fxRates.forEach((r) => {
      codes.add(r.base);
      codes.add(r.quote);
    });
    (localesQuery.data ?? []).forEach((opt) => codes.add(opt.currency));
    if (reportQuery.data?.homeCurrency) codes.add(reportQuery.data.homeCurrency);
    return Array.from(codes).sort();
  })();

  const rows = metrics.map((m) => {
    const rate = fxEnabled
      ? resolveRate(fxRates, baseCurrency, m.currency, resolvedReportingCurrency)
      : 1;
    return {
      ...m,
      displayCurrency: fxEnabled ? resolvedReportingCurrency : m.currency,
      displayAdr: Number((m.adr * rate).toFixed(2)),
      displayRevpar: Number((m.revpar * rate).toFixed(2)),
      displayRevenue: Math.round((m.revenue ?? 0) * rate),
      fxRate: rate,
    };
  });

  const rollup = (() => {
    const base = reportQuery.data?.rollup;
    if (!base) return null;
    if (!fxEnabled || base.currency === resolvedReportingCurrency) return base;
    const rate = resolveRate(fxRates, baseCurrency, base.currency, resolvedReportingCurrency);
    return {
      currency: resolvedReportingCurrency,
      revenueHome: Math.round(base.revenueHome * rate),
      occupancy: base.occupancy,
      adr: Number((base.adr * rate).toFixed(2)),
      revpar: Number((base.revpar * rate).toFixed(2)),
    };
  })();

  const activePortfolio = useMemo(() => {
    if (!portfoliosQuery.data || !portfolioId) return null;
    return (
      portfoliosQuery.data.portfolios.find((p) => p.id === portfolioId) ??
      portfoliosQuery.data.portfolios[0]
    );
  }, [portfolioId, portfoliosQuery.data]);

  const isLoading = portfoliosQuery.isLoading || reportQuery.isLoading;

  const reportNavLinks = [
    { label: "Saved", href: "/reports/saved", active: pathname === "/reports/saved" },
    {
      label: "Portfolio",
      href: "/reports/portfolio",
      active: pathname.startsWith("/reports/portfolio"),
    },
    { label: "Devices", href: "/reports/devices", active: pathname.startsWith("/reports/devices") },
  ];

  return (
    <DashboardShell>
      <Breadcrumbs
        items={[
          { label: "Reports", href: "/reports" },
          { label: "Portfolio FX", href: "/reports/portfolio" },
        ]}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Cross-park reporting</h1>
          <p className="text-sm text-muted-foreground">
            Occupancy, ADR, and RevPAR per portfolio with currency conversion helpers.
          </p>
        </div>

        <ReportsNavBar activeTab={null} extraLinks={reportNavLinks} />

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Scope & FX</CardTitle>
              <CardDescription>Choose a portfolio and reporting currency.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Portfolio</span>
                <Select
                  value={portfolioId ?? ""}
                  onValueChange={(value) => {
                    setPortfolioId(value);
                    if (typeof window !== "undefined")
                      localStorage.setItem("campreserv:selectedPortfolio", value);
                    qc.invalidateQueries({ queryKey: ["portfolio-report"] });
                  }}
                >
                  <SelectTrigger className="w-60 text-sm" aria-label="Portfolio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(portfoliosQuery.data?.portfolios ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Reporting currency
                </span>
                <Select
                  value={resolvedReportingCurrency}
                  onValueChange={(val) => {
                    setReportingCurrency(val);
                    if (typeof window !== "undefined")
                      localStorage.setItem("campreserv:reportingCurrency", val);
                  }}
                >
                  <SelectTrigger className="w-48" aria-label="Reporting currency">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <Switch
                  checked={fxEnabled}
                  onCheckedChange={setFxEnabled}
                  aria-label="Toggle FX conversion"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">FX toggle</span>
                  <span className="text-[11px] text-muted-foreground">
                    Convert to {resolvedReportingCurrency}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => qc.invalidateQueries({ queryKey: ["portfolio-report"] })}
                disabled={!portfolioId}
              >
                Refresh report
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Rollup</CardTitle>
              <CardDescription>
                Home: {reportQuery.data?.homeCurrency ?? "—"} · Reporting:{" "}
                {resolvedReportingCurrency}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Revenue</div>
                <div className="text-xl font-semibold">
                  {formatCurrency(
                    rollup?.revenueHome ?? null,
                    rollup?.currency ?? resolvedReportingCurrency,
                    locale,
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Occupancy</div>
                <div className="text-xl font-semibold">
                  {formatPercent(rollup?.occupancy ?? null)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">ADR</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(
                    rollup?.adr ?? null,
                    rollup?.currency ?? resolvedReportingCurrency,
                    locale,
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">RevPAR</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(
                    rollup?.revpar ?? null,
                    rollup?.currency ?? resolvedReportingCurrency,
                    locale,
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FX context</CardTitle>
              <CardDescription>
                {currencyTaxQuery.data?.fxProvider?.toUpperCase?.() ?? "Default"} · Updated{" "}
                {currencyTaxQuery.data?.updatedAt
                  ? new Date(currencyTaxQuery.data.updatedAt).toLocaleString()
                  : "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-foreground">
                Base: {currencyTaxQuery.data?.baseCurrency ?? "USD"} · Reporting:{" "}
                {resolvedReportingCurrency}
              </div>
              <div className="space-y-1">
                {(currencyTaxQuery.data?.fxRates ?? []).map((r) => (
                  <div
                    key={`${r.base}-${r.quote}`}
                    className="flex items-center justify-between rounded border border-border px-3 py-2"
                  >
                    <span className="text-sm font-semibold">
                      {r.base} → {r.quote}
                    </span>
                    <span className="text-sm text-foreground">{r.rate}</span>
                  </div>
                ))}
                {!currencyTaxQuery.data?.fxRates?.length && (
                  <div className="text-sm text-muted-foreground">No exchange rates configured.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Routing</CardTitle>
              <CardDescription>Per-park admin/guest endpoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(reportQuery.data?.routing ?? []).map((route) => (
                <div key={route.parkId} className="rounded-lg border border-border px-3 py-2">
                  <div className="text-sm font-semibold">{route.parkId}</div>
                  <div className="text-xs text-muted-foreground">
                    Admin: {route.adminHost || "Not configured"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Guest: {route.guestHost || "Not configured"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Path: {route.path || "/campgrounds/:id"}
                  </div>
                </div>
              ))}
              {!reportQuery.data?.routing?.length && (
                <div className="text-sm text-muted-foreground">No routing configuration found.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-1">
            <CardTitle>Per-park metrics</CardTitle>
            <CardDescription>
              Occupancy and ADR stay local; amounts convert when FX toggle is on. As of{" "}
              {reportQuery.data?.asOf ? new Date(reportQuery.data.asOf).toLocaleString() : "—"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Park</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Occupancy</TableHead>
                    <TableHead>ADR</TableHead>
                    <TableHead>RevPAR</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>FX</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-sm text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading &&
                    rows.map((m) => (
                      <TableRow key={m.parkId}>
                        <TableCell className="font-semibold">{m.name}</TableCell>
                        <TableCell>{m.region}</TableCell>
                        <TableCell>{formatPercent(m.occupancy)}</TableCell>
                        <TableCell>
                          {formatCurrency(m.displayAdr, m.displayCurrency, locale)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(m.displayRevpar, m.displayCurrency, locale)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(m.displayRevenue, m.displayCurrency, locale)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{m.displayCurrency}</Badge>
                            {fxEnabled && m.currency !== resolvedReportingCurrency && (
                              <span className="text-xs text-muted-foreground">
                                {m.currency} → {resolvedReportingCurrency} @ {m.fxRate}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-sm text-muted-foreground">
                        No metrics available for this portfolio.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="secondary">Beta</Badge>
          <span>
            Cross-park FX uses the existing portfolio and localization endpoints. Toggle currencies
            to preview conversions per park.
          </span>
        </div>
      </div>
    </DashboardShell>
  );
}
