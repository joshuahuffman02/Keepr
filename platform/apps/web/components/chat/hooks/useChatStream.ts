"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { API_BASE } from "@/lib/api-config";
import type { ChatAttachment, ChatMessageVisibility, UnifiedChatMessage } from "../types";

// Derive WebSocket base URL from API base (remove /api suffix)
const WS_BASE = API_BASE.replace(/\/api$/, "");

interface ActionOption {
  id: string;
  label: string;
  variant?: "default" | "destructive" | "outline";
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

interface ActionRequired {
  type: "confirmation" | "form" | "selection";
  actionId: string;
  title: string;
  description: string;
  summary?: string;
  data?: Record<string, unknown>;
  options?: ActionOption[];
}

interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  actionRequired?: ActionRequired;
  createdAt: string;
  isStreaming?: boolean;
  attachments?: ChatAttachment[];
  visibility?: ChatMessageVisibility;
}

interface StreamToken {
  token: string;
  isComplete: boolean;
  toolCall?: ToolCall;
  toolResult?: {
    toolCallId: string;
    result: unknown;
  };
  actionRequired?: ActionRequired;
  timestamp: string;
}

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

interface CompleteEvent {
  messageId: string;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  actionRequired?: ActionRequired;
  timestamp: string;
  visibility?: ChatMessageVisibility;
}

type SendMessageResponse = {
  status: string;
  conversationId?: string;
};

type SendMessagePayload = {
  message: string;
  attachments?: ChatAttachment[];
  visibility?: ChatMessageVisibility;
};

type RegenerateResponse = {
  conversationId: string;
  messageId: string;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  actionRequired?: ActionRequired;
  createdAt?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

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
  if (!isRecord(value)) return { status: "ok" };
  return {
    status: getString(value.status) ?? "ok",
    conversationId: getString(value.conversationId),
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

const toRegenerateResponse = (value: unknown): RegenerateResponse | null => {
  if (!isRecord(value)) return null;
  const conversationId = getString(value.conversationId);
  const messageId = getString(value.messageId);
  const content = getString(value.content);
  if (!conversationId || !messageId || content === undefined) return null;
  return {
    conversationId,
    messageId,
    content,
    toolCalls: Array.isArray(value.toolCalls) ? value.toolCalls.filter(isToolCall) : undefined,
    toolResults: Array.isArray(value.toolResults)
      ? value.toolResults.filter(isToolResult)
      : undefined,
    actionRequired: isActionRequired(value.actionRequired) ? value.actionRequired : undefined,
    createdAt: getString(value.createdAt),
  };
};

interface UseChatStreamOptions {
  campgroundId: string;
  isGuest: boolean;
  guestId?: string;
  authToken?: string | null;
  sessionId?: string;
}

export function useChatStream({
  campgroundId,
  isGuest,
  guestId,
  authToken,
  sessionId,
}: UseChatStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>("");

  const socketRef = useRef<Socket | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  // Use ref to avoid stale closure issues
  const conversationIdRef = useRef<string | null>(null);

  // Keep conversationIdRef in sync
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Connect to WebSocket - only depends on auth-related props, not conversationId
  useEffect(() => {
    if (!campgroundId) return;

    const socket = io(`${WS_BASE}/chat`, {
      transports: ["websocket"],
      auth: {
        token: authToken,
        guestId: guestId,
        campgroundId,
      },
    });

    // Event handlers
    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnected = (data: unknown) => {
      console.log("Chat connected:", data);
    };

    const handleError = (error: unknown) => {
      console.error("Chat error:", error);
      setIsConnected(false);
    };

    const handleTyping = (data: { isTyping: boolean }) => {
      setIsTyping(data.isTyping);
    };

    const handleToken = (data: StreamToken) => {
      if (data.token) {
        setStreamingContent((prev) => prev + data.token);
      }

      const toolCall = data.toolCall;
      if (toolCall) {
        // Handle tool call notification with immutable update
        setMessages((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex < 0 || !prev[lastIndex]?.isStreaming) return prev;

          return prev.map((msg, idx) =>
            idx === lastIndex ? { ...msg, toolCalls: [...(msg.toolCalls || []), toolCall] } : msg,
          );
        });
      }

      const toolResult = data.toolResult;
      if (toolResult) {
        // Handle tool result notification with immutable update
        setMessages((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex < 0 || !prev[lastIndex]?.isStreaming) return prev;

          return prev.map((msg, idx) =>
            idx === lastIndex
              ? { ...msg, toolResults: [...(msg.toolResults || []), toolResult] }
              : msg,
          );
        });
      }

      if (data.actionRequired) {
        // Handle action required with immutable update
        setMessages((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex < 0 || !prev[lastIndex]?.isStreaming) return prev;

          return prev.map((msg, idx) =>
            idx === lastIndex ? { ...msg, actionRequired: data.actionRequired } : msg,
          );
        });
      }
    };

    const handleComplete = (data: CompleteEvent) => {
      // Finalize the streaming message with immutable update
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0 || !prev[lastIndex]?.isStreaming) return prev;

        return prev.map((msg, idx) =>
          idx === lastIndex
            ? {
                ...msg,
                id: data.messageId,
                content: data.content,
                toolCalls: data.toolCalls,
                toolResults: data.toolResults,
                actionRequired: data.actionRequired,
                visibility: data.visibility,
                isStreaming: false,
              }
            : msg,
        );
      });

      setStreamingContent("");
      streamingMessageIdRef.current = null;
      setIsTyping(false);
    };

    const handleChatError = (data: { error: string }) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationIdRef.current || "",
        role: "system",
        content: data.error || "Something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsTyping(false);
      setStreamingContent("");
    };

    // Attach event listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connected", handleConnected);
    socket.on("error", handleError);
    socket.on("chat:typing", handleTyping);
    socket.on("chat:token", handleToken);
    socket.on("chat:complete", handleComplete);
    socket.on("chat:error", handleChatError);

    socketRef.current = socket;

    // Cleanup: remove all listeners and disconnect
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connected", handleConnected);
      socket.off("error", handleError);
      socket.off("chat:typing", handleTyping);
      socket.off("chat:token", handleToken);
      socket.off("chat:complete", handleComplete);
      socket.off("chat:error", handleChatError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [campgroundId, authToken, guestId]); // Removed conversationId from dependencies

  // Join conversation room when conversationId changes (separate effect)
  useEffect(() => {
    if (conversationId && socketRef.current?.connected) {
      socketRef.current.emit("conversation:join", { conversationId });
    }
  }, [conversationId]);

  // Update streaming message content with immutable update
  useEffect(() => {
    if (streamingContent && streamingMessageIdRef.current) {
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0 || !prev[lastIndex]?.isStreaming) return prev;

        return prev.map((msg, idx) =>
          idx === lastIndex ? { ...msg, content: streamingContent } : msg,
        );
      });
    }
  }, [streamingContent]);

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
      // Use streaming endpoint
      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/message/stream`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/message/stream`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
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
      const currentConversationId = conversationIdRef.current;

      // Add user message optimistically
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        conversationId: currentConversationId || "",
        role: "user",
        content: payload.message,
        attachments: payload.attachments,
        visibility: payload.visibility,
        createdAt: new Date().toISOString(),
      };

      // Add placeholder streaming message
      const streamingId = `streaming_${Date.now()}`;
      streamingMessageIdRef.current = streamingId;
      const streamingMessage: ChatMessage = {
        id: streamingId,
        conversationId: currentConversationId || "",
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, streamingMessage]);
      setIsTyping(true);
      setStreamingContent("");
    },
    onSuccess: (data) => {
      // If the response includes a conversationId, update our state
      if (data.conversationId && !conversationIdRef.current) {
        setConversationId(data.conversationId);
      }
    },
    onError: (error) => {
      // Remove streaming message and add error with immutable update
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isStreaming);
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          conversationId: conversationIdRef.current || "",
          role: "system",
          content:
            error instanceof Error ? error.message : "Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        };
        return [...filtered, errorMessage];
      });
      setIsTyping(false);
      setStreamingContent("");
      streamingMessageIdRef.current = null;
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
      const currentConversationId = conversationIdRef.current;
      if (!currentConversationId) {
        throw new Error("No active conversation");
      }

      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/action`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/action`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          conversationId: currentConversationId,
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
      const resultMessage: ChatMessage = {
        id: `result_${Date.now()}`,
        conversationId: conversationIdRef.current || "",
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, resultMessage]);
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationIdRef.current || "",
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
      const currentConversationId = conversationIdRef.current;
      if (!currentConversationId) {
        throw new Error("No active conversation");
      }

      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/tools/execute`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/tools/execute`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          conversationId: currentConversationId,
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
      const resultMessage: ChatMessage = {
        id: `tool_${Date.now()}`,
        conversationId: conversationIdRef.current || "",
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
      setMessages((prev) => [...prev, resultMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationIdRef.current || "",
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
    }): Promise<void> => {
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
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationIdRef.current || "",
        role: "system",
        content: error instanceof Error ? error.message : "Failed to submit feedback",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (messageId: string): Promise<RegenerateResponse> => {
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

      const data = toRegenerateResponse(await res.json());
      if (!data) {
        throw new Error("Invalid regenerate response");
      }

      return data;
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      if (!conversationIdRef.current) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: ChatMessage = {
        id: data.messageId,
        conversationId: data.conversationId,
        role: "assistant",
        content: data.content,
        toolCalls: data.toolCalls,
        toolResults: data.toolResults,
        actionRequired: data.actionRequired,
        createdAt: data.createdAt ?? new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        conversationId: conversationIdRef.current || "",
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
    setStreamingContent("");
  }, []);

  const replaceMessages = useCallback((nextMessages: UnifiedChatMessage[]) => {
    streamingMessageIdRef.current = null;
    const mapped = nextMessages.map((message) => ({
      id: message.id,
      conversationId: conversationIdRef.current || "",
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
    setStreamingContent("");
  }, []);

  const setActiveConversation = useCallback((id: string | null) => {
    setConversationId(id);
  }, []);

  return {
    messages,
    conversationId,
    isTyping,
    isConnected,
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
