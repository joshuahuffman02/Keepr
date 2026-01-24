"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api-config";
import type {
  ChatActionRequired,
  ChatAttachment,
  ChatMessageVisibility,
  ChatMessagePart,
  ChatRecommendation,
  ChatToolCall,
  ChatToolResult,
  HelpArticleLink,
  UnifiedChatMessage,
} from "../types";

type ChatStreamMode = "public" | "guest" | "staff" | "support";

export type ChatStreamMeta = {
  conversationId?: string;
  messageId?: string;
  content?: string;
  parts?: ChatMessagePart[];
  toolCalls?: ChatToolCall[];
  toolResults?: ChatToolResult[];
  actionRequired?: ChatActionRequired;
  recommendations?: ChatRecommendation[];
  clarifyingQuestions?: string[];
  helpArticles?: HelpArticleLink[];
  showTicketPrompt?: boolean;
  action?: string;
  bookingDetails?: Record<string, unknown>;
  visibility?: ChatMessageVisibility;
};

type ExecuteToolResponse = {
  success: boolean;
  message: string;
  result?: unknown;
  error?: string;
  prevalidateFailed?: boolean;
};

interface UseChatStreamSseOptions {
  mode: ChatStreamMode;
  campgroundId?: string;
  authToken?: string | null;
  guestId?: string;
  sessionId?: string;
  context?: string;
  initialMessages?: UnifiedChatMessage[];
  onMeta?: (meta: ChatStreamMeta) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getVisibility = (value: unknown): ChatMessageVisibility | undefined =>
  value === "internal" || value === "public" ? value : undefined;

const isChatToolCall = (value: unknown): value is ChatToolCall =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  isRecord(value.args);

const isChatToolResult = (value: unknown): value is ChatToolResult =>
  isRecord(value) && typeof value.toolCallId === "string" && "result" in value;

const isChatAttachment = (value: unknown): value is ChatAttachment =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.contentType === "string" &&
  typeof value.size === "number";

const isChatMessagePart = (value: unknown): value is ChatMessagePart => {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "text") return typeof value.text === "string";
  if (value.type === "tool") {
    return typeof value.name === "string" && typeof value.callId === "string";
  }
  if (value.type === "file") return isChatAttachment(value.file);
  if (value.type === "card") return true;
  return false;
};

const isChatActionRequired = (value: unknown): value is ChatActionRequired =>
  isRecord(value) &&
  (value.type === "confirmation" || value.type === "form" || value.type === "selection") &&
  typeof value.actionId === "string" &&
  typeof value.title === "string" &&
  typeof value.description === "string";

const isChatRecommendation = (value: unknown): value is ChatRecommendation =>
  isRecord(value) &&
  typeof value.siteClassName === "string" &&
  Array.isArray(value.reasons) &&
  value.reasons.every((entry) => typeof entry === "string");

const isHelpArticleLink = (value: unknown): value is HelpArticleLink =>
  isRecord(value) && typeof value.title === "string" && typeof value.url === "string";

type ChatMessageResponse = {
  conversationId: string;
  messageId: string;
  content: string;
  parts?: ChatMessagePart[];
  toolCalls?: ChatToolCall[];
  toolResults?: ChatToolResult[];
  actionRequired?: ChatActionRequired;
  createdAt?: string;
  visibility?: ChatMessageVisibility;
};

const toChatMessageResponse = (value: unknown): ChatMessageResponse | null => {
  if (!isRecord(value)) return null;
  const conversationId = getString(value.conversationId);
  const messageId = getString(value.messageId);
  const content = getString(value.content);
  if (!conversationId || !messageId || content === undefined) return null;

  return {
    conversationId,
    messageId,
    content,
    parts: Array.isArray(value.parts) ? value.parts.filter(isChatMessagePart) : undefined,
    toolCalls: Array.isArray(value.toolCalls) ? value.toolCalls.filter(isChatToolCall) : undefined,
    toolResults: Array.isArray(value.toolResults)
      ? value.toolResults.filter(isChatToolResult)
      : undefined,
    actionRequired: isChatActionRequired(value.actionRequired) ? value.actionRequired : undefined,
    createdAt: getString(value.createdAt),
    visibility: getVisibility(value.visibility),
  };
};

const toChatStreamMeta = (value: unknown): ChatStreamMeta | null => {
  if (!isRecord(value)) return null;
  const meta: ChatStreamMeta = {};

  if (typeof value.conversationId === "string") meta.conversationId = value.conversationId;
  if (typeof value.messageId === "string") meta.messageId = value.messageId;
  if (typeof value.content === "string") meta.content = value.content;
  if (typeof value.action === "string") meta.action = value.action;
  if (isRecord(value.bookingDetails)) meta.bookingDetails = value.bookingDetails;
  const visibility = getVisibility(value.visibility);
  if (visibility) meta.visibility = visibility;

  if (Array.isArray(value.parts)) {
    const parts = value.parts.filter(isChatMessagePart);
    if (parts.length > 0) meta.parts = parts;
  }

  if (Array.isArray(value.toolCalls)) {
    const toolCalls = value.toolCalls.filter(isChatToolCall);
    if (toolCalls.length > 0) meta.toolCalls = toolCalls;
  }

  if (Array.isArray(value.toolResults)) {
    const toolResults = value.toolResults.filter(isChatToolResult);
    if (toolResults.length > 0) meta.toolResults = toolResults;
  }

  if (isChatActionRequired(value.actionRequired)) {
    meta.actionRequired = value.actionRequired;
  }

  if (Array.isArray(value.recommendations)) {
    const recommendations = value.recommendations.filter(isChatRecommendation);
    if (recommendations.length > 0) meta.recommendations = recommendations;
  }

  if (Array.isArray(value.clarifyingQuestions)) {
    const questions = value.clarifyingQuestions.filter((entry) => typeof entry === "string");
    if (questions.length > 0) meta.clarifyingQuestions = questions;
  }

  if (Array.isArray(value.helpArticles)) {
    const helpArticles = value.helpArticles.filter(isHelpArticleLink);
    if (helpArticles.length > 0) meta.helpArticles = helpArticles;
  }

  if (typeof value.showTicketPrompt === "boolean") {
    meta.showTicketPrompt = value.showTicketPrompt;
  }

  return meta;
};

const toExecuteToolResponse = (value: unknown): ExecuteToolResponse => {
  if (!isRecord(value)) {
    return { success: false, message: "Tool failed", error: "Invalid response" };
  }
  return {
    success: typeof value.success === "boolean" ? value.success : false,
    message: getString(value.message) ?? "Tool completed",
    result: value.result,
    error: getString(value.error),
    prevalidateFailed: value.prevalidateFailed === true,
  };
};

const toHistory = (messages: UnifiedChatMessage[]) =>
  messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

export function useChatStreamSse({
  mode,
  campgroundId,
  authToken,
  guestId,
  sessionId,
  context,
  initialMessages = [],
  onMeta,
}: UseChatStreamSseOptions) {
  const [messages, setMessages] = useState<UnifiedChatMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const messagesRef = useRef(messages);
  const streamingMessageIdRef = useRef<string | null>(null);
  const hasStreamedTextRef = useRef(false);
  const hasMetaContentRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const updateStreamingMessage = useCallback(
    (updater: (message: UnifiedChatMessage) => UnifiedChatMessage) => {
      const streamingId = streamingMessageIdRef.current;
      if (!streamingId) return;
      setMessages((prev) => prev.map((msg) => (msg.id === streamingId ? updater(msg) : msg)));
    },
    [],
  );

  const ensureStreamingMessage = useCallback((meta?: ChatStreamMeta) => {
    if (streamingMessageIdRef.current) return;
    hasStreamedTextRef.current = false;
    hasMetaContentRef.current = false;
    const id = meta?.messageId ?? `assistant_${Date.now()}`;
    streamingMessageIdRef.current = id;
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: "assistant",
        content: meta?.content ?? "",
        parts: meta?.parts,
        toolCalls: meta?.toolCalls,
        toolResults: meta?.toolResults,
        actionRequired: meta?.actionRequired,
        recommendations: meta?.recommendations,
        clarifyingQuestions: meta?.clarifyingQuestions,
        helpArticles: meta?.helpArticles,
        showTicketPrompt: meta?.showTicketPrompt,
        visibility: meta?.visibility,
      },
    ]);
  }, []);

  const handleMeta = useCallback(
    (meta: ChatStreamMeta) => {
      if (meta.conversationId) {
        setConversationId(meta.conversationId);
      }
      ensureStreamingMessage(meta);
      if (
        typeof meta.content === "string" &&
        meta.content.length > 0 &&
        !hasStreamedTextRef.current
      ) {
        hasMetaContentRef.current = true;
      }
      updateStreamingMessage((message) => ({
        ...message,
        content:
          typeof meta.content === "string" && meta.content.length > 0 && !hasStreamedTextRef.current
            ? meta.content
            : message.content,
        toolCalls: meta.toolCalls ?? message.toolCalls,
        toolResults: meta.toolResults ?? message.toolResults,
        actionRequired: meta.actionRequired ?? message.actionRequired,
        recommendations: meta.recommendations ?? message.recommendations,
        clarifyingQuestions: meta.clarifyingQuestions ?? message.clarifyingQuestions,
        helpArticles: meta.helpArticles ?? message.helpArticles,
        showTicketPrompt: meta.showTicketPrompt ?? message.showTicketPrompt,
        visibility: meta.visibility ?? message.visibility,
        parts: meta.parts ?? message.parts,
      }));
      onMeta?.(meta);
    },
    [ensureStreamingMessage, onMeta, updateStreamingMessage],
  );

  const handleText = useCallback(
    (value: string) => {
      if (hasMetaContentRef.current) return;
      ensureStreamingMessage();
      hasStreamedTextRef.current = true;
      updateStreamingMessage((message) => ({
        ...message,
        content: `${message.content}${value}`,
      }));
    },
    [ensureStreamingMessage, updateStreamingMessage],
  );

  const sendMessage = useCallback(
    async (
      message: string,
      options?: { attachments?: ChatAttachment[]; visibility?: ChatMessageVisibility },
    ) => {
      const trimmed = message.trim();
      const attachments = options?.attachments;
      if ((!trimmed && (!attachments || attachments.length === 0)) || isSending) return;
      if ((mode === "staff" || mode === "guest" || mode === "public") && !campgroundId) {
        return;
      }

      const userMessage: UnifiedChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: trimmed,
        attachments,
        createdAt: new Date().toISOString(),
        visibility: options?.visibility,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);
      setIsTyping(true);
      setIsConnected(true);

      const history = toHistory(messagesRef.current);
      const body: Record<string, unknown> = {
        mode,
        campgroundId,
        conversationId,
        sessionId,
        context,
        message: trimmed,
        attachments,
        visibility: options?.visibility,
      };
      if (mode === "public" || mode === "support") {
        body.history = history;
      }

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        if (guestId) {
          headers["x-guest-id"] = guestId;
        }

        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok || !response.body) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to stream response");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r/g, "");

          while (buffer.includes("\n\n")) {
            const [rawEvent, rest] = buffer.split("\n\n", 2);
            buffer = rest ?? "";
            const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            const payloadText = dataLine.replace(/^data:\s*/, "").trim();
            if (!payloadText) continue;

            let payload: unknown;
            try {
              payload = JSON.parse(payloadText);
            } catch {
              continue;
            }

            if (!isRecord(payload)) continue;
            const type = payload.type;
            if (type === "text" && typeof payload.value === "string") {
              handleText(payload.value);
            }
            if (type === "data" && isRecord(payload.data)) {
              const meta = toChatStreamMeta(payload.data);
              if (meta) {
                handleMeta(meta);
              }
            }
            if (type === "done") {
              setIsTyping(false);
              setIsSending(false);
              streamingMessageIdRef.current = null;
              hasStreamedTextRef.current = false;
              hasMetaContentRef.current = false;
            }
          }
        }

        setIsTyping(false);
        setIsSending(false);
        streamingMessageIdRef.current = null;
        hasStreamedTextRef.current = false;
        hasMetaContentRef.current = false;
      } catch (error) {
        setIsConnected(false);
        setIsTyping(false);
        setIsSending(false);
        streamingMessageIdRef.current = null;
        hasStreamedTextRef.current = false;
        hasMetaContentRef.current = false;
        const errorMessage: UnifiedChatMessage = {
          id: `error_${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Something went wrong.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [
      authToken,
      campgroundId,
      context,
      conversationId,
      guestId,
      handleMeta,
      handleText,
      isSending,
      mode,
      sessionId,
    ],
  );

  const executeAction = useCallback(
    async (actionId: string, optionId: string) => {
      if (!conversationId) return;
      if (mode !== "staff" && mode !== "guest") return;
      if (!campgroundId) return;

      setIsExecuting(true);
      try {
        const endpoint =
          mode === "guest"
            ? `${API_BASE}/chat/portal/${campgroundId}/action`
            : `${API_BASE}/chat/campgrounds/${campgroundId}/action`;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        if (guestId) headers["x-guest-id"] = guestId;

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            conversationId,
            actionId,
            selectedOption: optionId,
            sessionId,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to execute action");
        }

        const result = await response.json();
        const resultMessageText =
          isRecord(result) && typeof result.message === "string"
            ? result.message
            : "Action completed.";
        const resultMessage: UnifiedChatMessage = {
          id: `result_${Date.now()}`,
          role: "assistant",
          content: resultMessageText,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, resultMessage]);
      } catch (error) {
        const errorMessage: UnifiedChatMessage = {
          id: `error_${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Failed to execute action",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsExecuting(false);
      }
    },
    [authToken, campgroundId, conversationId, guestId, mode],
  );

  const executeTool = useCallback(
    async (tool: string, args?: Record<string, unknown>) => {
      if (!conversationId) return;
      if (mode !== "staff" && mode !== "guest") return;
      if (!campgroundId) return;

      setIsExecutingTool(true);
      try {
        const endpoint =
          mode === "guest"
            ? `${API_BASE}/chat/portal/${campgroundId}/tools/execute`
            : `${API_BASE}/chat/campgrounds/${campgroundId}/tools/execute`;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        if (guestId) headers["x-guest-id"] = guestId;

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            conversationId,
            tool,
            args,
            sessionId,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to execute tool");
        }

        const result = toExecuteToolResponse(await response.json());
        const toolCallId = `tool_${Date.now()}`;
        const resultPayload = result.result ?? {
          success: result.success,
          message: result.message,
          prevalidateFailed: result.prevalidateFailed,
        };
        const resultMessage: UnifiedChatMessage = {
          id: `tool_${Date.now()}`,
          role: "assistant",
          content: result.message,
          toolCalls: [{ id: toolCallId, name: tool, args: args ?? {} }],
          toolResults: [{ toolCallId, result: resultPayload }],
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, resultMessage]);
      } catch (error) {
        const errorMessage: UnifiedChatMessage = {
          id: `error_${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Failed to execute tool",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsExecutingTool(false);
      }
    },
    [authToken, campgroundId, conversationId, guestId, mode, sessionId],
  );

  const submitFeedback = useCallback(
    async (messageId: string, value: "up" | "down") => {
      if (mode !== "staff" && mode !== "guest") return;
      if (!campgroundId) return;

      const endpoint =
        mode === "guest"
          ? `${API_BASE}/chat/portal/${campgroundId}/feedback`
          : `${API_BASE}/chat/campgrounds/${campgroundId}/feedback`;

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        if (guestId) headers["x-guest-id"] = guestId;

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ messageId, value, sessionId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to submit feedback");
        }
      } catch (error) {
        const errorMessage: UnifiedChatMessage = {
          id: `error_${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Failed to submit feedback",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [authToken, campgroundId, guestId, mode, sessionId],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (mode !== "staff" && mode !== "guest") return;
      if (!campgroundId) return;
      if (isSending) return;

      setIsSending(true);
      setIsTyping(true);

      const endpoint =
        mode === "guest"
          ? `${API_BASE}/chat/portal/${campgroundId}/regenerate`
          : `${API_BASE}/chat/campgrounds/${campgroundId}/regenerate`;

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        if (guestId) headers["x-guest-id"] = guestId;

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ messageId, sessionId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to regenerate message");
        }

        const parsed = toChatMessageResponse(await response.json());
        if (!parsed) {
          throw new Error("Invalid regenerate response");
        }

        setConversationId(parsed.conversationId);

        const assistantMessage: UnifiedChatMessage = {
          id: parsed.messageId,
          role: "assistant",
          content: parsed.content,
          parts: parsed.parts,
          toolCalls: parsed.toolCalls,
          toolResults: parsed.toolResults,
          actionRequired: parsed.actionRequired,
          createdAt: parsed.createdAt,
          visibility: parsed.visibility,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        const errorMessage: UnifiedChatMessage = {
          id: `error_${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Failed to regenerate message",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsSending(false);
        setIsTyping(false);
      }
    },
    [authToken, campgroundId, guestId, isSending, mode, sessionId],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  const replaceMessages = useCallback((nextMessages: UnifiedChatMessage[]) => {
    streamingMessageIdRef.current = null;
    setMessages(nextMessages);
    setIsTyping(false);
    setIsSending(false);
  }, []);

  const setActiveConversation = useCallback((id: string | null) => {
    streamingMessageIdRef.current = null;
    setConversationId(id);
  }, []);

  return {
    messages,
    conversationId,
    isTyping,
    isSending,
    isExecuting,
    isExecutingTool,
    isConnected,
    sendMessage,
    executeAction,
    executeTool,
    submitFeedback,
    regenerateMessage,
    clearMessages,
    replaceMessages,
    setActiveConversation,
  };
}
