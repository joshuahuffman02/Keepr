"use client";

import { Bot, User, Loader2, ExternalLink, Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

interface ToolResult {
  toolCallId: string;
  result: any;
  error?: string;
}

interface ActionRequired {
  type: "confirmation" | "form" | "selection";
  actionId: string;
  title: string;
  description: string;
  data?: Record<string, any>;
  options?: ActionOption[];
}

interface ActionOption {
  id: string;
  label: string;
  variant?: "default" | "destructive" | "outline";
}

export interface ChatMessageProps {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  actionRequired?: ActionRequired;
  createdAt?: string;
  isLoading?: boolean;
  isGuest?: boolean;
  onActionSelect?: (actionId: string, optionId: string) => void;
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ToolResultDisplay({ result }: { result: ToolResult }) {
  if (result.error) {
    return (
      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{result.error}</span>
      </div>
    );
  }

  const data = result.result;
  if (!data) return null;

  // Simple success message
  if (data.message && typeof data.message === "string") {
    return (
      <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg">
        <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{data.message}</span>
      </div>
    );
  }

  // Array of items (e.g., available sites, reservations)
  if (data.availableSites && Array.isArray(data.availableSites)) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {data.totalAvailable} site{data.totalAvailable !== 1 ? "s" : ""} available
        </div>
        <div className="space-y-1.5">
          {data.availableSites.slice(0, 5).map((site: any) => (
            <div
              key={site.id}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-xs"
            >
              <div>
                <span className="font-medium">{site.name}</span>
                <span className="text-muted-foreground ml-2">{site.className}</span>
              </div>
              <span className="font-medium text-emerald-600">{site.pricePerNight}/night</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.reservations && Array.isArray(data.reservations)) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {data.count} reservation{data.count !== 1 ? "s" : ""} found
        </div>
        <div className="space-y-1.5">
          {data.reservations.slice(0, 5).map((res: any) => (
            <div
              key={res.id}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-xs"
            >
              <div>
                <span className="font-medium">{res.guestName}</span>
                <span className="text-muted-foreground ml-2">#{res.confirmationCode}</span>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">{res.site}</div>
                <div>{res.arrival} - {res.departure}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Quote display
  if (data.quote) {
    const quote = data.quote;
    return (
      <div className="p-3 bg-emerald-50 rounded-lg text-sm">
        <div className="font-medium text-emerald-800 mb-2">Quote for {quote.site}</div>
        <div className="space-y-1 text-xs text-emerald-700">
          <div className="flex justify-between">
            <span>{quote.nights} night{quote.nights !== 1 ? "s" : ""}</span>
            <span>{quote.breakdown.nightly}/night</span>
          </div>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{quote.breakdown.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{quote.breakdown.tax}</span>
          </div>
          <div className="flex justify-between font-medium pt-1 border-t border-emerald-200">
            <span>Total</span>
            <span>{quote.breakdown.total}</span>
          </div>
        </div>
      </div>
    );
  }

  // Balance display
  if (data.balance) {
    return (
      <div className="p-3 bg-muted/50 rounded-lg text-sm">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span>{data.balance.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid</span>
            <span className="text-emerald-600">{data.balance.paid}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Balance Due</span>
            <span className={data.balance.due === "$0.00" ? "text-emerald-600" : "text-amber-600"}>
              {data.balance.due}
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
  action: ActionRequired;
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
  role,
  content,
  toolCalls,
  toolResults,
  actionRequired,
  isLoading,
  isGuest,
  onActionSelect,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isSystem = role === "system";
  const accentColor = isGuest ? "emerald" : "blue";

  if (isLoading) {
    return (
      <div className="flex gap-3 justify-start">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          isGuest ? "bg-emerald-100" : "bg-blue-100"
        )}>
          <Bot className={cn("w-4 h-4", isGuest ? "text-emerald-600" : "text-blue-600")} />
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
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isGuest ? "bg-emerald-100" : "bg-blue-100"
        )}>
          <Bot className={cn("w-4 h-4", isGuest ? "text-emerald-600" : "text-blue-600")} />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] p-3 rounded-2xl",
          isUser
            ? cn(
                "rounded-br-md text-white",
                isGuest ? "bg-emerald-600" : "bg-blue-600"
              )
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>

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
      </div>

      {isUser && (
        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
