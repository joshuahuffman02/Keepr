"use client";

import type { ReactNode, RefObject } from "react";
import { ChatMessage } from "./ChatMessage";
import type { ChatAccent, UnifiedChatMessage } from "./types";

type ChatMessageListProps = {
  messages: UnifiedChatMessage[];
  isTyping?: boolean;
  accent?: ChatAccent;
  onActionSelect?: (actionId: string, optionId: string) => void;
  onQuickReply?: (prompt: string) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, value: "up" | "down") => void;
  feedbackById?: Record<string, "up" | "down">;
  onTicketAction?: () => void;
  ticketHref?: string;
  emptyState?: ReactNode;
  bottomRef?: RefObject<HTMLDivElement>;
};

export function ChatMessageList({
  messages,
  isTyping = false,
  accent = "staff",
  onActionSelect,
  onQuickReply,
  onEditMessage,
  onRegenerate,
  onFeedback,
  feedbackById,
  onTicketAction,
  ticketHref,
  emptyState,
  bottomRef,
}: ChatMessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && emptyState}
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          accent={accent}
          onActionSelect={onActionSelect}
          onQuickReply={onQuickReply}
          onEditMessage={onEditMessage}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
          feedback={feedbackById?.[message.id]}
          onTicketAction={onTicketAction}
          ticketHref={ticketHref}
          {...message}
        />
      ))}
      {isTyping && (
        <ChatMessage
          id="typing"
          role="assistant"
          content=""
          isLoading={true}
          accent={accent}
        />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
