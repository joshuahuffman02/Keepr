"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  User,
  ExternalLink,
  Check,
  AlertCircle,
  Copy,
  PencilLine,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  FileText,
  ChevronDown,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { SuggestedPrompts } from "./SuggestedPrompts";
import type {
  ChatAccent,
  ChatActionRequired,
  ChatToolCall,
  ChatToolResult,
  UnifiedChatMessage,
} from "./types";

export interface ChatMessageProps extends UnifiedChatMessage {
  isLoading?: boolean;
  isGuest?: boolean;
  accent?: ChatAccent;
  onActionSelect?: (actionId: string, optionId: string) => void;
  onQuickReply?: (prompt: string) => void;
  ticketHref?: string;
  onTicketAction?: () => void;
  onShowArtifacts?: () => void;
  onToolConfirm?: (tool: string, args: Record<string, unknown>) => void;
  isExecutingTool?: boolean;
  onEditMessage?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, value: "up" | "down") => void;
  feedback?: "up" | "down";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const SUPPORT_EMAIL = "support@keeprstay.com";
const SUPPORT_SLA = "Typical response within 24 hours.";
const LONG_MESSAGE_CHAR_LIMIT = 800;
const LONG_MESSAGE_LINE_LIMIT = 12;
const HIDDEN_TOOL_NAMES = new Set(["get_tasks"]);
const CONFIRMABLE_DATE_TOOLS = new Set([
  "check_availability",
  "get_quote",
  "get_activities",
  "get_occupancy",
  "get_revenue_report",
]);

const getString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const getNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" ? value : fallback;

const getPrevalidateMessage = (result?: ChatToolResult): string | undefined => {
  const payload = result?.result;
  if (!isRecord(payload)) return undefined;
  if (payload.prevalidateFailed !== true) return undefined;
  const message = getString(payload.message);
  return message || undefined;
};

const getCodeString = (value: ReactNode): string => {
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === "string" ? entry : String(entry))).join("");
  }
  return typeof value === "string" ? value : String(value);
};

type ReportSummary = {
  title: string;
  summary?: string;
};

type KpiTrendPoint = {
  date: string;
  percentage: number;
};

type KpiSnapshot = {
  arrivalsCount?: number;
  occupancyAveragePercent?: number;
  occupancyTotalSites?: number;
  occupancyTrend?: KpiTrendPoint[];
};

const extractReportSummary = (toolResults?: ChatToolResult[]): ReportSummary | null => {
  if (!toolResults) return null;
  for (const result of toolResults) {
    const data = result.result;
    if (!isRecord(data)) continue;
    const candidate = [
      data.jsonRender,
      data.jsonRenderTree,
      data.uiRender,
      data.uiTree,
      data.report,
      data.layout,
      data.tree,
    ].find(isRecord);
    if (!candidate) continue;
    const title = getString(candidate.title) || getString(data.title) || "Report";
    const summary = getString(candidate.summary) || getString(data.summary) || undefined;
    return { title, summary };
  }
  return null;
};

const toNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const parsePercent = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/-?\d+(\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
};

const toTrendPoints = (value: unknown): KpiTrendPoint[] | null => {
  if (!Array.isArray(value)) return null;
  const points = value
    .filter(isRecord)
    .map((entry) => {
      const date = getString(entry.date);
      const percentage = parsePercent(
        entry.percentage ?? entry.occupancy ?? entry.occupancyPercent,
      );
      if (!date || percentage === null) return null;
      return { date, percentage };
    })
    .filter((entry): entry is KpiTrendPoint => Boolean(entry));
  return points.length > 0 ? points : null;
};

const extractKpiSnapshot = (toolResults?: ChatToolResult[]): KpiSnapshot | null => {
  if (!toolResults) return null;
  const snapshot: KpiSnapshot = {};

  for (const result of toolResults) {
    const data = result.result;
    if (!isRecord(data)) continue;

    if (snapshot.arrivalsCount === undefined) {
      const count =
        toNumber(data.count) ?? (Array.isArray(data.arrivals) ? data.arrivals.length : null);
      if (count !== null) {
        snapshot.arrivalsCount = count;
      }
    }

    const occupancy = isRecord(data.occupancy) ? data.occupancy : undefined;
    if (snapshot.occupancyAveragePercent === undefined) {
      const average =
        parsePercent(occupancy?.averageOccupancy ?? occupancy?.averagePercent) ??
        parsePercent(data.averageOccupancy ?? data.averagePercent);
      if (average !== null) snapshot.occupancyAveragePercent = average;
    }

    if (snapshot.occupancyTotalSites === undefined) {
      const totalSites = toNumber(occupancy?.totalSites ?? data.totalSites);
      if (totalSites !== null) snapshot.occupancyTotalSites = totalSites;
    }

    if (!snapshot.occupancyTrend) {
      const jsonRenderData =
        isRecord(data.jsonRender) && isRecord(data.jsonRender.data)
          ? data.jsonRender.data
          : undefined;
      const trend =
        toTrendPoints(occupancy?.dailyBreakdown) ??
        toTrendPoints(data.dailyBreakdown) ??
        (jsonRenderData ? toTrendPoints(jsonRenderData.dailyBreakdown) : null);
      if (trend) snapshot.occupancyTrend = trend;
    }
  }

  const hasData =
    snapshot.arrivalsCount !== undefined ||
    snapshot.occupancyAveragePercent !== undefined ||
    (snapshot.occupancyTrend && snapshot.occupancyTrend.length > 0);
  return hasData ? snapshot : null;
};

function CodeBlock({
  value,
  className,
  isUser,
}: {
  value: string;
  className?: string;
  isUser: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    if (typeof navigator === "undefined") return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
    } catch {
      // no-op
    }
  };

  return (
    <div className="mt-2">
      <div className="relative group">
        <pre
          className={cn(
            "max-h-60 overflow-auto rounded-md p-2 text-xs",
            isUser ? "bg-white/10 text-white" : "bg-muted/60 text-foreground",
          )}
        >
          <code className={cn("block text-xs font-medium", className)}>{value}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] opacity-0 transition group-hover:opacity-100",
            isUser
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-background/80 text-muted-foreground hover:text-foreground",
          )}
          aria-label="Copy code block"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function TrendBars({ data, barClassName }: { data: KpiTrendPoint[]; barClassName: string }) {
  const maxValue = Math.max(...data.map((point) => point.percentage), 100);
  return (
    <div className="mt-2 flex items-end gap-1 h-10">
      {data.map((point, index) => {
        const height = Math.max(6, Math.round((point.percentage / maxValue) * 40));
        return (
          <div
            key={`${point.date}-${index}`}
            className={cn("w-2 rounded-full", barClassName)}
            style={{ height }}
            title={`${point.date}: ${point.percentage}%`}
          />
        );
      })}
    </div>
  );
}

const buildMarkdownComponents = (isUser: boolean): Components => {
  const linkClass = isUser
    ? "text-white underline underline-offset-4"
    : "text-blue-600 underline underline-offset-4";
  const codeInlineClass = isUser ? "bg-white/15 text-white" : "bg-muted/60 text-foreground";
  const tableBorderClass = isUser ? "border-white/30" : "border-border";
  const tableHeaderClass = isUser ? "bg-white/15 text-white" : "bg-muted/70 text-foreground";
  const tableCellClass = isUser ? "text-white/90" : "text-foreground";

  return {
    p: ({ children }) => (
      <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2 last:mb-0">{children}</p>
    ),
    a: ({ href, children }) => {
      if (!href) {
        return <span className={linkClass}>{children}</span>;
      }
      const isExternal = href.startsWith("http://") || href.startsWith("https://");
      if (isExternal) {
        return (
          <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
            {children}
          </a>
        );
      }
      return (
        <Link href={href} className={linkClass}>
          {children}
        </Link>
      );
    },
    ul: ({ children }) => (
      <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 text-sm leading-relaxed space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          "border-l-2 pl-3 text-sm leading-relaxed italic",
          isUser ? "border-white/40 text-white/90" : "border-border text-muted-foreground",
        )}
      >
        {children}
      </blockquote>
    ),
    code: ({ className, children }) => {
      const isInline = !className || !className.includes("language-");
      if (isInline) {
        return (
          <code className={cn("rounded px-1 py-0.5 text-xs font-medium", codeInlineClass)}>
            {children}
          </code>
        );
      }
      const codeText = getCodeString(children).replace(/\n$/, "");
      return <CodeBlock value={codeText} className={className} isUser={isUser} />;
    },
    pre: ({ children }) => <>{children}</>,
    table: ({ children }) => (
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className={cn("text-left", tableHeaderClass)}>{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className={cn("border-b", tableBorderClass)}>{children}</tr>,
    th: ({ children }) => (
      <th className={cn("px-2 py-1.5 font-semibold", tableCellClass)}>{children}</th>
    ),
    td: ({ children }) => (
      <td className={cn("px-2 py-1.5 align-top", tableCellClass)}>{children}</td>
    ),
  };
};

const formatJson = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatTaskLabel = (value: unknown): string => getString(value).replace(/_/g, " ");

const formatShortDate = (value: unknown): string | null => {
  const raw = getString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getPriorityTone = (value: string) => {
  switch (value) {
    case "urgent":
      return "text-red-600";
    case "high":
      return "text-amber-600";
    case "medium":
      return "text-blue-600";
    case "low":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
};

function ToolResultDisplay({ result }: { result: ChatToolResult }) {
  if (result.error) {
    return (
      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{result.error}</span>
      </div>
    );
  }

  const data = result.result;
  if (!isRecord(data)) return null;

  // Array of items (e.g., available sites, reservations)
  if (Array.isArray(data.availableSites)) {
    const sites = data.availableSites.filter(isRecord);
    const totalAvailable = getNumber(data.totalAvailable, sites.length);
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {totalAvailable} site{totalAvailable !== 1 ? "s" : ""} available
        </div>
        <div className="space-y-1.5">
          {sites.slice(0, 5).map((site) => (
            <div
              key={getString(site.id, "site")}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-xs"
            >
              <div>
                <span className="font-medium">{getString(site.name, "Site")}</span>
                <span className="text-muted-foreground ml-2">{getString(site.className)}</span>
              </div>
              <span className="font-medium text-emerald-600">
                {getString(site.pricePerNight)}/night
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (Array.isArray(data.reservations)) {
    const reservations = data.reservations.filter(isRecord);
    const count = getNumber(data.count, reservations.length);
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {count} reservation{count !== 1 ? "s" : ""} found
        </div>
        <div className="space-y-1.5">
          {reservations.slice(0, 5).map((res) => (
            <div
              key={getString(res.id, "reservation")}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-xs"
            >
              <div>
                <span className="font-medium">{getString(res.guestName, "Guest")}</span>
                <span className="text-muted-foreground ml-2">
                  #{getString(res.confirmationCode)}
                </span>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">{getString(res.site)}</div>
                <div>
                  {getString(res.arrival)} - {getString(res.departure)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (Array.isArray(data.arrivals)) {
    const arrivals = data.arrivals.filter(isRecord);
    const count = getNumber(data.count, arrivals.length);
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {count} arrival{count !== 1 ? "s" : ""} today
        </div>
        <div className="space-y-1.5">
          {arrivals.slice(0, 5).map((arrival) => (
            <div
              key={getString(arrival.id, "arrival")}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-xs"
            >
              <div>
                <span className="font-medium">{getString(arrival.guestName, "Guest")}</span>
                <span className="text-muted-foreground ml-2">{getString(arrival.site)}</span>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                <div>{getString(arrival.status)}</div>
                <div>{getString(arrival.balance)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (Array.isArray(data.tasks)) {
    const tasks = data.tasks.filter(isRecord);
    const count = getNumber(data.count, tasks.length);
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {count} open task{count !== 1 ? "s" : ""}
        </div>
        <div className="space-y-1.5">
          {tasks.slice(0, 5).map((task) => {
            const title = getString(task.title, "Task");
            const site = getString(task.site);
            const assignedTo = getString(task.assignedTo);
            const dueAt = formatShortDate(task.dueAt);
            const priority = formatTaskLabel(task.priority);
            const state = formatTaskLabel(task.state);
            return (
              <div
                key={getString(task.id, "task")}
                className="flex items-start justify-between gap-2 p-2 bg-muted/50 rounded-lg text-xs"
              >
                <div>
                  <div className="font-medium text-foreground">{title}</div>
                  {(site || assignedTo) && (
                    <div className="text-[11px] text-muted-foreground">
                      {site || "Unassigned site"}
                      {assignedTo ? ` \u2022 ${assignedTo}` : ""}
                    </div>
                  )}
                  {dueAt && <div className="text-[11px] text-muted-foreground">Due {dueAt}</div>}
                </div>
                <div className="text-right text-[11px]">
                  {priority && (
                    <div
                      className={cn(
                        "font-semibold uppercase tracking-wide",
                        getPriorityTone(priority),
                      )}
                    >
                      {priority}
                    </div>
                  )}
                  {state && <div className="text-muted-foreground capitalize">{state}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (isRecord(data.occupancy)) {
    const occupancy = data.occupancy;
    const average = parsePercent(occupancy.averageOccupancy ?? occupancy.averagePercent);
    const averageLabel =
      average !== null ? `${Math.round(average)}%` : getString(occupancy.averageOccupancy) || "—";
    const totalSites = getNumber(occupancy.totalSites, 0);
    const dateRange = isRecord(occupancy.dateRange)
      ? `${getString(occupancy.dateRange.start)} - ${getString(occupancy.dateRange.end)}`
      : "";
    const trendPoints = toTrendPoints(occupancy.dailyBreakdown)?.slice(-7) ?? [];
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Occupancy</div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">{averageLabel}</div>
            {dateRange && <div className="text-[11px] text-muted-foreground">{dateRange}</div>}
          </div>
          {totalSites > 0 && (
            <div className="text-[11px] text-muted-foreground">Sites: {totalSites}</div>
          )}
        </div>
        {trendPoints.length > 0 && (
          <div>
            <div className="text-[11px] text-muted-foreground">7-day trend</div>
            <TrendBars data={trendPoints} barClassName="bg-blue-500/70" />
          </div>
        )}
      </div>
    );
  }

  // Quote display
  if (isRecord(data.quote)) {
    const quote = data.quote;
    const breakdown = isRecord(quote.breakdown) ? quote.breakdown : null;
    return (
      <div className="p-3 bg-emerald-50 rounded-lg text-sm">
        <div className="font-medium text-emerald-800 mb-2">
          Quote for {getString(quote.site, "site")}
        </div>
        <div className="space-y-1 text-xs text-emerald-700">
          <div className="flex justify-between">
            <span>
              {getNumber(quote.nights)} night{getNumber(quote.nights) !== 1 ? "s" : ""}
            </span>
            <span>{getString(breakdown?.nightly)}/night</span>
          </div>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{getString(breakdown?.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{getString(breakdown?.tax)}</span>
          </div>
          <div className="flex justify-between font-medium pt-1 border-t border-emerald-200">
            <span>Total</span>
            <span>{getString(breakdown?.total)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Balance display
  if (isRecord(data.balance)) {
    const balance = data.balance;
    const due = getString(balance.due);
    return (
      <div className="p-3 bg-muted/50 rounded-lg text-sm">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span>{getString(balance.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid</span>
            <span className="text-emerald-600">{getString(balance.paid)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Balance Due</span>
            <span className={due === "$0.00" ? "text-emerald-600" : "text-amber-600"}>{due}</span>
          </div>
        </div>
      </div>
    );
  }

  // Simple success message
  if (typeof data.message === "string") {
    return (
      <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg">
        <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{data.message}</span>
      </div>
    );
  }

  const raw = formatJson(data);
  return (
    <div className="rounded-lg border border-border bg-card/60 p-2">
      <div className="text-[11px] font-semibold text-muted-foreground mb-1">Output</div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-[11px] text-foreground">
        {raw}
      </pre>
    </div>
  );
}

function ToolCallCard({
  call,
  result,
  onConfirm,
  isConfirming,
  confirmLabel,
}: {
  call: ChatToolCall;
  result?: ChatToolResult;
  onConfirm?: (call: ChatToolCall) => void;
  isConfirming?: boolean;
  confirmLabel?: string;
}) {
  const argsJson = formatJson(call.args);
  const hasArgs = argsJson !== "{}";
  const prevalidateMessage = getPrevalidateMessage(result);
  const needsConfirmation = Boolean(prevalidateMessage);
  const statusLabel = result?.error
    ? "Failed"
    : needsConfirmation
      ? "Needs confirmation"
      : result
        ? "Completed"
        : "Running";
  const statusClass = result?.error
    ? "text-red-600"
    : needsConfirmation
      ? "text-amber-600"
      : result
        ? "text-emerald-600"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
        <div className="font-semibold text-foreground">Tool: {call.name}</div>
        <div className={cn("font-medium", statusClass)}>{statusLabel}</div>
      </div>
      <div className="px-3 py-2">
        <div className="text-[11px] font-semibold text-muted-foreground mb-1">Input</div>
        {hasArgs ? (
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-[11px] text-foreground">
            {argsJson}
          </pre>
        ) : (
          <div className="text-[11px] text-muted-foreground">No parameters.</div>
        )}
      </div>
      {result && (
        <div className="px-3 pb-3 space-y-2">
          <ToolResultDisplay result={result} />
          {needsConfirmation && onConfirm && (
            <button
              type="button"
              onClick={() => onConfirm(call)}
              disabled={isConfirming}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                isConfirming
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-amber-600 text-white hover:bg-amber-700",
              )}
            >
              {isConfirming ? "Confirming..." : (confirmLabel ?? "Confirm dates")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ActionCard({
  action,
  onSelect,
}: {
  action: ChatActionRequired;
  onSelect: (optionId: string) => void;
}) {
  return (
    <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="font-medium text-amber-900 mb-1">{action.title}</div>
      <div className="text-sm text-amber-700 mb-3">{action.description}</div>
      {action.summary && (
        <div className="text-[11px] text-amber-800 mb-3">Summary: {action.summary}</div>
      )}
      {action.options && (
        <div className="flex flex-wrap gap-2">
          {action.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                option.variant === "destructive"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : option.variant === "outline"
                    ? "bg-white border border-amber-300 text-amber-700 hover:bg-amber-100"
                    : "bg-amber-600 text-white hover:bg-amber-700",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({
  id,
  role,
  content,
  attachments,
  toolCalls,
  toolResults,
  visibility,
  actionRequired,
  recommendations,
  clarifyingQuestions,
  helpArticles,
  showTicketPrompt,
  isLoading,
  isGuest,
  accent,
  onActionSelect,
  onQuickReply,
  ticketHref = "/dashboard/help/contact",
  onTicketAction,
  onShowArtifacts,
  onToolConfirm,
  isExecutingTool,
  onEditMessage,
  onRegenerate,
  onFeedback,
  feedback,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isSystem = role === "system";
  const isInternalNote = visibility === "internal";
  const trimmedContent = content.trim();
  const resolvedAccent: ChatAccent = accent ?? (isGuest ? "guest" : "staff");
  const confirmLabel = resolvedAccent === "guest" ? "Use these dates" : "Confirm dates";
  const accentStyles: Record<
    ChatAccent,
    { avatar: string; avatarIcon: string; userBubble: string; userText: string }
  > = {
    guest: {
      avatar: "bg-emerald-100",
      avatarIcon: "text-emerald-600",
      userBubble: "bg-emerald-600",
      userText: "text-white",
    },
    staff: {
      avatar: "bg-blue-100",
      avatarIcon: "text-blue-600",
      userBubble: "bg-blue-600",
      userText: "text-white",
    },
    public: {
      avatar: "bg-action-primary/15",
      avatarIcon: "text-action-primary",
      userBubble: "bg-action-primary",
      userText: "text-action-primary-foreground",
    },
    support: {
      avatar: "bg-status-info/15",
      avatarIcon: "text-status-info",
      userBubble: "bg-status-info",
      userText: "text-white",
    },
    partner: {
      avatar: "bg-status-success/15",
      avatarIcon: "text-status-success",
      userBubble: "bg-status-success",
      userText: "text-white",
    },
  };
  const styles = accentStyles[resolvedAccent];
  const hasContent = trimmedContent.length > 0;
  const hasAttachments = attachments && attachments.length > 0;
  const canShowUserActions = isUser && onEditMessage && hasContent;
  const canShowAssistantActions =
    !isUser && !isSystem && (onRegenerate || onFeedback) && hasContent;
  const shouldShowSupportTicketNote = showTicketPrompt && resolvedAccent === "support";
  const ticketCtaLabel = resolvedAccent === "support" ? "Create ticket" : "Contact Support";
  const actionClass =
    "rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground";
  const toolCallIds = new Set((toolCalls ?? []).map((call) => call.id));
  const orphanedToolResults = (toolResults ?? []).filter(
    (result) => !toolCallIds.has(result.toolCallId),
  );
  const hiddenToolCallIds = new Set(
    (toolCalls ?? []).filter((call) => HIDDEN_TOOL_NAMES.has(call.name)).map((call) => call.id),
  );
  const visibleToolCalls = (toolCalls ?? []).filter((call) => !HIDDEN_TOOL_NAMES.has(call.name));
  const visibleOrphanedToolResults = orphanedToolResults.filter(
    (result) => !hiddenToolCallIds.has(result.toolCallId),
  );
  const handleToolConfirm = useCallback(
    (call: ChatToolCall) => {
      if (!onToolConfirm) return;
      if (!CONFIRMABLE_DATE_TOOLS.has(call.name)) return;
      onToolConfirm(call.name, { ...call.args, confirmed: true });
    },
    [onToolConfirm],
  );
  const reportSummary = useMemo(() => extractReportSummary(toolResults), [toolResults]);
  const shouldShowReportSummary = reportSummary !== null && !isUser && !isSystem;
  const kpiSnapshot = useMemo(() => extractKpiSnapshot(toolResults), [toolResults]);
  const trendPoints = useMemo(() => {
    if (!kpiSnapshot?.occupancyTrend) return [];
    return kpiSnapshot.occupancyTrend.slice(-7);
  }, [kpiSnapshot]);
  const kpiItems = useMemo(() => {
    if (!kpiSnapshot) return [];
    const items: Array<{
      label: string;
      value?: string;
      subLabel?: string;
      trend?: KpiTrendPoint[];
    }> = [];
    if (kpiSnapshot.arrivalsCount !== undefined) {
      items.push({
        label: "Arrivals today",
        value: String(kpiSnapshot.arrivalsCount),
      });
    }
    if (kpiSnapshot.occupancyAveragePercent !== undefined) {
      const average = Math.round(kpiSnapshot.occupancyAveragePercent);
      items.push({
        label: "Avg occupancy",
        value: `${average}%`,
        subLabel: kpiSnapshot.occupancyTotalSites
          ? `${kpiSnapshot.occupancyTotalSites} sites`
          : undefined,
      });
    }
    if (trendPoints.length > 0) {
      items.push({
        label: "7-day trend",
        trend: trendPoints,
      });
    }
    return items;
  }, [kpiSnapshot, trendPoints]);
  const shouldShowKpiSnapshot =
    kpiItems.length > 0 && !isUser && !isSystem && resolvedAccent === "staff";
  const trendBarClass =
    resolvedAccent === "guest"
      ? "bg-emerald-500/70"
      : resolvedAccent === "support"
        ? "bg-status-info/70"
        : resolvedAccent === "partner"
          ? "bg-status-success/70"
          : "bg-blue-500/70";
  const contentLineCount = useMemo(
    () => (hasContent ? trimmedContent.split(/\n/).length : 0),
    [hasContent, trimmedContent],
  );
  const isLongContent =
    !isUser &&
    !isSystem &&
    hasContent &&
    (trimmedContent.length > LONG_MESSAGE_CHAR_LIMIT || contentLineCount > LONG_MESSAGE_LINE_LIMIT);
  const [isExpanded, setIsExpanded] = useState(false);
  const longContentRef = useRef<HTMLDivElement | null>(null);
  const markdownComponents = useMemo(
    () => buildMarkdownComponents(isUser && !isInternalNote),
    [isInternalNote, isUser],
  );

  const handleCopy = useMemo(
    () => async () => {
      if (!hasContent) return;
      if (typeof navigator === "undefined") return;
      try {
        await navigator.clipboard?.writeText(content);
      } catch {
        // no-op
      }
    },
    [content, hasContent],
  );

  const handleLongContentWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const maxScrollTop = element.scrollHeight - element.clientHeight;
    const nextScrollTop = Math.min(maxScrollTop, Math.max(0, element.scrollTop + event.deltaY));
    if (nextScrollTop === element.scrollTop) return;
    element.scrollTop = nextScrollTop;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleLongContentKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const maxScrollTop = element.scrollHeight - element.clientHeight;
    if (maxScrollTop <= 0) return;

    let delta = 0;
    if (event.key === "ArrowDown") delta = 40;
    if (event.key === "ArrowUp") delta = -40;
    if (event.key === "PageDown") delta = element.clientHeight * 0.9;
    if (event.key === "PageUp") delta = -element.clientHeight * 0.9;
    if (event.key === "Home") {
      element.scrollTop = 0;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === "End") {
      element.scrollTop = maxScrollTop;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (delta === 0) return;

    const nextScrollTop = Math.min(maxScrollTop, Math.max(0, element.scrollTop + delta));
    if (nextScrollTop === element.scrollTop) return;
    element.scrollTop = nextScrollTop;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleScrollTo = useCallback((direction: "top" | "bottom") => {
    const element = longContentRef.current;
    if (!element) return;
    const top = direction === "top" ? 0 : element.scrollHeight;
    element.scrollTo({ top, behavior: "smooth" });
    element.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    setIsExpanded(false);
  }, [id]);

  const formatFileSize = (size: number) => {
    if (!Number.isFinite(size)) return "";
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex gap-3 justify-start motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", styles.avatar)}>
          <Bot className={cn("w-4 h-4", styles.avatarIcon)} />
        </div>
        <div className="bg-muted rounded-2xl rounded-bl-md p-3 space-y-2">
          <div className="h-2 w-24 rounded-full bg-muted-foreground/30 animate-pulse" />
          <div className="h-2 w-36 rounded-full bg-muted-foreground/20 animate-pulse" />
          <div className="h-2 w-20 rounded-full bg-muted-foreground/25 animate-pulse" />
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="flex justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <div className="px-4 py-2 bg-muted/50 rounded-full text-xs text-muted-foreground">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            styles.avatar,
          )}
        >
          <Bot className={cn("w-4 h-4", styles.avatarIcon)} />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] p-3 rounded-2xl",
          isInternalNote
            ? cn(
                "border border-amber-200 bg-amber-50 text-amber-900",
                isUser ? "rounded-br-md" : "rounded-bl-md",
              )
            : isUser
              ? cn("rounded-br-md", styles.userBubble, styles.userText)
              : "bg-muted text-foreground rounded-bl-md",
        )}
      >
        {isInternalNote && (
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Internal note
          </div>
        )}
        {shouldShowKpiSnapshot && (
          <div
            className="mb-3 rounded-lg border border-border bg-card/70 p-3 text-xs"
            data-testid="chat-kpi-snapshot"
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              KPI Snapshot
            </div>
            <div
              className={cn(
                "mt-2 grid gap-3",
                kpiItems.length === 1
                  ? "grid-cols-1"
                  : kpiItems.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3",
              )}
            >
              {kpiItems.map((item) => (
                <div key={item.label} className="rounded-md bg-muted/40 p-2">
                  <div className="text-[11px] text-muted-foreground">{item.label}</div>
                  {item.trend ? (
                    <TrendBars data={item.trend} barClassName={trendBarClass} />
                  ) : (
                    <div className="mt-1 text-lg font-semibold text-foreground">
                      {item.value ?? "—"}
                    </div>
                  )}
                  {item.subLabel && (
                    <div className="text-[10px] text-muted-foreground">{item.subLabel}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {hasContent && (
          <div
            data-testid={isLongContent ? "chat-long-message-body" : undefined}
            ref={longContentRef}
            className={cn(
              "relative",
              isLongContent && !isExpanded
                ? "max-h-64 overflow-y-auto pr-2 overscroll-contain touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2"
                : "",
            )}
            onWheel={isLongContent && !isExpanded ? handleLongContentWheel : undefined}
            onKeyDown={isLongContent && !isExpanded ? handleLongContentKeyDown : undefined}
            tabIndex={isLongContent && !isExpanded ? 0 : undefined}
            role={isLongContent && !isExpanded ? "region" : undefined}
            aria-label={isLongContent && !isExpanded ? "Scrollable response" : undefined}
            style={isLongContent && !isExpanded ? { WebkitOverflowScrolling: "touch" } : undefined}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
            {isLongContent && !isExpanded && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-muted/80" />
            )}
          </div>
        )}
        {isLongContent && !isExpanded && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <div className="inline-flex items-center gap-1">
              <ChevronDown className="h-3 w-3" />
              Scroll for more
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleScrollTo("top")}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Scroll to top of message"
              >
                <ArrowUp className="h-3 w-3" />
                Top
              </button>
              <button
                type="button"
                onClick={() => handleScrollTo("bottom")}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Scroll to bottom of message"
              >
                <ArrowDown className="h-3 w-3" />
                Bottom
              </button>
            </div>
          </div>
        )}
        {isLongContent && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mt-2 inline-flex items-center text-[11px] font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={isExpanded}
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}

        {shouldShowReportSummary && reportSummary && (
          <div className="mt-3 rounded-lg border border-border bg-card/70 p-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground">{reportSummary.title}</div>
                {reportSummary.summary && (
                  <div className="text-muted-foreground">{reportSummary.summary}</div>
                )}
              </div>
              {onShowArtifacts && (
                <button
                  type="button"
                  onClick={onShowArtifacts}
                  className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Open report
                </button>
              )}
            </div>
          </div>
        )}

        {hasAttachments && (
          <div className="mt-3 space-y-2">
            {attachments?.map((attachment, index) => {
              const href = attachment.downloadUrl ?? attachment.url;
              const isImage = attachment.contentType.startsWith("image/");
              const key = `${attachment.name}-${index}`;
              const body = (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border bg-card/60 p-2 text-xs",
                    href ? "hover:bg-muted/40 transition-colors" : "opacity-80",
                  )}
                >
                  {isImage && href ? (
                    <img
                      src={href}
                      alt={attachment.name}
                      className="h-16 w-20 rounded-md object-cover border border-border"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{attachment.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {attachment.contentType}{" "}
                      {attachment.size ? `• ${formatFileSize(attachment.size)}` : ""}
                    </div>
                  </div>
                </div>
              );

              if (!href) return <div key={key}>{body}</div>;

              return (
                <a key={key} href={href} target="_blank" rel="noreferrer" className="block">
                  {body}
                </a>
              );
            })}
          </div>
        )}

        {recommendations && recommendations.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended site classes
            </div>
            {recommendations.map((rec, index) => (
              <div
                key={`${rec.siteClassName}-${index}`}
                className="bg-card rounded-lg p-2 border border-border"
              >
                <div className="font-medium text-sm text-foreground">{rec.siteClassName}</div>
                <div className="text-xs text-muted-foreground">{rec.reasons.join(" \u2022 ")}</div>
              </div>
            ))}
          </div>
        )}

        {clarifyingQuestions && clarifyingQuestions.length > 0 && onQuickReply && (
          <div className="mt-3">
            <SuggestedPrompts
              align="start"
              accent={resolvedAccent}
              label="Quick answers"
              onSelect={onQuickReply}
              prompts={clarifyingQuestions}
            />
          </div>
        )}

        {helpArticles && helpArticles.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Related articles:</p>
            {helpArticles.map((article) => (
              <Link
                key={article.url}
                href={article.url}
                className="flex items-center gap-2 bg-card rounded-lg p-2 border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {article.title}
              </Link>
            ))}
          </div>
        )}

        {/* Tool calls */}
        {visibleToolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {visibleToolCalls.map((call) => {
              const result = toolResults?.find((item) => item.toolCallId === call.id);
              const canConfirm = Boolean(onToolConfirm) && CONFIRMABLE_DATE_TOOLS.has(call.name);
              return (
                <ToolCallCard
                  key={call.id}
                  call={call}
                  result={result}
                  onConfirm={canConfirm ? handleToolConfirm : undefined}
                  isConfirming={isExecutingTool}
                  confirmLabel={confirmLabel}
                />
              );
            })}
          </div>
        )}

        {/* Tool results (unmatched) */}
        {visibleOrphanedToolResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {visibleOrphanedToolResults.map((result) => (
              <ToolResultDisplay key={result.toolCallId} result={result} />
            ))}
          </div>
        )}

        {/* Action required */}
        {actionRequired && onActionSelect && (
          <ActionCard
            action={actionRequired}
            onSelect={(optionId) => onActionSelect(actionRequired.actionId, optionId)}
          />
        )}

        {showTicketPrompt && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Need more help?</p>
            {resolvedAccent === "support" && onTicketAction ? (
              <button
                type="button"
                onClick={onTicketAction}
                className="inline-flex items-center gap-2 bg-status-info text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-status-info/80 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {ticketCtaLabel}
              </button>
            ) : (
              <Link
                href={ticketHref}
                className="inline-flex items-center gap-2 bg-status-info text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-status-info/80 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {ticketCtaLabel}
              </Link>
            )}
            {shouldShowSupportTicketNote && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {SUPPORT_SLA} Or email{" "}
                <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            )}
          </div>
        )}
      </div>

      {(canShowUserActions || canShowAssistantActions) && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100",
            isUser ? "justify-end" : "justify-start",
          )}
        >
          {canShowUserActions && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className={actionClass}
                aria-label="Copy message"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onEditMessage?.(id, content)}
                className={actionClass}
                aria-label="Edit message"
              >
                <PencilLine className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {canShowAssistantActions && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className={actionClass}
                aria-label="Copy response"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate?.(id)}
                  className={actionClass}
                  aria-label="Regenerate response"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {onFeedback && (
                <>
                  <button
                    type="button"
                    onClick={() => onFeedback?.(id, "up")}
                    className={cn(actionClass, feedback === "up" && "text-emerald-600")}
                    aria-label="Thumbs up"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onFeedback?.(id, "down")}
                    className={cn(actionClass, feedback === "down" && "text-red-500")}
                    aria-label="Thumbs down"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {isUser && (
        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
});
