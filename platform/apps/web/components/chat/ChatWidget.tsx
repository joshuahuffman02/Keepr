"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Send,
  MessageCircle,
  Wifi,
  WifiOff,
  History,
  Paperclip,
  X,
  Loader2,
  AlertTriangle,
  FileText,
  Sparkles,
  ArrowDown,
  Lock,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { ChatShell } from "./ChatShell";
import { ChatMessageList } from "./ChatMessageList";
import { ChatHistoryPanel } from "./ChatHistoryPanel";
import { ChatArtifactPanel } from "./ChatArtifactPanel";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { PROMPTS } from "./prompts";
import { useChat } from "./hooks/useChat";
import { useChatStream } from "./hooks/useChatStream";
import { useChatStreamSse } from "./hooks/useChatStreamSse";
import { useChatHistory } from "./hooks/useChatHistory";
import { useChatConversations } from "./hooks/useChatConversations";
import type { ChatAccent, ChatAttachment, ChatMessageVisibility } from "./types";

const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const CHAT_ATTACHMENT_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);
const CHAT_ATTACHMENT_ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
]);
const CHAT_ATTACHMENT_EXTENSION_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};
const CHAT_SCROLL_BOTTOM_THRESHOLD = 120;

const generateSessionId = () => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

type AttachmentStatus = "uploading" | "ready" | "error";

interface AttachmentItem {
  id: string;
  file: File;
  contentType: string;
  status: AttachmentStatus;
  attachment?: ChatAttachment;
  error?: string;
  previewUrl?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasJsonRenderPayload = (data: Record<string, unknown>) =>
  [
    data.jsonRender,
    data.jsonRenderTree,
    data.uiRender,
    data.uiTree,
    data.report,
    data.layout,
    data.tree,
  ].some(isRecord);

const getFileExtension = (filename: string) => {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
};

const resolveAttachmentMeta = (file: File) => {
  const ext = getFileExtension(file.name);
  const fallbackType = CHAT_ATTACHMENT_EXTENSION_MAP[ext];
  const contentType = file.type || fallbackType || "";

  if (!ext || !CHAT_ATTACHMENT_ALLOWED_EXTENSIONS.has(ext)) {
    return { error: "File type not supported." };
  }
  if (!contentType || !CHAT_ATTACHMENT_ALLOWED_TYPES.has(contentType)) {
    return { error: "File type not supported." };
  }
  if (file.size <= 0) {
    return { error: "File is empty." };
  }
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    return { error: "File exceeds 10 MB." };
  }
  return { contentType };
};

const formatFileSize = (size: number) => {
  if (!Number.isFinite(size)) return "";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

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
  /** Choose streaming transport when enabled */
  streamingTransport?: "socket" | "sse";
}

export function ChatWidget({
  campgroundId,
  isGuest = false,
  guestId,
  authToken,
  initialMessage,
  position = "bottom-right",
  className,
  useStreaming = false,
  streamingTransport = "sse",
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [historyView, setHistoryView] = useState<"list" | "conversation">("list");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [resumeConversationId, setResumeConversationId] = useState<string | null>(null);
  const [feedbackById, setFeedbackById] = useState<Record<string, "up" | "down">>({});
  const [attachmentItems, setAttachmentItems] = useState<AttachmentItem[]>([]);
  const [sessionId] = useState(() => generateSessionId());
  const [conversationQuery, setConversationQuery] = useState("");
  const [conversationFilterId, setConversationFilterId] = useState("all");
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);
  const [messageVisibility, setMessageVisibility] = useState<ChatMessageVisibility>("public");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<AttachmentItem[]>([]);
  const prevMessageCountRef = useRef(0);
  const visibilityRef = useRef<ChatMessageVisibility>("public");
  const lastAutoOpenedReportRef = useRef<string | null>(null);

  const streamingMode = isGuest ? "guest" : "staff";
  const streamingChatSse = useChatStreamSse({
    mode: streamingMode,
    campgroundId,
    authToken,
    guestId,
    sessionId,
  });

  // Use streaming hook if enabled, otherwise use regular hook
  const streamingChatSocket = useChatStream({
    campgroundId,
    isGuest,
    guestId,
    authToken,
    sessionId,
  });

  const regularChat = useChat({
    campgroundId,
    isGuest,
    guestId,
    authToken,
    sessionId,
  });

  // Select which chat implementation to use
  const streamingChat = streamingTransport === "sse" ? streamingChatSse : streamingChatSocket;
  const chat = useStreaming ? streamingChat : regularChat;
  const {
    messages,
    isTyping,
    isSending,
    sendMessage,
    executeAction,
    executeTool,
    submitFeedback,
    regenerateMessage,
    conversationId,
    clearMessages,
    replaceMessages,
    setActiveConversation,
    isExecutingTool,
  } = chat;
  const isConnected = useStreaming ? streamingChat.isConnected : true;

  const canUploadAttachments = Boolean(authToken);
  const showVisibilityToggle = !isGuest;
  const isInternalNote = messageVisibility === "internal";
  const readyAttachments = useMemo(
    () =>
      attachmentItems.flatMap((item) => {
        if (item.status !== "ready" || !item.attachment) {
          return [];
        }
        return [item.attachment];
      }),
    [attachmentItems],
  );
  const hasUploadingAttachments = attachmentItems.some((item) => item.status === "uploading");
  const trimmedInput = input.trim();
  const canSend =
    (trimmedInput.length > 0 || readyAttachments.length > 0) &&
    !isSending &&
    !hasUploadingAttachments;
  const hasArtifacts = useMemo(
    () =>
      messages.some((message) =>
        (message.toolResults ?? []).some((result) => {
          const data = result.result;
          return (
            isRecord(data) &&
            (Array.isArray(data.availableSites) ||
              isRecord(data.quote) ||
              isRecord(data.revenue) ||
              isRecord(data.occupancy) ||
              hasJsonRenderPayload(data))
          );
        }),
      ),
    [messages],
  );

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom <= CHAT_SCROLL_BOTTOM_THRESHOLD;
    isAtBottomRef.current = atBottom;
    setShowJumpToLatest(!atBottom);
    if (atBottom) {
      setFirstUnreadMessageId(null);
    }
  }, []);

  const handleMessageScroll = useCallback(() => {
    updateScrollState();
  }, [updateScrollState]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isAtBottomRef.current) return;
    const frame = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(frame);
  }, [isOpen, isTyping, messages]);

  useEffect(() => {
    if (!isOpen) {
      prevMessageCountRef.current = 0;
      setFirstUnreadMessageId(null);
      return;
    }
    const previousCount = prevMessageCountRef.current;
    if (messages.length < previousCount) {
      setFirstUnreadMessageId(null);
    } else if (messages.length > previousCount && !isAtBottomRef.current) {
      const firstUnread = messages[previousCount]?.id ?? messages[0]?.id ?? null;
      setFirstUnreadMessageId((current) => current ?? firstUnread);
    }
    prevMessageCountRef.current = messages.length;
  }, [isOpen, messages]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => updateScrollState());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, updateScrollState]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    if (!media.matches) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMinimized, isOpen]);

  useEffect(() => {
    attachmentsRef.current = attachmentItems;
  }, [attachmentItems]);

  useEffect(() => {
    visibilityRef.current = messageVisibility;
  }, [messageVisibility]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  // Send initial message when opened (if provided)
  useEffect(() => {
    if (isOpen && initialMessage && messages.length === 0) {
      sendMessage(initialMessage);
    }
  }, [isOpen, initialMessage, messages.length, sendMessage]);

  const clearAttachments = useCallback(() => {
    setAttachmentItems((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return [];
    });
  }, [setAttachmentItems]);

  const removeAttachment = (id: string) => {
    setAttachmentItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const uploadAttachment = async (item: AttachmentItem) => {
    try {
      const endpoint = isGuest
        ? `${API_BASE}/chat/portal/${campgroundId}/attachments/sign`
        : `${API_BASE}/chat/campgrounds/${campgroundId}/attachments/sign`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      if (guestId) headers["x-guest-id"] = guestId;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.contentType,
          size: item.file.size,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to sign upload");
      }

      const payload: unknown = await response.json();
      if (
        !isRecord(payload) ||
        typeof payload.uploadUrl !== "string" ||
        typeof payload.storageKey !== "string" ||
        typeof payload.publicUrl !== "string"
      ) {
        throw new Error("Invalid upload response");
      }

      const uploadRes = await fetch(payload.uploadUrl, {
        method: "PUT",
        body: item.file,
        headers: {
          "Content-Type": item.contentType,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }

      const attachment: ChatAttachment = {
        name: item.file.name,
        contentType: item.contentType,
        size: item.file.size,
        storageKey: payload.storageKey,
        url: payload.publicUrl,
        downloadUrl: typeof payload.downloadUrl === "string" ? payload.downloadUrl : undefined,
      };

      setAttachmentItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: "ready", attachment, error: undefined }
            : entry,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setAttachmentItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, status: "error", error: message } : entry,
        ),
      );
    }
  };

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (!canUploadAttachments) return;

    const items: AttachmentItem[] = files.map((file) => {
      const meta = resolveAttachmentMeta(file);
      const contentType = (meta.contentType ?? file.type) || "application/octet-stream";
      const previewUrl = contentType.startsWith("image/") ? URL.createObjectURL(file) : undefined;

      if ("error" in meta) {
        return {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          contentType,
          status: "error",
          error: meta.error,
          previewUrl,
        };
      }

      return {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        contentType,
        status: "uploading",
        previewUrl,
      };
    });

    setAttachmentItems((prev) => [...prev, ...items]);

    items
      .filter((item) => item.status === "uploading")
      .forEach((item) => {
        void uploadAttachment(item);
      });
  };

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const visibility = showVisibilityToggle ? visibilityRef.current : undefined;
    sendMessage(trimmedInput, {
      attachments: readyAttachments,
      visibility,
    });
    setInput("");
    clearAttachments();
  }, [
    canSend,
    clearAttachments,
    readyAttachments,
    sendMessage,
    showVisibilityToggle,
    trimmedInput,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleQuickAction = useCallback(
    (action: string) => {
      visibilityRef.current = "public";
      setMessageVisibility("public");
      sendMessage(action, { visibility: "public" });
    },
    [sendMessage, setMessageVisibility],
  );

  const handleQuickReply = useCallback(
    (question: string) => {
      visibilityRef.current = "public";
      setMessageVisibility("public");
      setInput(question);
      inputRef.current?.focus();
    },
    [setInput, setMessageVisibility],
  );

  const handleEditMessage = useCallback(
    (_messageId: string, content: string) => {
      setInput(content);
      inputRef.current?.focus();
    },
    [setInput],
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      regenerateMessage(messageId);
    },
    [regenerateMessage],
  );

  const handleFeedback = useCallback(
    (messageId: string, value: "up" | "down") => {
      setFeedbackById((prev) => ({
        ...prev,
        [messageId]: value,
      }));
      submitFeedback(messageId, value);
    },
    [submitFeedback],
  );

  const handleActionSelect = useCallback(
    (actionId: string, optionId: string) => {
      executeAction(actionId, optionId);
    },
    [executeAction],
  );

  const handleToggleHistory = useCallback(() => {
    setShowHistory((prev) => {
      const next = !prev;
      if (next) {
        setHistoryView("list");
        setShowArtifacts(false);
      }
      return next;
    });
  }, [setHistoryView, setShowArtifacts, setShowHistory]);

  const handleToggleArtifacts = useCallback(() => {
    setShowArtifacts((prev) => {
      const next = !prev;
      if (next) setShowHistory(false);
      return next;
    });
  }, [setShowArtifacts, setShowHistory]);

  const handleShowArtifacts = useCallback(() => {
    setShowHistory(false);
    setShowArtifacts(true);
  }, [setShowArtifacts, setShowHistory]);

  const latestReportMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message) continue;
      const hasReport = (message.toolResults ?? []).some((result) => {
        const data = result.result;
        return isRecord(data) && hasJsonRenderPayload(data);
      });
      if (hasReport) return message.id;
    }
    return null;
  }, [messages]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setConversationQuery(value);
      if (historyView !== "list") {
        setHistoryView("list");
      }
    },
    [historyView],
  );

  const handleFilterChange = useCallback(
    (id: string) => {
      setConversationFilterId(id);
    },
    [setConversationFilterId],
  );

  const accent: ChatAccent = isGuest ? "guest" : "staff";
  const quickActions = isGuest ? PROMPTS.guest : PROMPTS.staff;
  const canShowConversations = Boolean(authToken);
  const headerTitle = isGuest ? "Keepr Host" : "Keepr Ops";
  const headerSubtitle = isGuest ? "Your stay assistant" : "Operations copilot";
  const launcherLabel = isGuest ? "Open Keepr Host chat" : "Open Keepr Ops chat";
  const inputPlaceholder = isInternalNote
    ? "Internal note for staff..."
    : isGuest
      ? "Ask about dates, sites, or changes..."
      : "Ask about arrivals, occupancy, tasks...";
  const conversationFilters = useMemo(
    () => [
      { id: "all", label: "All" },
      { id: "7d", label: "7d" },
      { id: "30d", label: "30d" },
      { id: "90d", label: "90d" },
    ],
    [],
  );
  const conversationSince = useMemo(() => {
    if (conversationFilterId === "all") return undefined;
    const days = conversationFilterId === "7d" ? 7 : conversationFilterId === "30d" ? 30 : 90;
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }, [conversationFilterId]);

  const emptyIconClasses = isGuest
    ? "bg-emerald-100 text-emerald-600"
    : "bg-blue-100 text-blue-600";
  const shellWidthClassName = showArtifacts
    ? "w-[calc(100vw-2rem)] sm:w-[44rem] xl:w-[52rem] 2xl:w-[60rem]"
    : undefined;
  const shellHeightClassName = showArtifacts
    ? "h-[calc(100vh-4rem)] sm:h-[680px] 2xl:h-[760px]"
    : undefined;
  const artifactPanelWidthClassName =
    "sm:w-[22rem] md:w-[24rem] lg:w-[26rem] xl:w-[28rem] 2xl:w-[30rem]";
  const artifactPanelPaddingClassName = showArtifacts
    ? "sm:pr-[22rem] md:pr-[24rem] lg:pr-[26rem] xl:pr-[28rem] 2xl:pr-[30rem]"
    : undefined;

  const emptyState = (
    <div className="text-center py-8">
      <div
        className={cn(
          "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4",
          emptyIconClasses,
        )}
      >
        <MessageCircle className="w-8 h-8" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">
        {isGuest ? "Plan your stay" : "What do you need right now?"}
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        {isGuest
          ? "Share dates, guests, rig size, and must-have amenities."
          : "Ask for arrivals, occupancy, tasks, or draft actions."}
      </p>
      <SuggestedPrompts prompts={quickActions} onSelect={handleQuickAction} accent={accent} />
    </div>
  );

  const history = useChatHistory({
    mode: isGuest ? "guest" : "staff",
    campgroundId,
    conversationId: activeConversationId,
    authToken,
    guestId,
  });

  const conversationList = useChatConversations({
    mode: isGuest ? "guest" : "staff",
    campgroundId,
    authToken,
    guestId,
    query: conversationQuery.trim() || undefined,
    since: conversationSince,
  });

  useEffect(() => {
    if (!conversationId) return;
    setActiveConversationId(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!showHistory || !canShowConversations) return;
    conversationList.reset();
    void conversationList.loadMore();
  }, [
    showHistory,
    canShowConversations,
    conversationQuery,
    conversationSince,
    conversationList.reset,
    conversationList.loadMore,
  ]);

  useEffect(() => {
    if (!showHistory) return;
    if (historyView !== "conversation") return;
    if (!activeConversationId) return;
    history.reset();
    void history.loadMore();
  }, [showHistory, historyView, activeConversationId, history.reset, history.loadMore]);

  useEffect(() => {
    if (!showArtifacts) return;
    if (!hasArtifacts) {
      setShowArtifacts(false);
    }
  }, [hasArtifacts, showArtifacts]);

  useEffect(() => {
    if (isGuest) return;
    if (!latestReportMessageId) return;
    if (lastAutoOpenedReportRef.current === latestReportMessageId) return;
    lastAutoOpenedReportRef.current = latestReportMessageId;
    setShowHistory(false);
    setShowArtifacts(true);
  }, [isGuest, latestReportMessageId]);

  useEffect(() => {
    if (!resumeConversationId) return;
    if (history.conversationId !== resumeConversationId) return;
    if (history.messages.length === 0) return;
    replaceMessages(history.messages);
    setResumeConversationId(null);
  }, [history.conversationId, history.messages, replaceMessages, resumeConversationId]);

  const handleConversationSelect = (id: string) => {
    setActiveConversationId(id);
    setHistoryView("conversation");
    setResumeConversationId(id);
    setActiveConversation(id);
  };

  const handleNewConversation = () => {
    clearMessages();
    clearAttachments();
    setActiveConversationId(null);
    setResumeConversationId(null);
    setHistoryView("list");
  };

  const historyLabel = useMemo(() => {
    if (!activeConversationId) {
      return "Select a conversation to view history";
    }
    if (history.error) {
      return "History unavailable";
    }
    return "";
  }, [activeConversationId, history.error]);

  const conversationLabel = useMemo(() => {
    if (conversationList.error) {
      return "Conversations unavailable";
    }
    if (conversationQuery.trim().length > 0 || conversationFilterId !== "all") {
      return "No matching conversations.";
    }
    return "No conversations yet.";
  }, [conversationList.error, conversationFilterId, conversationQuery]);

  const handleJumpToLatest = () => {
    scrollToBottom("smooth");
    setShowJumpToLatest(false);
    setFirstUnreadMessageId(null);
  };

  const handleToolConfirm = useCallback(
    (tool: string, args: Record<string, unknown>) => {
      executeTool?.(tool, args);
    },
    [executeTool],
  );

  return (
    <ChatShell
      isOpen={isOpen}
      isMinimized={isMinimized}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      onMinimize={() => setIsMinimized(true)}
      onMaximize={() => setIsMinimized(false)}
      position={position}
      accent={accent}
      title={headerTitle}
      subtitle={headerSubtitle}
      launcherLabel={launcherLabel}
      icon={<MessageCircle className="w-6 h-6" />}
      statusSlot={
        useStreaming ? (
          <span title={isConnected ? "Connected" : "Disconnected"}>
            {isConnected ? (
              <Wifi className="w-3 h-3 text-white/80" />
            ) : (
              <WifiOff className="w-3 h-3 text-white/60" />
            )}
          </span>
        ) : null
      }
      widthClassName={shellWidthClassName}
      heightClassName={shellHeightClassName}
      headerActions={
        <div className="flex items-center gap-1">
          {hasArtifacts && (
            <button
              type="button"
              onClick={handleToggleArtifacts}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              aria-label="Toggle artifacts panel"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          {canShowConversations && (
            <button
              type="button"
              onClick={handleToggleHistory}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              aria-label="Toggle chat history"
            >
              <History className="w-4 h-4" />
            </button>
          )}
        </div>
      }
      className={className}
    >
      <div className="relative flex-1 min-h-0 flex flex-col">
        <ChatMessageList
          messages={messages}
          isTyping={isTyping}
          accent={accent}
          onActionSelect={handleActionSelect}
          onQuickReply={handleQuickReply}
          onEditMessage={handleEditMessage}
          onRegenerate={handleRegenerate}
          onFeedback={handleFeedback}
          feedbackById={feedbackById}
          emptyState={emptyState}
          firstUnreadMessageId={firstUnreadMessageId}
          bottomRef={messagesEndRef}
          containerRef={scrollContainerRef}
          onScroll={handleMessageScroll}
          onShowArtifacts={handleShowArtifacts}
          className={artifactPanelPaddingClassName}
          onToolConfirm={handleToolConfirm}
          isExecutingTool={isExecutingTool}
        />
        {showJumpToLatest && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <button
              type="button"
              onClick={handleJumpToLatest}
              className={cn(
                "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-sm transition hover:bg-muted",
                accent === "guest" ? "text-emerald-700" : "text-blue-700",
              )}
              data-testid="chat-jump-to-latest"
              aria-label="Jump to latest message"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Jump to latest
            </button>
          </div>
        )}
        <ChatHistoryPanel
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          view={historyView}
          conversations={conversationList.conversations}
          isLoadingConversations={conversationList.isLoading}
          hasMoreConversations={conversationList.hasMore}
          onLoadMoreConversations={conversationList.loadMore}
          onSelectConversation={handleConversationSelect}
          onNewConversation={handleNewConversation}
          activeConversationId={activeConversationId}
          onBack={() => setHistoryView("list")}
          conversationEmptyState={conversationLabel}
          messages={history.messages}
          isLoading={history.isLoading}
          hasMore={history.hasMore}
          onLoadMore={history.loadMore}
          accent={accent}
          emptyState={historyLabel || "No history yet. Send a message to start."}
          searchValue={conversationQuery}
          onSearchChange={isGuest ? undefined : handleSearchChange}
          filters={isGuest ? [] : conversationFilters}
          activeFilterId={conversationFilterId}
          onFilterChange={isGuest ? undefined : handleFilterChange}
        />
        <ChatArtifactPanel
          isOpen={showArtifacts}
          onClose={() => setShowArtifacts(false)}
          messages={messages}
          accent={accent}
          className={artifactPanelWidthClassName}
        />
      </div>
      <div className="p-4 border-t border-border">
        <div className="space-y-3">
          {showVisibilityToggle && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <div className="inline-flex rounded-full border border-border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    visibilityRef.current = "public";
                    setMessageVisibility("public");
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-medium transition",
                    !isInternalNote
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={!isInternalNote}
                >
                  Ask AI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    visibilityRef.current = "internal";
                    setMessageVisibility("internal");
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-medium transition",
                    isInternalNote
                      ? "bg-amber-100 text-amber-900 shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={isInternalNote}
                >
                  Internal note
                </button>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1",
                  isInternalNote ? "text-amber-700" : "text-muted-foreground",
                )}
              >
                <Lock className="h-3 w-3" />
                {isInternalNote ? "Staff-only note." : "Shared with AI."}
              </div>
            </div>
          )}
          {attachmentItems.length > 0 && (
            <div className="space-y-2">
              {attachmentItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border p-2 text-xs",
                    item.status === "error" ? "bg-red-50/60" : "bg-muted/40",
                  )}
                >
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-12 w-16 rounded-md object-cover border border-border"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center border border-border">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{item.file.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatFileSize(item.file.size)}
                      {item.contentType ? ` • ${item.contentType}` : ""}
                    </div>
                    {item.status === "uploading" && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading...
                      </div>
                    )}
                    {item.status === "error" && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        {item.error ?? "Upload failed"}
                      </div>
                    )}
                    {item.status === "ready" && (
                      <div className="mt-1 text-[11px] text-muted-foreground">Ready to send</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(item.id)}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            {canUploadAttachments && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || hasUploadingAttachments}
                  className="p-2.5 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Attach files"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                  multiple
                  onChange={handleAttachmentChange}
                  disabled={isSending || hasUploadingAttachments}
                />
              </>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={inputPlaceholder}
              className={cn(
                "flex-1 px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 text-sm",
                isGuest
                  ? "focus:ring-emerald-500/20 focus:border-emerald-500"
                  : "focus:ring-blue-500/20 focus:border-blue-500",
              )}
              disabled={isSending}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                "p-2.5 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                isGuest ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700",
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          {canUploadAttachments && (
            <div className="text-[11px] text-muted-foreground">
              JPG, PNG, GIF, WEBP, or PDF up to 10 MB.
            </div>
          )}
        </div>
      </div>
    </ChatShell>
  );
}
