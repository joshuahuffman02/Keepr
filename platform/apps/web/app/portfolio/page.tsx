"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

function formatCurrency(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

export default function PortfolioPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [parkId, setParkId] = useState<string | null>(null);
  const [locale, setLocale] = useState("en-US");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPortfolio = localStorage.getItem("campreserv:selectedPortfolio");
    const storedPark = localStorage.getItem("campreserv:selectedPark");
    const storedLocale = localStorage.getItem("campreserv:locale");
    if (storedPortfolio) setPortfolioId(storedPortfolio);
    if (storedPark) setParkId(storedPark);
    if (storedLocale) setLocale(storedLocale);
  }, []);

  const portfoliosQuery = useQuery({
    queryKey: ["portfolios"],
    queryFn: apiClient.getPortfolios,
  });

  useEffect(() => {
    const data = portfoliosQuery.data;
    if (!data) return;
    if (!portfolioId && data.activePortfolioId) setPortfolioId(data.activePortfolioId);
    if (!parkId && data.activeParkId) setParkId(data.activeParkId);
  }, [portfolioId, parkId, portfoliosQuery.data]);

  const reportQuery = useQuery({
    queryKey: ["portfolio-report", portfolioId],
    queryFn: () => apiClient.getPortfolioReport(portfolioId!),
    enabled: !!portfolioId,
  });

  const selectMutation = useMutation({
    mutationFn: apiClient.selectPortfolio,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["portfolio-report"] });
      if (typeof window !== "undefined") {
        if (data?.activePortfolioId) localStorage.setItem("campreserv:selectedPortfolio", data.activePortfolioId);
        if (data?.activeParkId) {
          localStorage.setItem("campreserv:selectedPark", data.activeParkId);
          localStorage.setItem("campreserv:selectedCampground", data.activeParkId);
        }
      }
      toast({ title: "Portfolio context updated" });
    },
    onError: (err: any) => toast({ title: "Unable to select portfolio", description: err?.message ?? "Try again", variant: "destructive" }),
  });

  const activePortfolio = useMemo(() => {
    if (!portfoliosQuery.data || !portfolioId) return null;
    return portfoliosQuery.data.portfolios.find((p) => p.id === portfolioId) ?? portfoliosQuery.data.portfolios[0];
  }, [portfolioId, portfoliosQuery.data]);

  const routing = useMemo(() => reportQuery.data?.routing ?? [], [reportQuery.data]);

  const onPortfolioChange = (id: string) => {
    setPortfolioId(id);
    selectMutation.mutate({ portfolioId: id });
  };

  const onParkChange = (id: string) => {
    setParkId(id);
    if (portfolioId) selectMutation.mutate({ portfolioId, parkId: id });
    if (typeof window !== "undefined") {
      localStorage.setItem("campreserv:selectedPark", id);
      localStorage.setItem("campreserv:selectedCampground", id);
    }
  };

  const rollup = reportQuery.data?.rollup;
  const metrics = reportQuery.data?.metrics ?? [];

  if (portfoliosQuery.isLoading) {
    return (
      <DashboardShell>
        <div className="rounded border border-border bg-muted p-4" role="status" aria-live="polite">
          Loading portfolio context…
        </div>
      </DashboardShell>
    );
  }

  if (portfoliosQuery.isError) {
    return (
      <DashboardShell>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert" aria-live="assertive">
          Unable to load portfolios. Please retry.
        </div>
        <div className="mt-3">
          <Button size="sm" onClick={() => portfoliosQuery.refetch()}>
            Retry
          </Button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Portfolio", href: "/portfolio" },
        ]}
      />

      <div className="mb-2" data-testid="portfolio-header">
        <h1 className="text-2xl font-semibold text-foreground">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Multi-property view, routing, and cross-park reporting.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="portfolio-switcher-card">
          <CardHeader>
            <CardTitle>Portfolio switcher</CardTitle>
            <CardDescription>Select a portfolio and park to scope the admin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-sm font-semibold text-muted-foreground">Portfolio</label>
            <select
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              value={portfolioId ?? ""}
              onChange={(e) => onPortfolioChange(e.target.value)}
              data-testid="portfolio-select"
              aria-busy={portfoliosQuery.isRefetching}
            >
              {(portfoliosQuery.data?.portfolios ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="text-sm font-semibold text-muted-foreground">Park (routes ops)</label>
            <select
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              value={parkId ?? ""}
              onChange={(e) => onParkChange(e.target.value)}
              disabled={!activePortfolio}
              data-testid="portfolio-park-select"
            >
              {(activePortfolio?.parks ?? []).map((park) => (
                <option key={park.id} value={park.id}>
                  {park.name} • {park.region}
                </option>
              ))}
            </select>
            <div className="text-xs text-muted-foreground">
              Headers: x-portfolio-id + x-park-id now flow through to API calls for routing.
            </div>
          </CardContent>
        </Card>

        <Card data-testid="portfolio-rollup-card">
          <CardHeader>
            <CardTitle>Rollup</CardTitle>
            <CardDescription>Home currency: {reportQuery.data?.homeCurrency ?? activePortfolio?.homeCurrency ?? "USD"}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {reportQuery.isLoading && (
              <div className="col-span-2 space-y-2 rounded border border-border bg-muted p-3 text-sm text-muted-foreground" role="status">
                Loading portfolio report…
              </div>
            )}
            <div>
              <div className="text-xs uppercase text-muted-foreground">Revenue</div>
              <div className="text-xl font-semibold">
                {rollup ? formatCurrency(rollup.revenueHome, rollup.currency, locale) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Occupancy</div>
              <div className="text-xl font-semibold">{rollup ? formatPercent(rollup.occupancy) : "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">ADR</div>
              <div className="text-lg font-semibold">{rollup ? formatCurrency(rollup.adr, rollup.currency, locale) : "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">RevPAR</div>
              <div className="text-lg font-semibold">{rollup ? formatCurrency(rollup.revpar, rollup.currency, locale) : "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="portfolio-routing-card">
          <CardHeader>
            <CardTitle>Routing</CardTitle>
            <CardDescription>Per-park admin/guest endpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {routing?.length ? (
              routing.map((r) => (
                <div key={r.parkId} className="rounded-lg border border-border px-3 py-2">
                  <div className="text-sm font-semibold">{r.parkId}</div>
                  <div className="text-xs text-muted-foreground">Admin: {r.adminHost || "Not configured"}</div>
                  <div className="text-xs text-muted-foreground">Guest: {r.guestHost || "Not configured"}</div>
                  <div className="text-xs text-muted-foreground">Path: {r.path || "/campgrounds/:id"}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No routing configured for this portfolio.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {reportQuery.isError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert" aria-live="assertive">
          Unable to load portfolio report. Please retry.
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={() => reportQuery.refetch()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      <Card data-testid="portfolio-table-card">
        <CardHeader>
          <CardTitle>Cross-park reporting</CardTitle>
          <CardDescription>Occupancy, ADR, RevPAR, and revenue across parks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table data-testid="portfolio-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Park</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>ADR</TableHead>
                  <TableHead>RevPAR</TableHead>
                  <TableHead>Revenue (home)</TableHead>
                  <TableHead>Local tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((m) => (
                  <TableRow key={m.parkId} data-testid="portfolio-row">
                    <TableCell className="font-semibold">{m.name}</TableCell>
                    <TableCell>{m.region}</TableCell>
                    <TableCell>{formatPercent(m.occupancy)}</TableCell>
                    <TableCell>{formatCurrency(m.adr, m.currency, locale)}</TableCell>
                    <TableCell>{formatCurrency(m.revpar, m.currency, locale)}</TableCell>
                    <TableCell>{formatCurrency(m.revenueHome, reportQuery.data?.homeCurrency ?? "USD", locale)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.taxSummary ?? "N/A"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>What to watch across the portfolio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(reportQuery.data?.recommendations ?? []).map((rec) => (
            <div key={rec.id} className="rounded-lg border border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{rec.title}</div>
                <Badge variant="secondary">{rec.area}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">{rec.impact}</div>
            </div>
          ))}
          {!reportQuery.data?.recommendations?.length && (
            <div className="text-sm text-muted-foreground">No recommendations yet — data stubs are live.</div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["portfolio-report"] })}>
          Refresh report
        </Button>
        <div className="text-xs text-muted-foreground">
          Minimal functional slice: portfolio listing, selection, routing headers, and cross-park reporting stubs.
        </div>
      </div>
    </DashboardShell>
  );
}

