"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api-config";
import type { ChatAttachment, ChatMessageVisibility, UnifiedChatMessage } from "../types";

interface ActionOption {
  id: string;
  label: string;
  variant?: "default" | "destructive" | "outline";
}

interface ActionRequired {
  type: "confirmation" | "form" | "selection";
  actionId: string;
  title: string;
  description: string;
  data?: Record<string, unknown>;
  options?: ActionOption[];
}

type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

type ToolResult = {
  toolCallId: string;
  result: unknown;
};

interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  attachments?: ChatAttachment[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  actionRequired?: ActionRequired;
  createdAt: string;
  visibility?: ChatMessageVisibility;
}

interface SendMessageResponse {
  conversationId: string;
  messageId: string;
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  actionRequired?: ActionRequired;
  createdAt: string;
  visibility?: ChatMessageVisibility;
}

type SendMessagePayload = {
  message: string;
  attachments?: ChatAttachment[];
  visibility?: ChatMessageVisibility;
};

interface ExecuteActionResponse {
  success: boolean;
  message: string;
  result?: unknown;
  error?: string;
}

interface ExecuteToolResponse {
  success: boolean;
  message: string;
  result?: unknown;
  error?: string;
  prevalidateFailed?: boolean;
}

interface SubmitFeedbackResponse {
  success: boolean;
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getVisibility = (value: unknown): ChatMessageVisibility | undefined =>
  value === "internal" || value === "public" ? value : undefined;

const isToolCall = (value: unknown): value is ToolCall =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  isRecord(value.args);

const isToolResult = (value: unknown): value is ToolResult =>
  isRecord(value) && typeof value.toolCallId === "string";

const isActionRequired = (value: unknown): value is ActionRequired => {
  if (!isRecord(value)) return false;
  const type = value.type;
  if (type !== "confirmation" && type !== "form" && type !== "selection") return false;
  return (
    typeof value.actionId === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string"
  );
};

const toSendMessageResponse = (value: unknown): SendMessageResponse => {
  if (!isRecord(value)) {
    throw new Error("Invalid chat response");
  }
  const conversationId = getString(value.conversationId);
  const messageId = getString(value.messageId);
  const content = getString(value.content);
  if (!conversationId || !messageId || !content) {
    throw new Error("Invalid chat response");
  }
  return {
    conversationId,
    messageId,
    role: "assistant",
    content,
    toolCalls: Array.isArray(value.toolCalls) ? value.toolCalls.filter(isToolCall) : undefined,
    toolResults: Array.isArray(value.toolResults)
      ? value.toolResults.filter(isToolResult)
      : undefined,
    actionRequired: isActionRequired(value.actionRequired) ? value.actionRequired : undefined,
    createdAt: getString(value.createdAt) ?? new Date().toISOString(),
    visibility: getVisibility(value.visibility),
  };
};

const toExecuteActionResponse = (value: unknown): ExecuteActionResponse => {
  if (!isRecord(value)) {
    return { success: false, message: "Action failed", error: "Invalid response" };
  }
  return {
    success: typeof value.success === "boolean" ? value.success : false,
    message: getString(value.message) ?? "Action completed",
    result: value.result,
    error: getString(value.error),
  };
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

const toSubmitFeedbackResponse = (value: unknown): SubmitFeedbackResponse => {
  if (!isRecord(value)) {
    return { success: false, message: "Feedback failed" };
  }
  return {
    success: typeof value.success === "boolean" ? value.success : false,
    message: getString(value.message) ?? "Feedback saved",
  };
};

interface UseChatOptions {
  campgroundId: string;
  isGuest: boolean;
  guestId?: string;
  authToken?: string | null;
  sessionId?: string;
}

export function useChat({ campgroundId, isGuest, guestId, authToken, sessionId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    if (guestId) {
      headers["x-guest-id"] = guestId;
    }
    return headers;
  }, [authToken, guestId]);

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: SendMessagePayload): Promise<SendMessageResponse> => {
      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/message`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/message`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          conversationId,
          sessionId,
          message: payload.message,
          attachments: payload.attachments,
          visibility: payload.visibility,
          context: {},
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to send message");
      }

      const data: unknown = await res.json();
      return toSendMessageResponse(data);
    },
    onMutate: (payload) => {
      // Add user message optimistically
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        conversationId: conversationId || "",
        role: "user",
        content: payload.message,
        attachments: payload.attachments,
        visibility: payload.visibility,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);

      const assistantMessage: ChatMessage = {
        id: data.messageId,
        conversationId: data.conversationId,
        role: "assistant",
        content: data.content,
        toolCalls: data.toolCalls,
        toolResults: data.toolResults,
        actionRequired: data.actionRequired,
        createdAt: data.createdAt,
        visibility: data.visibility,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationId || "",
        role: "system",
        content: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsTyping(false);
    },
  });

  const executeActionMutation = useMutation({
    mutationFn: async ({
      actionId,
      optionId,
    }: {
      actionId: string;
      optionId: string;
    }): Promise<ExecuteActionResponse> => {
      if (!conversationId) {
        throw new Error("No active conversation");
      }

      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/action`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/action`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          conversationId,
          actionId,
          selectedOption: optionId,
          sessionId,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to execute action");
      }

      const data: unknown = await res.json();
      return toExecuteActionResponse(data);
    },
    onSuccess: (data) => {
      // Add result as assistant message
      const resultMessage: ChatMessage = {
        id: `result_${Date.now()}`,
        conversationId: conversationId || "",
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, resultMessage]);
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationId || "",
        role: "system",
        content: error instanceof Error ? error.message : "Failed to execute action",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const executeToolMutation = useMutation({
    mutationFn: async ({
      tool,
      args,
    }: {
      tool: string;
      args?: Record<string, unknown>;
    }): Promise<ExecuteToolResponse> => {
      if (!conversationId) {
        throw new Error("No active conversation");
      }

      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/tools/execute`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/tools/execute`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          conversationId,
          tool,
          args,
          sessionId,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to execute tool");
      }

      const data: unknown = await res.json();
      return toExecuteToolResponse(data);
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data, variables) => {
      const toolCallId = `tool_${Date.now()}`;
      const resultPayload = data.result ?? {
        success: data.success,
        message: data.message,
        prevalidateFailed: data.prevalidateFailed,
      };
      const assistantMessage: ChatMessage = {
        id: `tool_${Date.now()}`,
        conversationId: conversationId || "",
        role: "assistant",
        content: data.message,
        toolCalls: [
          {
            id: toolCallId,
            name: variables.tool,
            args: variables.args ?? {},
          },
        ],
        toolResults: [{ toolCallId, result: resultPayload }],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationId || "",
        role: "system",
        content: error instanceof Error ? error.message : "Failed to execute tool",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsTyping(false);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({
      messageId,
      value,
    }: {
      messageId: string;
      value: "up" | "down";
    }): Promise<SubmitFeedbackResponse> => {
      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/feedback`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/feedback`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          messageId,
          value,
          sessionId,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to submit feedback");
      }

      const data: unknown = await res.json();
      return toSubmitFeedbackResponse(data);
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationId || "",
        role: "system",
        content: error instanceof Error ? error.message : "Failed to submit feedback",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (messageId: string): Promise<SendMessageResponse> => {
      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/regenerate`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/regenerate`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          messageId,
          sessionId,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to regenerate message");
      }

      const data: unknown = await res.json();
      return toSendMessageResponse(data);
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);

      const assistantMessage: ChatMessage = {
        id: data.messageId,
        conversationId: data.conversationId,
        role: "assistant",
        content: data.content,
        toolCalls: data.toolCalls,
        toolResults: data.toolResults,
        actionRequired: data.actionRequired,
        createdAt: data.createdAt,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationId || "",
        role: "system",
        content: error instanceof Error ? error.message : "Failed to regenerate message",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsTyping(false);
    },
  });

  const sendMessage = useCallback(
    (
      message: string,
      options?: { attachments?: ChatAttachment[]; visibility?: ChatMessageVisibility },
    ) => {
      const trimmed = message.trim();
      const attachments = options?.attachments;
      if (!trimmed && (!attachments || attachments.length === 0)) return;
      sendMessageMutation.mutate({
        message: trimmed,
        attachments,
        visibility: options?.visibility,
      });
    },
    [sendMessageMutation],
  );

  const executeAction = useCallback(
    (actionId: string, optionId: string) => {
      executeActionMutation.mutate({ actionId, optionId });
    },
    [executeActionMutation],
  );

  const executeTool = useCallback(
    (tool: string, args?: Record<string, unknown>) => {
      executeToolMutation.mutate({ tool, args });
    },
    [executeToolMutation],
  );

  const submitFeedback = useCallback(
    (messageId: string, value: "up" | "down") => {
      feedbackMutation.mutate({ messageId, value });
    },
    [feedbackMutation],
  );

  const regenerateMessage = useCallback(
    (messageId: string) => {
      regenerateMutation.mutate(messageId);
    },
    [regenerateMutation],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  const replaceMessages = useCallback(
    (nextMessages: UnifiedChatMessage[]) => {
      const mapped = nextMessages.map((message) => ({
        id: message.id,
        conversationId: conversationId || "",
        role: message.role,
        content: message.content,
        attachments: message.attachments,
        toolCalls: message.toolCalls,
        toolResults: message.toolResults,
        actionRequired: message.actionRequired,
        createdAt: message.createdAt ?? new Date().toISOString(),
        visibility: message.visibility,
      }));
      setMessages(mapped);
      setIsTyping(false);
    },
    [conversationId],
  );

  const setActiveConversation = useCallback((id: string | null) => {
    setConversationId(id);
  }, []);

  return {
    messages,
    conversationId,
    isTyping,
    isSending: sendMessageMutation.isPending || regenerateMutation.isPending,
    isExecuting: executeActionMutation.isPending,
    isExecutingTool: executeToolMutation.isPending,
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
