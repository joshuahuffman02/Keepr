"use client";

import { useCallback, useState } from "react";
import { API_BASE } from "@/lib/api-config";
import type { ChatAttachment, ChatMessageVisibility, UnifiedChatMessage } from "../types";

type HistoryMode = "guest" | "staff";

interface UseChatHistoryOptions {
  mode: HistoryMode;
  campgroundId?: string;
  conversationId?: string | null;
  authToken?: string | null;
  guestId?: string;
  limit?: number;
}

interface HistoryResponse {
  conversationId: string;
  messages: UnifiedChatMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getVisibility = (value: unknown): ChatMessageVisibility | undefined =>
  value === "internal" || value === "public" ? value : undefined;

const toHistoryResponse = (value: unknown): HistoryResponse | null => {
  if (!isRecord(value)) return null;
  if (typeof value.conversationId !== "string") return null;
  if (!Array.isArray(value.messages)) return null;

  const resolveRole = (role: unknown): UnifiedChatMessage["role"] => {
    switch (role) {
      case "user":
      case "assistant":
      case "tool":
      case "system":
        return role;
      default:
        return "assistant";
    }
  };

  const isAttachment = (entry: unknown): entry is ChatAttachment =>
    isRecord(entry) &&
    typeof entry.name === "string" &&
    typeof entry.contentType === "string" &&
    typeof entry.size === "number" &&
    (entry.url === undefined || typeof entry.url === "string") &&
    (entry.downloadUrl === undefined || typeof entry.downloadUrl === "string") &&
    (entry.storageKey === undefined || typeof entry.storageKey === "string");

  const messages = value.messages.filter(isRecord).map((message) => ({
    id: typeof message.id === "string" ? message.id : `msg_${Date.now()}`,
    role: resolveRole(message.role),
    content: typeof message.content === "string" ? message.content : "",
    toolCalls: Array.isArray(message.toolCalls) ? message.toolCalls : undefined,
    toolResults: Array.isArray(message.toolResults) ? message.toolResults : undefined,
    attachments: Array.isArray(message.attachments)
      ? message.attachments.filter(isAttachment)
      : undefined,
    createdAt: typeof message.createdAt === "string" ? message.createdAt : undefined,
    visibility: getVisibility(message.visibility),
  }));

  return {
    conversationId: value.conversationId,
    messages,
    hasMore: typeof value.hasMore === "boolean" ? value.hasMore : false,
    nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : undefined,
  };
};

export function useChatHistory({
  mode,
  campgroundId,
  conversationId,
  authToken,
  guestId,
  limit = 40,
}: UseChatHistoryOptions) {
  const [messages, setMessages] = useState<UnifiedChatMessage[]>([]);
  const [historyConversationId, setHistoryConversationId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMessages([]);
    setHistoryConversationId(null);
    setNextCursor(undefined);
    setHasMore(false);
    setError(null);
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading) return;
    if (!campgroundId || !conversationId) return;

    setIsLoading(true);
    setError(null);

    const endpoint =
      mode === "guest"
        ? `${API_BASE}/chat/portal/${campgroundId}/history`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/history`;

    const params = new URLSearchParams();
    params.set("conversationId", conversationId);
    params.set("limit", String(limit));
    if (nextCursor) params.set("before", nextCursor);

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      if (guestId) headers["x-guest-id"] = guestId;

      const response = await fetch(`${endpoint}?${params.toString()}`, {
        headers,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to load history");
      }

      const data = toHistoryResponse(await response.json());
      if (!data) {
        throw new Error("Invalid history response");
      }

      setMessages((prev) => (nextCursor ? [...data.messages, ...prev] : data.messages));
      setHistoryConversationId(data.conversationId);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  }, [authToken, campgroundId, conversationId, guestId, isLoading, limit, mode, nextCursor]);

  return {
    messages,
    conversationId: historyConversationId,
    hasMore,
    isLoading,
    error,
    loadMore,
    reset,
  };
}
