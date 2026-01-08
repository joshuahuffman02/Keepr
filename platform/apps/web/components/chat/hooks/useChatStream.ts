"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE || "http://localhost:4000";

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
  data?: Record<string, any>;
  options?: ActionOption[];
}

interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolCalls?: any[];
  toolResults?: any[];
  actionRequired?: ActionRequired;
  createdAt: string;
  isStreaming?: boolean;
}

interface StreamToken {
  token: string;
  isComplete: boolean;
  toolCall?: {
    id: string;
    name: string;
    args: Record<string, any>;
  };
  toolResult?: {
    toolCallId: string;
    result: any;
  };
  actionRequired?: ActionRequired;
  timestamp: string;
}

interface ExecuteActionResponse {
  success: boolean;
  message: string;
  result?: any;
  error?: string;
}

interface UseChatStreamOptions {
  campgroundId: string;
  isGuest: boolean;
  guestId?: string;
  authToken?: string | null;
}

export function useChatStream({ campgroundId, isGuest, guestId, authToken }: UseChatStreamOptions) {
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

    const handleConnected = (data: any) => {
      console.log("Chat connected:", data);
    };

    const handleError = (error: any) => {
      console.error("Chat error:", error);
      setIsConnected(false);
    };

    const handleTyping = (data: { isTyping: boolean }) => {
      setIsTyping(data.isTyping);
    };

    const handleToken = (data: StreamToken) => {
      if (data.token) {
        setStreamingContent(prev => prev + data.token);
      }

      if (data.toolCall) {
        // Handle tool call notification with immutable update
        setMessages(prev => {
          const lastIndex = prev.length - 1;
          if (lastIndex < 0 || !prev[lastIndex]?.isStreaming) return prev;

          return prev.map((msg, idx) =>
            idx === lastIndex
              ? { ...msg, toolCalls: [...(msg.toolCalls || []), data.toolCall] }
              : msg
          );
        });
      }

      if (data.toolResult) {
        // Handle tool result notification with immutable update
        setMessages(prev => {
          const lastIndex = prev.length - 1;
          if (lastIndex < 0 || !prev[lastIndex]?.isStreaming) return prev;

          return prev.map((msg, idx) =>
            idx === lastIndex
              ? { ...msg, toolResults: [...(msg.toolResults || []), data.toolResult] }
              : msg
          );
        });
      }

      if (data.actionRequired) {
        // Handle action required with immutable update
        setMessages(prev => {
          const lastIndex = prev.length - 1;
          if (lastIndex < 0 || !prev[lastIndex]?.isStreaming) return prev;

          return prev.map((msg, idx) =>
            idx === lastIndex
              ? { ...msg, actionRequired: data.actionRequired }
              : msg
          );
        });
      }
    };

    const handleComplete = (data: {
      messageId: string;
      content: string;
      toolCalls?: any[];
      toolResults?: any[];
      actionRequired?: ActionRequired;
      timestamp: string;
    }) => {
      // Finalize the streaming message with immutable update
      setMessages(prev => {
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
                isStreaming: false,
              }
            : msg
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
      setMessages(prev => [...prev, errorMessage]);
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
      setMessages(prev => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0 || !prev[lastIndex]?.isStreaming) return prev;

        return prev.map((msg, idx) =>
          idx === lastIndex
            ? { ...msg, content: streamingContent }
            : msg
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
    mutationFn: async (message: string): Promise<{ status: string; conversationId?: string }> => {
      // Use streaming endpoint
      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/message/stream`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/message/stream`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          message,
          context: {},
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to send message");
      }

      return res.json();
    },
    onMutate: (message) => {
      const currentConversationId = conversationIdRef.current;

      // Add user message optimistically
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        conversationId: currentConversationId || "",
        role: "user",
        content: message,
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
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isStreaming);
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          conversationId: conversationIdRef.current || "",
          role: "system",
          content: error instanceof Error ? error.message : "Something went wrong. Please try again.",
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
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to execute action");
      }

      return res.json();
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

  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return;
      sendMessageMutation.mutate(message);
    },
    [sendMessageMutation]
  );

  const executeAction = useCallback(
    (actionId: string, optionId: string) => {
      executeActionMutation.mutate({ actionId, optionId });
    },
    [executeActionMutation]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setStreamingContent("");
  }, []);

  const setActiveConversation = useCallback((id: string) => {
    setConversationId(id);
  }, []);

  return {
    messages,
    conversationId,
    isTyping,
    isConnected,
    isSending: sendMessageMutation.isPending,
    isExecuting: executeActionMutation.isPending,
    sendMessage,
    executeAction,
    clearMessages,
    setActiveConversation,
  };
}
