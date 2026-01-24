"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const authHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("campreserv:authToken")
      : process.env.NEXT_PUBLIC_STAFF_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

type Park = {
  id: string;
  name: string;
  region?: string | null;
};

type Portfolio = {
  id: string;
  name: string;
  parks: Park[];
};

type PortfolioResponse = {
  portfolios: Portfolio[];
  activePortfolioId?: string | null;
  activeParkId?: string | null;
};

type PortfolioSelectResponse = {
  activePortfolioId?: string | null;
  activeParkId?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const toPark = (value: unknown): Park | null => {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const name = getString(value.name);
  if (!id || !name) return null;
  const region = getString(value.region);
  return { id, name, region };
};

const toPortfolio = (value: unknown): Portfolio | null => {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const name = getString(value.name);
  if (!id || !name) return null;
  const parks = Array.isArray(value.parks)
    ? value.parks.map(toPark).filter((park): park is Park => park !== null)
    : [];
  return { id, name, parks };
};

const toPortfolioResponse = (value: unknown): PortfolioResponse => {
  if (!isRecord(value)) {
    return { portfolios: [] };
  }
  const portfolios = Array.isArray(value.portfolios)
    ? value.portfolios
        .map(toPortfolio)
        .filter((portfolio): portfolio is Portfolio => portfolio !== null)
    : [];
  return {
    portfolios,
    activePortfolioId: getString(value.activePortfolioId),
    activeParkId: getString(value.activeParkId),
  };
};

const toPortfolioSelectResponse = (value: unknown): PortfolioSelectResponse => {
  if (!isRecord(value)) {
    return {};
  }
  return {
    activePortfolioId: getString(value.activePortfolioId),
    activeParkId: getString(value.activeParkId),
  };
};

const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : "Please try again");

const portfolioApi = {
  async getPortfolios(): Promise<PortfolioResponse> {
    const res = await fetch(`${API_BASE}/portfolios`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to load portfolios");
    const data: unknown = await res.json();
    return toPortfolioResponse(data);
  },
  async selectPortfolio(payload: {
    portfolioId: string;
    parkId?: string | null;
  }): Promise<PortfolioSelectResponse> {
    const res = await fetch(`${API_BASE}/portfolios/select`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to update portfolio");
    }
    const data: unknown = await res.json();
    return toPortfolioSelectResponse(data);
  },
};

type PickerTone = "dark" | "light";

type PortfolioParkPickerProps = {
  onContextChange?: (ctx: {
    portfolioId: string | null;
    parkId: string | null;
    source: "init" | "user";
  }) => void;
  tone?: PickerTone;
  compact?: boolean;
  className?: string;
};

export function PortfolioParkPicker({
  onContextChange,
  tone = "dark",
  compact = false,
  className,
}: PortfolioParkPickerProps) {
  const { toast } = useToast();
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [parkId, setParkId] = useState<string | null>(null);
  const [appliedContext, setAppliedContext] = useState<{
    portfolioId: string | null;
    parkId: string | null;
  }>({
    portfolioId: null,
    parkId: null,
  });

  const portfoliosQuery = useQuery<PortfolioResponse>({
    queryKey: ["portfolios"],
    queryFn: portfolioApi.getPortfolios,
  });

  const applyLocalContext = useCallback(
    (nextPortfolioId: string, nextParkId: string | null, source: "init" | "user" = "user") => {
      setPortfolioId(nextPortfolioId);
      setParkId(nextParkId);
      setAppliedContext({ portfolioId: nextPortfolioId, parkId: nextParkId });
      if (typeof window !== "undefined") {
        localStorage.setItem("campreserv:selectedPortfolio", nextPortfolioId);
        if (nextParkId) {
          localStorage.setItem("campreserv:selectedPark", nextParkId);
          localStorage.setItem("campreserv:selectedCampground", nextParkId);
        }
      }
      onContextChange?.({ portfolioId: nextPortfolioId, parkId: nextParkId, source });
    },
    [onContextChange],
  );

  // Hydrate from localStorage on first render
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPortfolio = localStorage.getItem("campreserv:selectedPortfolio");
    const storedPark =
      localStorage.getItem("campreserv:selectedPark") ||
      localStorage.getItem("campreserv:selectedCampground");
    if (storedPortfolio) setPortfolioId(storedPortfolio);
    if (storedPark) setParkId(storedPark);
    if (storedPortfolio) {
      setAppliedContext({ portfolioId: storedPortfolio, parkId: storedPark });
      onContextChange?.({ portfolioId: storedPortfolio, parkId: storedPark, source: "init" });
    }
  }, [onContextChange]);

  // Prefer active portfolio/park from the API the first time it loads.
  useEffect(() => {
    const data = portfoliosQuery.data;
    if (!data) return;
    if (!portfolioId && data.activePortfolioId) {
      applyLocalContext(data.activePortfolioId, data.activeParkId ?? null, "init");
      return;
    }
    if (!parkId && data.activeParkId) {
      const nextParkId = data.activeParkId ?? null;
      setParkId(nextParkId);
      setAppliedContext((prev) => ({ ...prev, parkId: nextParkId }));
      onContextChange?.({ portfolioId, parkId: nextParkId, source: "init" });
    }
  }, [applyLocalContext, parkId, portfolioId, portfoliosQuery.data, onContextChange]);

  const selectMutation = useMutation<
    PortfolioSelectResponse,
    Error,
    { portfolioId: string; parkId?: string | null }
  >({
    mutationFn: portfolioApi.selectPortfolio,
    onSuccess: (data, variables) => {
      const confirmedPark = variables.parkId ?? data.activeParkId ?? parkId ?? null;
      applyLocalContext(variables.portfolioId, confirmedPark, "user");
      toast({ title: "Portfolio context updated" });
    },
    onError: (err) => {
      setPortfolioId(appliedContext.portfolioId);
      setParkId(appliedContext.parkId);
      toast({
        title: "Unable to update portfolio",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const activePortfolio = useMemo(() => {
    const portfolios = portfoliosQuery.data?.portfolios ?? [];
    return (
      portfolios.find((p) => p.id === portfolioId) ??
      portfolios.find((p) => p.id === portfoliosQuery.data?.activePortfolioId) ??
      portfolios[0]
    );
  }, [portfolioId, portfoliosQuery.data]);

  const handlePortfolioChange = (nextPortfolioId: string) => {
    const fallbackPark =
      portfoliosQuery.data?.portfolios.find((p) => p.id === nextPortfolioId)?.parks?.[0]?.id ??
      null;
    setPortfolioId(nextPortfolioId);
    if (fallbackPark) setParkId(fallbackPark);
    selectMutation.mutate({ portfolioId: nextPortfolioId, parkId: fallbackPark ?? undefined });
  };

  const handleParkChange = (nextParkId: string) => {
    if (!portfolioId) {
      toast({ title: "Select a portfolio first", variant: "destructive" });
      return;
    }
    setParkId(nextParkId);
    selectMutation.mutate({ portfolioId, parkId: nextParkId });
  };

  const labelClass =
    tone === "dark"
      ? "text-[11px] uppercase tracking-wide text-muted-foreground"
      : "text-[11px] uppercase tracking-wide text-muted-foreground";
  const selectClass =
    tone === "dark"
      ? "w-full rounded-md border border-border bg-muted px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-400"
      : "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const cardClass =
    tone === "dark"
      ? "rounded-lg border border-border bg-muted/70"
      : "rounded-lg border border-border bg-card";
  const headingClass = tone === "dark" ? "text-muted-foreground" : "text-foreground";

  const isLoading = portfoliosQuery.isLoading;
  const portfolios = portfoliosQuery.data?.portfolios ?? [];
  const parks = activePortfolio?.parks ?? [];

  return (
    <div className={cn(cardClass, compact ? "p-3" : "p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className={cn("text-xs font-semibold", headingClass)}>Portfolio context</div>
        {selectMutation.isPending && <div className="text-[11px] text-emerald-300">Saving…</div>}
      </div>
      <div className={cn("mt-2 grid gap-2", compact ? "grid-cols-1" : "grid-cols-1")}>
        <div className="space-y-1">
          <div className={labelClass}>Portfolio</div>
          <select
            data-testid="portfolio-picker:portfolio"
            className={selectClass}
            value={portfolioId ?? ""}
            disabled={isLoading || portfolios.length === 0}
            onChange={(e) => handlePortfolioChange(e.target.value)}
          >
            {portfolios.length === 0 ? <option value="">Loading portfolios…</option> : null}
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <div className={labelClass}>Park</div>
          <select
            data-testid="portfolio-picker:park"
            className={selectClass}
            value={parkId ?? ""}
            disabled={!activePortfolio || parks.length === 0 || selectMutation.isPending}
            onChange={(e) => handleParkChange(e.target.value)}
          >
            {parks.length === 0 ? <option value="">Select a portfolio first</option> : null}
            {parks.map((park) => (
              <option key={park.id} value={park.id}>
                {park.name} • {park.region}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
