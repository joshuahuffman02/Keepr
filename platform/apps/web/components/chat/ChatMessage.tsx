"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bot, User, ExternalLink, Check, AlertCircle, Copy, PencilLine, RotateCcw, ThumbsUp, ThumbsDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { SuggestedPrompts } from "./SuggestedPrompts";
import type {
  ChatAccent,
  ChatActionRequired,
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
  onEditMessage?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, value: "up" | "down") => void;
  feedback?: "up" | "down";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const SUPPORT_EMAIL = "support@keeprstay.com";
const SUPPORT_SLA = "Typical response within 24 hours.";

const getString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const getNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" ? value : fallback;

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

  // Simple success message
  if (typeof data.message === "string") {
    return (
      <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg">
        <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{data.message}</span>
      </div>
    );
  }

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
              <span className="font-medium text-emerald-600">{getString(site.pricePerNight)}/night</span>
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
                <span className="text-muted-foreground ml-2">#{getString(res.confirmationCode)}</span>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">{getString(res.site)}</div>
                <div>{getString(res.arrival)} - {getString(res.departure)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Quote display
  if (isRecord(data.quote)) {
    const quote = data.quote;
    const breakdown = isRecord(quote.breakdown) ? quote.breakdown : null;
    return (
      <div className="p-3 bg-emerald-50 rounded-lg text-sm">
        <div className="font-medium text-emerald-800 mb-2">Quote for {getString(quote.site, "site")}</div>
        <div className="space-y-1 text-xs text-emerald-700">
          <div className="flex justify-between">
            <span>{getNumber(quote.nights)} night{getNumber(quote.nights) !== 1 ? "s" : ""}</span>
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
            <span className={due === "$0.00" ? "text-emerald-600" : "text-amber-600"}>
              {due}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
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
                  : "bg-amber-600 text-white hover:bg-amber-700"
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

export function ChatMessage({
  id,
  role,
  content,
  attachments,
  toolResults,
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
  onEditMessage,
  onRegenerate,
  onFeedback,
  feedback,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isSystem = role === "system";
  const resolvedAccent: ChatAccent = accent ?? (isGuest ? "guest" : "staff");
  const accentStyles: Record<ChatAccent, { avatar: string; avatarIcon: string; userBubble: string; userText: string }> =
    {
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
  const hasContent = content.trim().length > 0;
  const hasAttachments = attachments && attachments.length > 0;
  const canShowUserActions = isUser && onEditMessage && hasContent;
  const canShowAssistantActions =
    !isUser &&
    !isSystem &&
    (onRegenerate || onFeedback) &&
    hasContent;
  const shouldShowSupportTicketNote = showTicketPrompt && resolvedAccent === "support";
  const ticketCtaLabel = resolvedAccent === "support" ? "Create ticket" : "Contact Support";
  const actionClass =
    "rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground";

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
    [content, hasContent]
  );

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
      <div className="flex gap-3 justify-start">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          styles.avatar
        )}>
          <Bot className={cn("w-4 h-4", styles.avatarIcon)} />
        </div>
        <div className="bg-muted rounded-2xl rounded-bl-md p-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:0.1s]" />
            <div className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:0.2s]" />
          </div>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-4 py-2 bg-muted/50 rounded-full text-xs text-muted-foreground">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          styles.avatar
        )}>
          <Bot className={cn("w-4 h-4", styles.avatarIcon)} />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] p-3 rounded-2xl",
          isUser
            ? cn("rounded-br-md", styles.userBubble, styles.userText)
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        {hasContent && (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
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
                    href ? "hover:bg-muted/40 transition-colors" : "opacity-80"
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
                      {attachment.contentType} {attachment.size ? `• ${formatFileSize(attachment.size)}` : ""}
                    </div>
                  </div>
                </div>
              );

              if (!href) return <div key={key}>{body}</div>;

              return (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
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
              <div key={`${rec.siteClassName}-${index}`} className="bg-card rounded-lg p-2 border border-border">
                <div className="font-medium text-sm text-foreground">
                  {rec.siteClassName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {rec.reasons.join(" \u2022 ")}
                </div>
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

        {/* Tool results */}
        {toolResults && toolResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {toolResults.map((result) => (
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
            isUser ? "justify-end" : "justify-start"
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
}
