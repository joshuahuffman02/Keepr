"use client";

import { ArrowLeft, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatAccent, ChatConversationSummary, UnifiedChatMessage } from "./types";

const ROLE_LABELS: Record<UnifiedChatMessage["role"], string> = {
  user: "You",
  assistant: "Assistant",
  tool: "Tool",
  system: "System",
};

type ChatHistoryPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  view?: "list" | "conversation";
  conversations?: ChatConversationSummary[];
  isLoadingConversations?: boolean;
  hasMoreConversations?: boolean;
  onLoadMoreConversations?: () => void;
  onSelectConversation?: (conversationId: string) => void;
  onNewConversation?: () => void;
  activeConversationId?: string | null;
  onBack?: () => void;
  messages: UnifiedChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  accent?: ChatAccent;
  emptyState?: string;
  conversationEmptyState?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: { id: string; label: string }[];
  activeFilterId?: string;
  onFilterChange?: (id: string) => void;
};

export function ChatHistoryPanel({
  isOpen,
  onClose,
  view = "conversation",
  conversations = [],
  isLoadingConversations = false,
  hasMoreConversations = false,
  onLoadMoreConversations,
  onSelectConversation,
  onNewConversation,
  activeConversationId,
  onBack,
  messages,
  isLoading,
  hasMore,
  onLoadMore,
  accent = "staff",
  emptyState = "No history yet. Send a message to start.",
  conversationEmptyState = "No conversations yet.",
  searchValue = "",
  onSearchChange,
  filters = [],
  activeFilterId,
  onFilterChange,
}: ChatHistoryPanelProps) {
  if (!isOpen) return null;

  const isListView = view === "list";
  const accentBorder =
    accent === "guest"
      ? "border-emerald-200"
      : accent === "support"
        ? "border-status-info/30"
        : accent === "partner"
          ? "border-status-success/30"
          : "border-blue-200";
  const activeConversationClass =
    accent === "guest"
      ? "border-emerald-200 bg-emerald-50/60"
      : accent === "support"
        ? "border-status-info/30 bg-status-info/10"
        : accent === "partner"
          ? "border-status-success/30 bg-status-success/10"
          : "border-blue-200 bg-blue-50/60";
  const activeFilterClass =
    accent === "guest"
      ? "bg-emerald-100 text-emerald-700"
      : accent === "support"
        ? "bg-status-info/10 text-status-info"
        : accent === "partner"
          ? "bg-status-success/10 text-status-success"
          : "bg-blue-100 text-blue-700";

  const formatDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="absolute inset-y-0 right-0 w-72 bg-card border-l border-border shadow-xl z-10 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          {!isListView && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 rounded-md hover:bg-muted"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="text-sm font-semibold">{isListView ? "History" : "Conversation"}</div>
        </div>
        <div className="flex items-center gap-1">
          {isListView && onNewConversation && (
            <button
              type="button"
              onClick={onNewConversation}
              className="p-1 rounded-md hover:bg-muted"
              aria-label="Start a new chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted"
            aria-label="Close history panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isListView ? (
          <>
            {(onSearchChange || filters.length > 0) && (
              <div className="space-y-2">
                {onSearchChange && (
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search conversations"
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                )}
                {filters.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {filters.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => onFilterChange?.(filter.id)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                          filter.id === activeFilterId
                            ? cn("border-transparent", activeFilterClass)
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {conversations.length === 0 && !isLoadingConversations && (
              <div className="text-xs text-muted-foreground">{conversationEmptyState}</div>
            )}
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation?.(conversation.id)}
                  className={cn(
                    "w-full rounded-lg border p-2 text-left text-xs transition-colors",
                    isActive ? activeConversationClass : "border-border hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-foreground">
                      {conversation.title || "Chat"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDate(conversation.updatedAt)}
                    </div>
                  </div>
                  <div className="mt-1 text-muted-foreground line-clamp-2">
                    {conversation.lastMessagePreview || "No messages yet."}
                  </div>
                </button>
              );
            })}
            {isLoadingConversations && (
              <div className="text-xs text-muted-foreground">Loading conversations...</div>
            )}
            {hasMoreConversations && !isLoadingConversations && onLoadMoreConversations && (
              <button
                type="button"
                onClick={onLoadMoreConversations}
                className="w-full rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Load more
              </button>
            )}
          </>
        ) : (
          <>
            {messages.length === 0 && !isLoading && (
              <div className="text-xs text-muted-foreground">{emptyState}</div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={cn("rounded-lg border p-2 text-xs", accentBorder)}>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {ROLE_LABELS[message.role]}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-foreground">{message.content}</div>
              </div>
            ))}
            {isLoading && <div className="text-xs text-muted-foreground">Loading history...</div>}
            {hasMore && !isLoading && (
              <button
                type="button"
                onClick={onLoadMore}
                className="w-full rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Load earlier
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
