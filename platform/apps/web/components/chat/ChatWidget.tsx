"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, MessageCircle, Minimize2, Maximize2, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { useChat } from "./hooks/useChat";
import { useChatStream } from "./hooks/useChatStream";

interface ChatWidgetProps {
  campgroundId: string;
  isGuest?: boolean;
  guestId?: string;
  authToken?: string | null;
  initialMessage?: string;
  position?: "bottom-right" | "bottom-left";
  className?: string;
  /** Enable WebSocket streaming for real-time responses */
  useStreaming?: boolean;
}

const QUICK_ACTIONS_GUEST = [
  "Check availability for this weekend",
  "Show my reservations",
  "What time is check-in?",
  "Get a quote for a lakefront site",
];

const QUICK_ACTIONS_STAFF = [
  "Who's checking in today?",
  "Show today's departures",
  "What's our occupancy this weekend?",
  "Search reservations",
];

export function ChatWidget({
  campgroundId,
  isGuest = false,
  guestId,
  authToken,
  initialMessage,
  position = "bottom-right",
  className,
  useStreaming = false,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use streaming hook if enabled, otherwise use regular hook
  const streamingChat = useChatStream({
    campgroundId,
    isGuest,
    guestId,
    authToken,
  });

  const regularChat = useChat({
    campgroundId,
    isGuest,
    guestId,
    authToken,
  });

  // Select which chat implementation to use
  const chat = useStreaming ? streamingChat : regularChat;
  const { messages, isTyping, isSending, sendMessage, executeAction } = chat;
  const isConnected = useStreaming ? (streamingChat.isConnected) : true;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Send initial message when opened (if provided)
  useEffect(() => {
    if (isOpen && initialMessage && messages.length === 0) {
      sendMessage(initialMessage);
    }
  }, [isOpen, initialMessage, messages.length, sendMessage]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: string) => {
    sendMessage(action);
  };

  const handleActionSelect = (actionId: string, optionId: string) => {
    executeAction(actionId, optionId);
  };

  const quickActions = isGuest ? QUICK_ACTIONS_GUEST : QUICK_ACTIONS_STAFF;
  const accentColor = isGuest ? "emerald" : "blue";

  // Closed state - floating button
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed w-14 h-14 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center z-[9999]",
          isGuest
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-blue-600 text-white hover:bg-blue-700",
          position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6",
          className
        )}
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div
        className={cn(
          "fixed w-72 rounded-2xl shadow-xl overflow-hidden z-50 border border-border",
          position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6"
        )}
      >
        <div
          className={cn(
            "p-3 flex items-center justify-between cursor-pointer",
            isGuest ? "bg-emerald-600" : "bg-blue-600"
          )}
          onClick={() => setIsMinimized(false)}
        >
          <div className="flex items-center gap-2 text-white">
            <MessageCircle className="w-5 h-5" />
            <span className="font-medium">Keepr AI</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed w-96 h-[600px] bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-border",
        position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "p-4 flex items-center justify-between",
          isGuest ? "bg-emerald-600" : "bg-blue-600"
        )}
      >
        <div className="flex items-center gap-3 text-white">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold flex items-center gap-2">
              Keepr AI
              {useStreaming && (
                <span title={isConnected ? "Connected" : "Disconnected"}>
                  {isConnected ? (
                    <Wifi className="w-3 h-3 text-white/80" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-white/60" />
                  )}
                </span>
              )}
            </div>
            <div className="text-xs text-white/80">
              {isGuest ? "Your camping assistant" : "Staff assistant"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div
              className={cn(
                "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4",
                isGuest ? "bg-emerald-100" : "bg-blue-100"
              )}
            >
              <MessageCircle
                className={cn("w-8 h-8", isGuest ? "text-emerald-600" : "text-blue-600")}
              />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {isGuest ? "Welcome to Keepr!" : "How can I help?"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {isGuest
                ? "I can help you find sites, make reservations, and answer questions."
                : "I can help with reservations, check-ins, reports, and more."}
            </p>

            {/* Quick actions */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => handleQuickAction(action)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                      isGuest
                        ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        : "border-blue-200 text-blue-700 hover:bg-blue-50"
                    )}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                {...msg}
                isGuest={isGuest}
                onActionSelect={handleActionSelect}
              />
            ))}
          </>
        )}

        {isTyping && (
          <ChatMessage
            id="typing"
            role="assistant"
            content=""
            createdAt=""
            isLoading={true}
            isGuest={isGuest}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isGuest ? "Ask about availability, reservations..." : "Ask about arrivals, reservations, reports..."}
            className={cn(
              "flex-1 px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 text-sm",
              isGuest
                ? "focus:ring-emerald-500/20 focus:border-emerald-500"
                : "focus:ring-blue-500/20 focus:border-blue-500"
            )}
            disabled={isSending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className={cn(
              "p-2.5 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              isGuest
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
