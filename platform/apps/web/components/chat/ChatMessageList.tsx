"use client";

import type { ReactNode, RefObject } from "react";
import { Fragment, useCallback, useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import type { ChatAccent, UnifiedChatMessage } from "./types";

const isScrollable = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight;
};

const findScrollableAncestor = (start: HTMLElement, boundary: HTMLElement) => {
  let node: HTMLElement | null = start;
  while (node && node !== boundary) {
    if (isScrollable(node)) return node;
    node = node.parentElement;
  }
  return null;
};

const canScrollInDirection = (element: HTMLElement, deltaY: number) => {
  if (element.scrollHeight <= element.clientHeight) return false;
  const maxScrollTop = element.scrollHeight - element.clientHeight;
  if (deltaY < 0) return element.scrollTop > 0;
  if (deltaY > 0) return element.scrollTop < maxScrollTop;
  return false;
};

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
  onShowArtifacts?: () => void;
  emptyState?: ReactNode;
  firstUnreadMessageId?: string | null;
  bottomRef?: RefObject<HTMLDivElement>;
  containerRef?: RefObject<HTMLDivElement>;
  onScroll?: () => void;
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
  onShowArtifacts,
  emptyState,
  firstUnreadMessageId,
  bottomRef,
  containerRef,
  onScroll,
}: ChatMessageListProps) {
  const localContainerRef = useRef<HTMLDivElement>(null);
  const lastTouchYRef = useRef<number | null>(null);
  const resolvedContainerRef = containerRef ?? localContainerRef;

  const getScrollContext = useCallback((container: HTMLElement, target: EventTarget | null) => {
    const targetElement = target instanceof HTMLElement ? target : null;
    const nestedScrollable = targetElement ? findScrollableAncestor(targetElement, container) : null;
    const containerCanScroll = container.scrollHeight > container.clientHeight;
    return { nestedScrollable, containerCanScroll };
  }, []);

  const applyScrollDelta = useCallback((element: HTMLElement, deltaY: number) => {
    const maxScrollTop = element.scrollHeight - element.clientHeight;
    const nextScrollTop = Math.min(maxScrollTop, Math.max(0, element.scrollTop + deltaY));
    if (nextScrollTop === element.scrollTop) return false;
    element.scrollTop = nextScrollTop;
    return true;
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const { nestedScrollable, containerCanScroll } = getScrollContext(container, event.target);

    if (nestedScrollable && canScrollInDirection(nestedScrollable, event.deltaY)) {
      applyScrollDelta(nestedScrollable, event.deltaY);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (containerCanScroll && canScrollInDirection(container, event.deltaY)) {
      applyScrollDelta(container, event.deltaY);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (nestedScrollable || containerCanScroll) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [applyScrollDelta, getScrollContext]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    lastTouchYRef.current = touch ? touch.clientY : null;
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 1) return;
      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) return;
      const lastY = lastTouchYRef.current;
      lastTouchYRef.current = currentY;
      if (lastY === null) return;
      const deltaY = lastY - currentY;
      const container = event.currentTarget;
      const { nestedScrollable, containerCanScroll } = getScrollContext(container, event.target);

      if (nestedScrollable && canScrollInDirection(nestedScrollable, deltaY)) {
        applyScrollDelta(nestedScrollable, deltaY);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (containerCanScroll && canScrollInDirection(container, deltaY)) {
        applyScrollDelta(container, deltaY);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (nestedScrollable || containerCanScroll) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [applyScrollDelta, getScrollContext]
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchYRef.current = null;
  }, []);

  useEffect(() => {
    const container = resolvedContainerRef.current;
    if (!container) return;
    const handleWheelCapture = (event: WheelEvent) => {
      const { nestedScrollable, containerCanScroll } = getScrollContext(container, event.target);
      if (nestedScrollable || containerCanScroll) {
        event.preventDefault();
      }
    };
    const handleTouchMoveCapture = (event: TouchEvent) => {
      const { nestedScrollable, containerCanScroll } = getScrollContext(container, event.target);
      if (nestedScrollable || containerCanScroll) {
        event.preventDefault();
      }
    };
    container.addEventListener("wheel", handleWheelCapture, { passive: false, capture: true });
    container.addEventListener("touchmove", handleTouchMoveCapture, { passive: false, capture: true });
    return () => {
      container.removeEventListener("wheel", handleWheelCapture, { capture: true });
      container.removeEventListener("touchmove", handleTouchMoveCapture, { capture: true });
    };
  }, [getScrollContext, resolvedContainerRef]);

  return (
    <div
      ref={resolvedContainerRef}
      onScroll={onScroll}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ WebkitOverflowScrolling: "touch" }}
      className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-4"
      data-testid="chat-message-list"
    >
      {messages.length === 0 && emptyState}
      {messages.map((message) => (
        <Fragment key={message.id}>
          {firstUnreadMessageId === message.id && (
            <div
              className="flex items-center gap-3 text-[11px] text-muted-foreground"
              data-testid="chat-new-message-marker"
            >
              <div className="h-px flex-1 bg-border" />
              <span className="rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide">
                New messages
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          <ChatMessage
            accent={accent}
            onActionSelect={onActionSelect}
            onQuickReply={onQuickReply}
            onEditMessage={onEditMessage}
            onRegenerate={onRegenerate}
            onFeedback={onFeedback}
            feedback={feedbackById?.[message.id]}
            onTicketAction={onTicketAction}
            ticketHref={ticketHref}
            onShowArtifacts={onShowArtifacts}
            {...message}
          />
        </Fragment>
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
