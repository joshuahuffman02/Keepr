"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { cn } from "@/lib/utils";
import type { AiUiBuilderTree } from "@/lib/api-client";
import { jsonRenderRegistry } from "@/components/ai/json-render-registry";
import type { ChatAccent, UnifiedChatMessage, ChatToolResult } from "./types";

type ArtifactType = "availability" | "quote" | "revenue" | "occupancy" | "json-render";

type JsonRenderArtifact = {
  tree: AiUiBuilderTree;
  data: Record<string, unknown>;
};

type ChatArtifact = {
  id: string;
  type: ArtifactType;
  title: string;
  summary?: string;
  details?: string[];
  createdAt?: string;
  jsonRender?: JsonRenderArtifact;
};

type ChatArtifactPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  messages: UnifiedChatMessage[];
  accent?: ChatAccent;
  className?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const getNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const firstRecord = (values: unknown[]) => {
  for (const value of values) {
    if (isRecord(value)) return value;
  }
  return undefined;
};

const isJsonRenderTree = (value: unknown): value is AiUiBuilderTree =>
  isRecord(value) && typeof value.root === "string" && isRecord(value.elements);

const toArtifactDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const extractJsonRender = (data: Record<string, unknown>) => {
  const candidates = [
    data.jsonRender,
    data.jsonRenderTree,
    data.uiRender,
    data.uiTree,
    data.report,
    data.layout,
  ];

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const candidateTree = isJsonRenderTree(candidate.tree)
      ? candidate.tree
      : isJsonRenderTree(candidate)
        ? candidate
        : undefined;
    if (!candidateTree) continue;

    const payloadData =
      firstRecord([candidate.data, candidate.dataset, candidate.context, candidate.payload]) ??
      firstRecord([data.data, data.metrics, data.payload]);

    return {
      tree: candidateTree,
      data: payloadData ?? {},
      title: getString(candidate.title) || getString(data.title) || "Report",
      summary: getString(candidate.summary) || getString(data.summary) || undefined,
    };
  }

  if (isJsonRenderTree(data.tree)) {
    const payloadData =
      firstRecord([data.data, data.dataset, data.context, data.payload]) ?? undefined;
    return {
      tree: data.tree,
      data: payloadData ?? {},
      title: getString(data.title) || "Report",
      summary: getString(data.summary) || undefined,
    };
  }

  if (isJsonRenderTree(data)) {
    return {
      tree: data,
      data: {},
      title: "Report",
      summary: undefined,
    };
  }

  return null;
};

const toArtifacts = (messages: UnifiedChatMessage[]): ChatArtifact[] => {
  const artifacts: ChatArtifact[] = [];
  const ordered = [...messages].reverse();

  ordered.forEach((message) => {
    const toolResults = message.toolResults ?? [];
    toolResults.forEach((result: ChatToolResult, index: number) => {
      const data = result.result;
      if (!isRecord(data)) return;

      if (Array.isArray(data.availableSites)) {
        const sites = data.availableSites.filter(isRecord);
        const total = getNumber(data.totalAvailable, sites.length);
        const nights = getNumber(data.nights, 0);
        const details = sites.slice(0, 4).map((site) => {
          const name = getString(site.name, "Site");
          const className = getString(site.className);
          const price = getString(site.pricePerNight);
          const parts = [className, price ? `${price}/night` : ""].filter(Boolean);
          return parts.length > 0 ? `${name} • ${parts.join(" • ")}` : name;
        });
        artifacts.push({
          id: `${message.id}-availability-${index}`,
          type: "availability",
          title: "Availability",
          summary:
            total > 0
              ? `${total} sites available${nights ? ` for ${nights} nights` : ""}`
              : "Availability update",
          details,
          createdAt: message.createdAt,
        });
      }

      if (isRecord(data.quote)) {
        const quote = data.quote;
        const breakdown = isRecord(quote.breakdown) ? quote.breakdown : undefined;
        const total = getString(breakdown?.total) || getString(quote.total);
        const nights = getNumber(quote.nights, 0);
        const details = [
          quote.site ? `Site: ${getString(quote.site)}` : "",
          quote.siteClass ? `Class: ${getString(quote.siteClass)}` : "",
          quote.arrivalDate && quote.departureDate
            ? `Dates: ${getString(quote.arrivalDate)} - ${getString(quote.departureDate)}`
            : "",
          nights ? `Nights: ${nights}` : "",
        ].filter(Boolean);

        artifacts.push({
          id: `${message.id}-quote-${index}`,
          type: "quote",
          title: "Quote",
          summary: total ? `Total ${total}` : "Quote details",
          details,
          createdAt: message.createdAt,
        });
      }

      if (isRecord(data.revenue)) {
        const revenue = data.revenue;
        const methods = isRecord(revenue.byMethod) ? revenue.byMethod : undefined;
        const details = [
          revenue.dateRange && isRecord(revenue.dateRange)
            ? `Dates: ${getString(revenue.dateRange.start)} - ${getString(revenue.dateRange.end)}`
            : "",
          revenue.transactionCount !== undefined
            ? `Transactions: ${getNumber(revenue.transactionCount)}`
            : "",
          ...(methods
            ? Object.entries(methods)
                .slice(0, 3)
                .map(([key, value]) => `${key}: ${getString(value)}`)
            : []),
        ].filter(Boolean);

        artifacts.push({
          id: `${message.id}-revenue-${index}`,
          type: "revenue",
          title: "Revenue Report",
          summary: revenue.total ? `Total ${getString(revenue.total)}` : "Revenue update",
          details,
          createdAt: message.createdAt,
        });
      }

      if (isRecord(data.occupancy)) {
        const occupancy = data.occupancy;
        const details = [
          occupancy.dateRange && isRecord(occupancy.dateRange)
            ? `Dates: ${getString(occupancy.dateRange.start)} - ${getString(occupancy.dateRange.end)}`
            : "",
          occupancy.totalSites !== undefined ? `Sites: ${getNumber(occupancy.totalSites)}` : "",
        ].filter(Boolean);

        artifacts.push({
          id: `${message.id}-occupancy-${index}`,
          type: "occupancy",
          title: "Occupancy Report",
          summary: occupancy.averageOccupancy
            ? `Average occupancy ${getString(occupancy.averageOccupancy)}`
            : "Occupancy update",
          details,
          createdAt: message.createdAt,
        });
      }

      const jsonRender = extractJsonRender(data);
      if (jsonRender) {
        artifacts.push({
          id: `${message.id}-json-render-${index}`,
          type: "json-render",
          title: jsonRender.title,
          summary: jsonRender.summary,
          createdAt: message.createdAt,
          jsonRender: {
            tree: jsonRender.tree,
            data: jsonRender.data,
          },
        });
      }
    });
  });

  return artifacts.slice(0, 8);
};

export function ChatArtifactPanel({
  isOpen,
  onClose,
  messages,
  accent = "staff",
  className,
}: ChatArtifactPanelProps) {
  const artifacts = useMemo(() => toArtifacts(messages), [messages]);
  const actionHandlers = useMemo(
    () => ({
      open_report: () => {
        if (typeof window !== "undefined") {
          window.open("/reports", "_blank");
        }
      },
      export_report: () => {
        if (typeof window !== "undefined") {
          window.open("/reports?export=csv", "_blank");
        }
      },
      refresh_data: () => undefined,
      run_report: () => undefined,
      save_report: () => undefined,
    }),
    [],
  );
  if (!isOpen) return null;
  const accentBorder =
    accent === "guest"
      ? "border-emerald-200"
      : accent === "support"
        ? "border-status-info/30"
        : accent === "partner"
          ? "border-status-success/30"
          : "border-blue-200";

  const panelWidthClassName = className ?? "sm:w-80";

  return (
    <div
      className={cn(
        "absolute inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full bg-card border-t border-border sm:border-t-0 sm:border-l shadow-xl z-10 flex flex-col",
        panelWidthClassName,
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="text-sm font-semibold">Artifacts</div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-muted"
          aria-label="Close artifacts panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {artifacts.length === 0 && (
          <div className="text-xs text-muted-foreground">No artifacts yet.</div>
        )}
        {artifacts.map((artifact) => (
          <div key={artifact.id} className={cn("rounded-lg border p-3 text-xs", accentBorder)}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-foreground">{artifact.title}</div>
              <div className="text-[10px] text-muted-foreground">
                {toArtifactDate(artifact.createdAt)}
              </div>
            </div>
            {artifact.summary && (
              <div className="mt-1 text-muted-foreground">{artifact.summary}</div>
            )}
            {artifact.details && artifact.details.length > 0 && (
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {artifact.details.map((line, index) => (
                  <div key={`${artifact.id}-detail-${index}`}>{line}</div>
                ))}
              </div>
            )}
            {artifact.type === "json-render" && artifact.jsonRender && (
              <div className="mt-3 rounded-lg border border-border bg-muted/30 p-2">
                <JSONUIProvider
                  registry={jsonRenderRegistry}
                  initialData={artifact.jsonRender.data}
                  actionHandlers={actionHandlers}
                >
                  <Renderer tree={artifact.jsonRender.tree} registry={jsonRenderRegistry} />
                </JSONUIProvider>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
