"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReportsV2Shell } from "@/components/reports-v2/ReportsV2Shell";
import { ReportsV2PageHeader } from "@/components/reports-v2/ReportsV2PageHeader";
import { ReportSection, ReportStatGrid } from "@/components/reports-v2/ReportPanels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { listSavedReports, type SavedReport } from "@/components/reports/savedReports";

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

export default function ReportsV2PortfolioPage() {
  const qc = useQueryClient();
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [locale, setLocale] = useState("en-US");
  const [reportingCurrency, setReportingCurrency] = useState<string | null>(null);
  const [fxEnabled, setFxEnabled] = useState(true);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPortfolio = localStorage.getItem("campreserv:selectedPortfolio");
    const storedLocale = localStorage.getItem("campreserv:locale");
    const storedReporting = localStorage.getItem("campreserv:reportingCurrency");
    setSavedReports(listSavedReports(localStorage.getItem("campreserv:selectedCampground")));
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

  const isLoading = portfoliosQuery.isLoading || reportQuery.isLoading;

  return (
    <DashboardShell>
      <div className="space-y-5">
        <Breadcrumbs
          items={[{ label: "Reports v2", href: "/reports-v2" }, { label: "Portfolio" }]}
        />
        <ReportsV2Shell
          activeTab={null}
          activeSubTab={null}
          activeShortcut="portfolio"
          pinnedReports={savedReports.filter((r) => r.pinned)}
        >
          <ReportsV2PageHeader
            title="Portfolio reporting"
            description="Cross-park occupancy, ADR, RevPAR, and revenue with FX support."
          />

          <ReportSection
            title="Scope and currency"
            description="Choose a portfolio and reporting currency."
          >
            <div className="flex flex-wrap items-center gap-4">
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
                  <SelectTrigger className="w-64" aria-label="Portfolio">
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
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">FX conversion</span>
                <Switch checked={fxEnabled} onCheckedChange={setFxEnabled} />
              </div>
            </div>
          </ReportSection>

          <ReportStatGrid
            stats={[
              {
                label: "Portfolio revenue",
                value: rollup ? formatCurrency(rollup.revenueHome, rollup.currency, locale) : "—",
              },
              { label: "Occupancy", value: rollup ? formatPercent(rollup.occupancy) : "—" },
              {
                label: "ADR",
                value: rollup ? formatCurrency(rollup.adr, rollup.currency, locale) : "—",
              },
              {
                label: "RevPAR",
                value: rollup ? formatCurrency(rollup.revpar, rollup.currency, locale) : "—",
              },
            ]}
          />

          <ReportSection
            title="Per-park metrics"
            description={`As of ${reportQuery.data?.asOf ? new Date(reportQuery.data.asOf).toLocaleString() : "—"}.`}
          >
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
                        Loading metrics...
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
                                {m.currency} to {resolvedReportingCurrency} @ {m.fxRate}
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
          </ReportSection>
        </ReportsV2Shell>
      </div>
    </DashboardShell>
  );
}
