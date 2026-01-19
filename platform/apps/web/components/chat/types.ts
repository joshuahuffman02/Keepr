export type ChatAccent = "guest" | "staff" | "public" | "support" | "partner";
export type ChatMessageVisibility = "public" | "internal";

export interface ChatToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ChatToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export type ChatMessagePart =
  | { type: "text"; text: string }
  | {
      type: "tool";
      name: string;
      callId: string;
      args?: Record<string, unknown>;
      result?: unknown;
      error?: string;
    }
  | { type: "file"; file: ChatAttachment }
  | { type: "card"; title?: string; summary?: string; payload?: Record<string, unknown> };

export interface ChatAttachment {
  name: string;
  contentType: string;
  size: number;
  url?: string;
  downloadUrl?: string;
  storageKey?: string;
}

export interface ChatActionOption {
  id: string;
  label: string;
  variant?: "default" | "destructive" | "outline";
}

export interface ChatActionRequired {
  type: "confirmation" | "form" | "selection";
  actionId: string;
  title: string;
  description: string;
  summary?: string;
  data?: Record<string, unknown>;
  options?: ChatActionOption[];
}

export interface ChatRecommendation {
  siteName?: string;
  siteClassName: string;
  reasons: string[];
}

export interface HelpArticleLink {
  title: string;
  url: string;
}

export interface UnifiedChatMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  parts?: ChatMessagePart[];
  toolCalls?: ChatToolCall[];
  toolResults?: ChatToolResult[];
  attachments?: ChatAttachment[];
  actionRequired?: ChatActionRequired;
  recommendations?: ChatRecommendation[];
  clarifyingQuestions?: string[];
  helpArticles?: HelpArticleLink[];
  showTicketPrompt?: boolean;
  createdAt?: string;
  visibility?: ChatMessageVisibility;
}

export interface ChatConversationSummary {
  id: string;
  title?: string | null;
  updatedAt?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
}
