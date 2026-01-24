"use client";

import { useCallback, useState } from "react";
import { API_BASE } from "@/lib/api-config";
import type { ChatConversationSummary } from "../types";

type ConversationMode = "guest" | "staff";

interface UseChatConversationsOptions {
  mode: ConversationMode;
  campgroundId?: string;
  authToken?: string | null;
  guestId?: string;
  limit?: number;
  query?: string;
  since?: string;
}

interface ConversationsResponse {
  conversations: ChatConversationSummary[];
  hasMore: boolean;
  nextCursor?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isConversationSummary = (value: unknown): value is ChatConversationSummary =>
  isRecord(value) &&
  typeof value.id === "string" &&
  (value.title === undefined || typeof value.title === "string" || value.title === null) &&
  (value.updatedAt === undefined || typeof value.updatedAt === "string") &&
  (value.lastMessagePreview === undefined || typeof value.lastMessagePreview === "string") &&
  (value.lastMessageAt === undefined || typeof value.lastMessageAt === "string");

const toConversationsResponse = (value: unknown): ConversationsResponse | null => {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.conversations)) return null;
  const conversations = value.conversations.filter(isConversationSummary);
  const hasMore = typeof value.hasMore === "boolean" ? value.hasMore : false;
  const nextCursor = typeof value.nextCursor === "string" ? value.nextCursor : undefined;
  return { conversations, hasMore, nextCursor };
};

export function useChatConversations({
  mode,
  campgroundId,
  authToken,
  guestId,
  limit = 12,
  query,
  since,
}: UseChatConversationsOptions) {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setConversations([]);
    setNextCursor(undefined);
    setHasMore(false);
    setError(null);
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading) return;
    if (!campgroundId) return;

    setIsLoading(true);
    setError(null);

    const endpoint =
      mode === "guest"
        ? `${API_BASE}/chat/portal/${campgroundId}/conversations`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/conversations`;

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (nextCursor) params.set("before", nextCursor);
    if (query) params.set("query", query);
    if (since) params.set("since", since);

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      if (guestId) headers["x-guest-id"] = guestId;

      const response = await fetch(`${endpoint}?${params.toString()}`, { headers });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to load conversations");
      }

      const data = toConversationsResponse(await response.json());
      if (!data) {
        throw new Error("Invalid conversations response");
      }

      setConversations((prev) =>
        nextCursor ? [...prev, ...data.conversations] : data.conversations,
      );
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, [authToken, campgroundId, guestId, isLoading, limit, mode, nextCursor, query, since]);

  return {
    conversations,
    hasMore,
    isLoading,
    error,
    loadMore,
    reset,
  };
}
