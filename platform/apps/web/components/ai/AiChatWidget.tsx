"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  ChatMessageList,
  ChatShell,
  PROMPTS,
  SuggestedPrompts,
  useChatStreamSse,
} from "@/components/chat";
import type { ChatAccent, ChatStreamMeta } from "@/components/chat";

interface AiChatWidgetProps {
  campgroundId: string;
  campgroundName?: string;
}

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

export function AiChatWidget({ campgroundId, campgroundName }: AiChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sessionId] = useState(() => generateSessionId());
  const [hasConsented, setHasConsented] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleMeta = useCallback(
    (meta: ChatStreamMeta) => {
      if (meta.action !== "book" || !meta.bookingDetails) return;
      const bookingDetails = meta.bookingDetails;
      if (!isRecord(bookingDetails)) return;

      const params = new URLSearchParams(window.location.search);

      const dates = isRecord(bookingDetails.dates) ? bookingDetails.dates : null;
      const arrival = dates ? getString(dates.arrival) : undefined;
      const departure = dates ? getString(dates.departure) : undefined;
      if (arrival) params.set("arrivalDate", arrival);
      if (departure) params.set("departureDate", departure);

      const partySize = isRecord(bookingDetails.partySize) ? bookingDetails.partySize : null;
      const adults = partySize ? getNumber(partySize.adults) : undefined;
      const children = partySize ? getNumber(partySize.children) : undefined;
      if (adults !== undefined) params.set("adults", String(adults));
      if (children !== undefined) params.set("children", String(children));
      if (adults !== undefined || children !== undefined) {
        params.set("guests", String((adults ?? 0) + (children ?? 0)));
      }

      const rigInfo = isRecord(bookingDetails.rigInfo) ? bookingDetails.rigInfo : null;
      const rigLength = rigInfo ? getNumber(rigInfo.length) : undefined;
      const rigType = rigInfo ? getString(rigInfo.type) : undefined;
      if (rigLength !== undefined) params.set("rvLength", String(rigLength));
      if (rigType) params.set("rvType", rigType);
      if (rigInfo) params.set("siteType", "rv");

      const siteClassId = getString(bookingDetails.siteClassId);
      if (siteClassId) params.set("siteClassId", siteClassId);

      const baseUrl = `${window.location.pathname}/book`;
      const newUrl = `${baseUrl}?${params.toString()}`;
      router.push(newUrl);
    },
    [router]
  );

  const chat = useChatStreamSse({
    mode: "public",
    campgroundId,
    sessionId,
    onMeta: handleMeta,
  });

  const { messages, isTyping, isSending, sendMessage } = chat;
  const accent: ChatAccent = "public";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const handleConsent = () => {
    setHasConsented(true);
  };

  const emptyState = (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 bg-status-success-bg">
        <Sparkles className="w-8 h-8 text-status-success-text" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Keepr Host</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Share dates, guests, rig size, and must-have amenities. I will match you with the right site.
      </p>
      <SuggestedPrompts
        prompts={PROMPTS.public}
        onSelect={handleQuickReply}
        accent={accent}
      />
    </div>
  );

  return (
    <ChatShell
      isOpen={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      position="bottom-right"
      accent={accent}
      title="Keepr Host"
      subtitle="Booking + stay help"
      launcherLabel="Open Keepr Host chat"
      icon={<Bot className="w-6 h-6" />}
      allowMinimize={false}
      heightClassName="h-[calc(100vh-6rem)] sm:h-[500px] 2xl:h-[600px]"
    >
      {!hasConsented ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-status-success-bg rounded-full flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-status-success-text" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Keepr Host</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Share dates, guests, rig size, and must-have amenities. I will match you with the right site.
          </p>
          <div className="text-xs text-muted-foreground mb-6 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4 h-4 bg-status-success rounded-full flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span>Your data stays private</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-status-success rounded-full flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span>No personal info shared with Keepr Host</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConsent}
            className="px-6 py-3 bg-action-primary text-action-primary-foreground font-medium rounded-xl hover:bg-action-primary-hover transition-all"
          >
            Chat with Keepr Host
          </button>
        </div>
      ) : (
        <>
          <ChatMessageList
            messages={messages}
            isTyping={isTyping}
            accent={accent}
            onQuickReply={handleQuickReply}
            emptyState={emptyState}
            bottomRef={messagesEndRef}
          />
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Share dates, guests, rig, and amenities for ${campgroundName || "our park"}...`}
                className="flex-1 px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-action-primary/20 focus:border-action-primary text-sm"
                disabled={isSending}
                ref={inputRef}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="p-2 bg-action-primary text-action-primary-foreground rounded-xl hover:bg-action-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </ChatShell>
  );
}
