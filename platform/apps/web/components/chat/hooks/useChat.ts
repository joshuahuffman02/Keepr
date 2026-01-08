"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

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
}

interface SendMessageResponse {
  conversationId: string;
  messageId: string;
  role: "assistant";
  content: string;
  toolCalls?: any[];
  toolResults?: any[];
  actionRequired?: any;
  createdAt: string;
}

interface ExecuteActionResponse {
  success: boolean;
  message: string;
  result?: any;
  error?: string;
}

interface UseChatOptions {
  campgroundId: string;
  isGuest: boolean;
  guestId?: string;
  authToken?: string | null;
}

export function useChat({ campgroundId, isGuest, guestId, authToken }: UseChatOptions) {
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
    mutationFn: async (message: string): Promise<SendMessageResponse> => {
      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/message`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/message`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          conversationId,
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
      // Add user message optimistically
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        conversationId: conversationId || "",
        role: "user",
        content: message,
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
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to execute action");
      }

      return res.json();
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
  }, []);

  return {
    messages,
    conversationId,
    isTyping,
    isSending: sendMessageMutation.isPending,
    isExecuting: executeActionMutation.isPending,
    sendMessage,
    executeAction,
    clearMessages,
  };
}
