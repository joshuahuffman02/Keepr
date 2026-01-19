"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, LifeBuoy, ExternalLink, ShieldCheck, Paperclip, X, Loader2, AlertTriangle, FileText } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { API_BASE } from "@/lib/api-config";
import { useWhoami } from "@/hooks/use-whoami";
import {
  ChatMessage,
  ChatMessageList,
  ChatShell,
  PROMPTS,
  SuggestedPrompts,
} from "@/components/chat";
import type { ChatAccent, UnifiedChatMessage } from "@/components/chat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type SupportMessage = UnifiedChatMessage;

type EvidenceLink = { label: string; url: string };

type ImpactSummary = {
  level: "low" | "medium" | "high";
  summary: string;
  warnings?: string[];
  saferAlternative?: string;
};

type ActionDraft = {
  id: string;
  actionType: string;
  resource: string;
  action: "read" | "write";
  parameters?: Record<string, unknown>;
  status: "draft" | "executed" | "denied";
  requiresConfirmation?: boolean;
  sensitivity?: "low" | "medium" | "high";
  impact?: ImpactSummary;
  evidenceLinks?: EvidenceLink[];
  result?: Record<string, unknown>;
};

type PartnerMessage = UnifiedChatMessage & {
  actionDrafts?: ActionDraft[];
  confirmations?: { id: string; prompt: string }[];
  denials?: { reason: string; guidance?: string }[];
  questions?: string[];
  evidenceLinks?: EvidenceLink[];
};

const isUserAssistantMessage = <T extends UnifiedChatMessage>(
  message: T
): message is T & { role: "user" | "assistant" } =>
  message.role === "user" || message.role === "assistant";

function generateSessionId() {
  return `support_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const SUPPORT_TICKET_MAX_BYTES = 10 * 1024 * 1024;
const SUPPORT_TICKET_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);
const SUPPORT_TICKET_ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
]);
const SUPPORT_TICKET_EXTENSION_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};
const SUPPORT_TICKET_MAX_ATTACHMENTS = 5;
const SUPPORT_TICKET_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.pdf";
const SUPPORT_TICKET_EMAIL = "support@keeprstay.com";
const SUPPORT_TICKET_RESPONSE_TIME = "Typically within 24 hours.";

type ActionHighlight = {
  key: string;
  label: string;
  value: string;
};

const ACTION_LABELS: Record<string, string> = {
  lookup_availability: "Lookup availability",
  create_hold: "Create hold",
  block_site: "Block site (maintenance)",
  create_maintenance_ticket: "Create maintenance ticket",
  create_operational_task: "Create ops task",
  update_housekeeping_status: "Update housekeeping",
  generate_billing_schedule: "Generate billing schedule",
  refund_reservation: "Refund reservation",
  send_guest_message: "Send guest note",
  move_reservation: "Move reservation",
  adjust_rate: "Adjust rate",
};

const EXECUTABLE_ACTIONS = new Set([
  "lookup_availability",
  "create_hold",
  "block_site",
  "create_maintenance_ticket",
  "create_operational_task",
  "update_housekeeping_status",
  "generate_billing_schedule",
  "refund_reservation",
  "send_guest_message",
  "move_reservation",
  "adjust_rate"
]);

type TicketAttachment = {
  name: string;
  contentType: string;
  size: number;
  url: string;
  storageKey?: string;
};

type TicketAttachmentStatus = "uploading" | "ready" | "error";

type TicketAttachmentItem = {
  id: string;
  file: File;
  contentType: string;
  status: TicketAttachmentStatus;
  attachment?: TicketAttachment;
  error?: string;
};

const getFileExtension = (filename: string) => {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
};

const resolveTicketAttachmentMeta = (file: File) => {
  const ext = getFileExtension(file.name);
  const fallbackType = SUPPORT_TICKET_EXTENSION_MAP[ext];
  const contentType = file.type || fallbackType || "";
  if (!ext || !SUPPORT_TICKET_ALLOWED_EXTENSIONS.has(ext)) {
    return { error: "File type not supported." };
  }
  if (!contentType || !SUPPORT_TICKET_ALLOWED_TYPES.has(contentType)) {
    return { error: "File type not supported." };
  }
  if (file.size <= 0) {
    return { error: "File is empty." };
  }
  if (file.size > SUPPORT_TICKET_MAX_BYTES) {
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

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const serialized = JSON.stringify(value);
  if (!serialized) return "-";
  return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
}

function formatId(value: unknown) {
  if (value === null || value === undefined) return "-";
  const text = String(value);
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function formatDateRange(start?: string, end?: string) {
  if (start && end) return `${start} to ${end}`;
  if (start) return `from ${start}`;
  if (end) return `through ${end}`;
  return "";
}

function isPrimitive(value: unknown) {
  const t = typeof value;
  return t === "string" || t === "number" || t === "boolean";
}

function toOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isEvidenceLink = (value: unknown): value is EvidenceLink =>
  isRecord(value) && typeof value.label === "string" && typeof value.url === "string";

const isImpactSummary = (value: unknown): value is ImpactSummary =>
  isRecord(value) &&
  (value.level === "low" || value.level === "medium" || value.level === "high") &&
  typeof value.summary === "string" &&
  (value.warnings === undefined || isStringArray(value.warnings)) &&
  (value.saferAlternative === undefined || typeof value.saferAlternative === "string");

const isActionDraft = (value: unknown): value is ActionDraft =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.actionType === "string" &&
  typeof value.resource === "string" &&
  (value.action === "read" || value.action === "write") &&
  (value.parameters === undefined || isRecord(value.parameters)) &&
  (value.status === "draft" || value.status === "executed" || value.status === "denied") &&
  (value.requiresConfirmation === undefined || typeof value.requiresConfirmation === "boolean") &&
  (value.sensitivity === undefined ||
    value.sensitivity === "low" ||
    value.sensitivity === "medium" ||
    value.sensitivity === "high") &&
  (value.impact === undefined || isImpactSummary(value.impact)) &&
  (value.evidenceLinks === undefined ||
    (Array.isArray(value.evidenceLinks) && value.evidenceLinks.every(isEvidenceLink))) &&
  (value.result === undefined || isRecord(value.result));

const isConfirmation = (value: unknown): value is { id: string; prompt: string } =>
  isRecord(value) && typeof value.id === "string" && typeof value.prompt === "string";

const isDenial = (value: unknown): value is { reason: string; guidance?: string } =>
  isRecord(value) &&
  typeof value.reason === "string" &&
  (value.guidance === undefined || typeof value.guidance === "string");

const parsePartnerResponse = (value: unknown) => {
  if (!isRecord(value)) return {};

  return {
    message: typeof value.message === "string" ? value.message : undefined,
    actionDrafts: Array.isArray(value.actionDrafts)
      ? value.actionDrafts.filter(isActionDraft)
      : undefined,
    confirmations: Array.isArray(value.confirmations)
      ? value.confirmations.filter(isConfirmation)
      : undefined,
    denials: Array.isArray(value.denials) ? value.denials.filter(isDenial) : undefined,
    questions: isStringArray(value.questions) ? value.questions : undefined,
    evidenceLinks: Array.isArray(value.evidenceLinks)
      ? value.evidenceLinks.filter(isEvidenceLink)
      : undefined,
  };
};

function toLabel(value: string) {
  const spaced = value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

function buildActionSummary(draft: ActionDraft) {
  const params = draft.parameters ?? {};
  const primaryArrival = toOptionalString(params.newArrivalDate ?? params.arrivalDate);
  const primaryDeparture = toOptionalString(params.newDepartureDate ?? params.departureDate);
  const dateRange = formatDateRange(primaryArrival, primaryDeparture);
  const siteLabel = params.newSiteNumber
    ? `Site ${params.newSiteNumber}`
    : params.newSiteId
      ? `Site ${formatId(params.newSiteId)}`
      : params.siteNumber
        ? `Site ${params.siteNumber}`
        : params.siteId
          ? `Site ${formatId(params.siteId)}`
          : null;
  const reservationLabel = params.reservationId ? `Reservation ${formatId(params.reservationId)}` : null;

  switch (draft.actionType) {
    case "lookup_availability":
      return dateRange ? `Checking availability for ${dateRange}.` : "Checking availability for your campground.";
    case "create_hold":
      if (siteLabel && dateRange) return `Drafting a hold for ${siteLabel} (${dateRange}).`;
      if (siteLabel) return `Drafting a hold for ${siteLabel}.`;
      if (dateRange) return `Drafting a hold for ${dateRange}.`;
      return "Drafting a temporary hold.";
    case "block_site":
      if (siteLabel && dateRange) return `Blocking ${siteLabel} for maintenance (${dateRange}).`;
      if (siteLabel) return `Blocking ${siteLabel} for maintenance.`;
      if (dateRange) return `Blocking a site for maintenance (${dateRange}).`;
      return "Blocking a site for maintenance.";
    case "create_maintenance_ticket":
      if (params.issue && siteLabel) return `Creating a maintenance ticket for ${siteLabel}: ${params.issue}.`;
      if (params.issue) return `Creating a maintenance ticket: ${params.issue}.`;
      return siteLabel ? `Creating a maintenance ticket for ${siteLabel}.` : "Creating a maintenance ticket.";
    case "create_operational_task":
      if (params.title || params.task || params.summary) {
        const label = params.title ?? params.task ?? params.summary;
        return `Creating an operations task: ${label}.`;
      }
      return "Creating an operations task.";
    case "update_housekeeping_status":
      const statusLabel = params.status ?? params.housekeepingStatus;
      if (siteLabel && statusLabel) return `Updating housekeeping for ${siteLabel} to ${statusLabel}.`;
      return siteLabel ? `Updating housekeeping for ${siteLabel}.` : "Updating housekeeping status.";
    case "generate_billing_schedule":
      return "Generating a billing schedule for the reservation.";
    case "refund_reservation":
      if (params.amountCents && reservationLabel) {
        return `Refunding ${params.amountCents} cents for ${reservationLabel}.`;
      }
      if (reservationLabel) return `Refunding ${reservationLabel}.`;
      return "Refunding a reservation.";
    case "send_guest_message":
      if (params.subject) return `Logging a guest note: ${params.subject}.`;
      return "Logging a guest note.";
    case "move_reservation":
      if (reservationLabel && siteLabel && dateRange) return `Moving ${reservationLabel} to ${siteLabel} (${dateRange}).`;
      if (reservationLabel && siteLabel) return `Moving ${reservationLabel} to ${siteLabel}.`;
      if (reservationLabel && dateRange) return `Moving ${reservationLabel} to ${dateRange}.`;
      if (reservationLabel) return `Drafting a move for ${reservationLabel}.`;
      return "Drafting a reservation move.";
    case "adjust_rate":
      if (params.siteClassName && dateRange) return `Adjusting rates for ${params.siteClassName} (${dateRange}).`;
      if (params.siteClassName) return `Adjusting rates for ${params.siteClassName}.`;
      return dateRange ? `Adjusting rates for ${dateRange}.` : "Adjusting rates.";
    default:
      return "";
  }
}

function buildActionHighlights(draft: ActionDraft) {
  const params = draft.parameters ?? {};
  const items: ActionHighlight[] = [];
  const usedKeys = new Set<string>();

  const addItem = (keys: string | string[], label: string, value: string) => {
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach((key) => usedKeys.add(key));
    items.push({ key: list[0], label, value });
  };

  const dateRange = formatDateRange(
    toOptionalString(params.arrivalDate),
    toOptionalString(params.departureDate)
  );
  if (dateRange) addItem(["arrivalDate", "departureDate"], "Dates", dateRange);

  if (params.siteNumber) {
    addItem("siteNumber", "Site", String(params.siteNumber));
  } else if (params.siteId) {
    addItem("siteId", "Site", formatId(params.siteId));
  }

  if (params.reservationId) addItem("reservationId", "Reservation", formatId(params.reservationId));
  if (params.holdMinutes) addItem("holdMinutes", "Hold length", `${params.holdMinutes} mins`);
  if (params.issue) addItem("issue", "Issue", String(params.issue));
  if (params.reason) addItem("reason", "Reason", String(params.reason));
  if (params.priority) addItem("priority", "Priority", String(params.priority));
  if (params.status) addItem("status", "Status", String(params.status));
  if (params.housekeepingStatus) addItem("housekeepingStatus", "Housekeeping", String(params.housekeepingStatus));
  if (params.type) addItem("type", "Type", String(params.type));
  if (params.amountCents) addItem("amountCents", "Amount (cents)", String(params.amountCents));
  if (params.destination) addItem("destination", "Destination", String(params.destination));
  if (params.subject) addItem("subject", "Subject", String(params.subject));
  if (params.message || params.body) addItem("message", "Message", formatValue(params.message ?? params.body));
  if (params.adjustmentType) addItem("adjustmentType", "Adjustment type", String(params.adjustmentType));
  if (params.adjustmentValue) addItem("adjustmentValue", "Adjustment", String(params.adjustmentValue));
  if (params.newRateCents) addItem("newRateCents", "New rate (cents)", String(params.newRateCents));
  if (params.siteClassName) addItem("siteClassName", "Site class", String(params.siteClassName));

  if (params.newSiteNumber) {
    addItem("newSiteNumber", "New site", String(params.newSiteNumber));
  } else if (params.newSiteId) {
    addItem("newSiteId", "New site", formatId(params.newSiteId));
  }

  const newDateRange = formatDateRange(
    toOptionalString(params.newArrivalDate),
    toOptionalString(params.newDepartureDate)
  );
  if (newDateRange) addItem(["newArrivalDate", "newDepartureDate"], "New dates", newDateRange);

  const extras = Object.entries(params)
    .filter(([key, value]) => !usedKeys.has(key) && isPrimitive(value))
    .slice(0, items.length ? 2 : 3);

  extras.forEach(([key, value]) => addItem(key, toLabel(key), formatValue(value)));

  return { items, usedKeys };
}

export function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"support" | "partner">("support");
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [partnerMessages, setPartnerMessages] = useState<PartnerMessage[]>([]);
  const [supportInput, setSupportInput] = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [supportSessionId, setSupportSessionId] = useState("");
  const [partnerSessionId, setPartnerSessionId] = useState("");
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [confirmingDraftId, setConfirmingDraftId] = useState<string | null>(null);
  const [ticketComposerOpen, setTicketComposerOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDetails, setTicketDetails] = useState("");
  const [ticketSeverity, setTicketSeverity] = useState<"low" | "medium" | "high">("medium");
  const [ticketIncludeTranscript, setTicketIncludeTranscript] = useState(true);
  const [ticketAttachments, setTicketAttachments] = useState<TicketAttachmentItem[]>([]);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ticketFileInputRef = useRef<HTMLInputElement>(null);
  const { data: whoami } = useWhoami();

  const lastSupportUserMessage = useMemo(
    () =>
      [...supportMessages].reverse().find((message) => message.role === "user")?.content ?? "",
    [supportMessages]
  );

  const readyTicketAttachments = useMemo(
    () =>
      ticketAttachments.flatMap((item) => {
        if (item.status !== "ready" || !item.attachment) {
          return [];
        }
        return [item.attachment];
      }),
    [ticketAttachments]
  );
  const hasUploadingTicketAttachments = ticketAttachments.some(
    (item) => item.status === "uploading"
  );
  const canSubmitTicket =
    (ticketSubject.trim().length > 0 || ticketDetails.trim().length > 0) &&
    !ticketSubmitting &&
    !hasUploadingTicketAttachments;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [supportMessages, partnerMessages, mode]);

  // Initialize session IDs client-side only (SSR-safe)
  useEffect(() => {
    setSupportSessionId(generateSessionId());
    setPartnerSessionId(`partner_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  }, []);

  useEffect(() => {
    if (!isOpen || mode !== "partner") return;
    setCampgroundId(localStorage.getItem("campreserv:selectedCampground"));
  }, [isOpen, mode]);

  // Initialize with welcome message when opened
  useEffect(() => {
    if (isOpen && supportMessages.length === 0) {
      setSupportMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "Hi! I'm here to help with any questions about Keepr. What can I help you with today?\n\nI can assist with:\n- Setting up your campground\n- Payment and billing questions\n- Managing reservations\n- Using specific features\n\nJust ask away!",
        },
      ]);
    }
  }, [isOpen, supportMessages.length]);

  useEffect(() => {
    if (isOpen && partnerMessages.length === 0) {
      setPartnerMessages([
        {
          id: "partner-welcome",
          role: "assistant",
          content:
            "I can draft and run actions across availability, holds, maintenance, operations, and billing. Tell me what you want to do and I will draft the action (beta).",
        },
      ]);
    }
  }, [isOpen, partnerMessages.length]);

  const openTicketComposer = () => {
    setTicketError(null);
    if (!ticketDetails.trim() && lastSupportUserMessage) {
      setTicketDetails(lastSupportUserMessage);
    }
    setTicketComposerOpen(true);
  };

  const handleTicketAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setTicketError(null);

    const remainingSlots = SUPPORT_TICKET_MAX_ATTACHMENTS - ticketAttachments.length;
    if (remainingSlots <= 0) {
      setTicketError(`You can attach up to ${SUPPORT_TICKET_MAX_ATTACHMENTS} files.`);
      return;
    }

    const items: TicketAttachmentItem[] = files.slice(0, remainingSlots).map((file) => {
      const meta = resolveTicketAttachmentMeta(file);
      const contentType = meta.contentType ?? (file.type || "application/octet-stream");
      if ("error" in meta) {
        return {
          id: `ticket_att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          contentType,
          status: "error",
          error: meta.error,
        };
      }
      return {
        id: `ticket_att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        contentType,
        status: "uploading",
      };
    });

    setTicketAttachments((prev) => [...prev, ...items]);

    items
      .filter((item) => item.status === "uploading")
      .forEach((item) => {
        void uploadTicketAttachment(item);
      });
  };

  const uploadTicketAttachment = async (item: TicketAttachmentItem) => {
    try {
      const signed = await apiClient.signUpload({
        filename: item.file.name,
        contentType: item.contentType,
      });

      const uploadRes = await fetch(signed.uploadUrl, {
        method: "PUT",
        body: item.file,
        headers: {
          "Content-Type": item.contentType,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }

      const attachment: TicketAttachment = {
        name: item.file.name,
        contentType: item.contentType,
        size: item.file.size,
        url: signed.publicUrl,
        storageKey: signed.key,
      };

      setTicketAttachments((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: "ready", attachment, error: undefined }
            : entry
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setTicketAttachments((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, status: "error", error: message } : entry
        )
      );
    }
  };

  const removeTicketAttachment = (id: string) => {
    setTicketAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const buildSupportTranscript = () =>
    supportMessages
      .filter(isUserAssistantMessage)
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

  const gatherEvidenceLinks = () =>
    supportMessages.flatMap((message) => message.helpArticles ?? []).map((article) => ({
      label: article.title,
      url: article.url,
    }));

  const handleTicketSubmit = async () => {
    if (!canSubmitTicket) return;
    setTicketSubmitting(true);
    setTicketError(null);

    try {
      const details = ticketDetails.trim() || lastSupportUserMessage;
      if (!ticketSubject.trim() && !details) {
        setTicketError("Add a subject or details for the ticket.");
        setTicketSubmitting(false);
        return;
      }

      const submitterName =
        whoami?.user?.firstName || whoami?.user?.lastName
          ? `${whoami?.user?.firstName ?? ""} ${whoami?.user?.lastName ?? ""}`.trim()
          : whoami?.user?.email ?? null;
      const submitter = whoami?.user
        ? {
            id: whoami.user.id ?? null,
            name: submitterName || null,
            email: whoami.user.email ?? null,
          }
        : undefined;

      const client =
        typeof window !== "undefined"
          ? {
              userAgent: navigator.userAgent,
              platform: navigator.platform || null,
              language: navigator.language ?? null,
              deviceType: /ipad|tablet/i.test(navigator.userAgent)
                ? "tablet"
                : /mobi|android|iphone/i.test(navigator.userAgent)
                  ? "mobile"
                  : "desktop",
            }
          : undefined;

      const payload = {
        title: ticketSubject.trim() || "Support request",
        notes: details || "Support ticket from chat.",
        category: "issue",
        area: "support-chat",
        url: typeof window !== "undefined" ? window.location.href : undefined,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
        pageTitle: typeof document !== "undefined" ? document.title : undefined,
        submitter,
        client,
        extra: {
          source: "support-chat",
          severity: ticketSeverity,
          sessionId: supportSessionId,
          campgroundId:
            typeof window !== "undefined"
              ? localStorage.getItem("campreserv:selectedCampground")
              : null,
          transcript: ticketIncludeTranscript ? buildSupportTranscript() : undefined,
          evidenceLinks: gatherEvidenceLinks(),
          attachments: readyTicketAttachments,
        },
      };

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Ticket submit failed (${res.status})`);
      }

      const data = await res.json();
      const ticketId = data?.ticket?.id ?? data?.id ?? null;
      const ticketMessage = ticketId
        ? `Ticket submitted. ID: ${ticketId}. We'll reply within 24 hours.`
        : "Ticket submitted. We'll reply within 24 hours.";

      setSupportMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: `${ticketMessage} You can also email ${SUPPORT_TICKET_EMAIL}.`,
        },
      ]);

      setTicketComposerOpen(false);
      setTicketSubject("");
      setTicketDetails("");
      setTicketSeverity("medium");
      setTicketIncludeTranscript(true);
      setTicketAttachments([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ticket submit failed";
      setTicketError(message);
    } finally {
      setTicketSubmitting(false);
    }
  };

  const supportChatMutation = useMutation({
    mutationFn: async ({
      message,
      history,
    }: {
      message: string;
      history: { role: "user" | "assistant"; content: string }[];
    }) => {
      const authToken = localStorage.getItem("campreserv:authToken") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/ai/support/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          sessionId: supportSessionId,
          message,
          history,
          context: "dashboard_support",
        }),
      });

      if (!res.ok) {
        // If the support endpoint doesn't exist yet, provide a fallback
        return {
          message:
            "I apologize, but I'm having trouble connecting to the support system right now. Here are some helpful resources:\n\n" +
            "- Check our [Help Center](/dashboard/help) for answers to common questions\n" +
            "- Browse the [FAQ](/dashboard/help/faq) section\n" +
            "- [Submit a support ticket](/dashboard/help/contact) for personalized assistance",
          helpArticles: [
            { title: "Help Center", url: "/dashboard/help" },
            { title: "FAQs", url: "/dashboard/help/faq" },
            { title: "Contact Support", url: "/dashboard/help/contact" },
          ],
          showTicketPrompt: true,
        };
      }
      return res.json();
    },
    onSuccess: (data) => {
      const assistantMessage: SupportMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.message,
        helpArticles: data.helpArticles,
        showTicketPrompt: data.showTicketPrompt,
      };
      setSupportMessages((prev) => [...prev, assistantMessage]);
    },
    onError: () => {
      setSupportMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content:
            "Sorry, I encountered an error. You can still get help by:\n\n" +
            "- Checking our Help Center\n" +
            "- Submitting a support ticket\n" +
            "- Emailing support@keeprstay.com",
          showTicketPrompt: true,
        },
      ]);
    },
  });

  const partnerChatMutation = useMutation({
    mutationFn: async ({
      message,
      history,
    }: {
      message: string;
      history: { role: "user" | "assistant"; content: string }[];
    }) => {
      if (!campgroundId) {
        throw new Error("Select a campground to use Host staff mode.");
      }
      return apiClient.aiPartnerChat(campgroundId, {
        sessionId: partnerSessionId,
        message,
        history,
      });
    },
    onSuccess: (data) => {
      const parsed = parsePartnerResponse(data);
      const assistantMessage: PartnerMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: parsed.message || "Tell me what you want to do and I will draft the steps.",
        actionDrafts: parsed.actionDrafts,
        confirmations: parsed.confirmations,
        denials: parsed.denials,
        questions: parsed.questions,
        evidenceLinks: parsed.evidenceLinks,
      };
      setPartnerMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      setPartnerMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "Host staff is unavailable right now.",
        },
      ]);
    },
  });

  const confirmPartnerMutation = useMutation({
    mutationFn: async (draft: ActionDraft) => {
      if (!campgroundId) {
        throw new Error("Select a campground to confirm actions.");
      }
      return apiClient.aiPartnerConfirmAction(campgroundId, {
        action: {
          type: draft.actionType,
          parameters: draft.parameters,
          sensitivity: draft.sensitivity,
        },
      });
    },
    onSuccess: (data) => {
      setConfirmingDraftId(null);
      const parsed = parsePartnerResponse(data);
      const assistantMessage: PartnerMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: parsed.message || "Action confirmed.",
        actionDrafts: parsed.actionDrafts,
        confirmations: parsed.confirmations,
        denials: parsed.denials,
        questions: parsed.questions,
        evidenceLinks: parsed.evidenceLinks,
      };
      setPartnerMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      setConfirmingDraftId(null);
      setPartnerMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "Unable to confirm that action.",
        },
      ]);
    },
  });

  const handleSend = () => {
    if (mode === "support") {
      if (!supportInput.trim() || supportChatMutation.isPending) return;

      const userMessage: SupportMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: supportInput.trim(),
      };

      setSupportMessages((prev) => [...prev, userMessage]);

      const history = supportMessages.filter(isUserAssistantMessage).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      supportChatMutation.mutate({ message: supportInput.trim(), history });
      setSupportInput("");
      return;
    }

    if (!partnerInput.trim() || partnerChatMutation.isPending) return;

    if (!campgroundId) {
      setPartnerMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: "Select a campground before using Host staff mode.",
        },
      ]);
      return;
    }

    const userMessage: PartnerMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: partnerInput.trim(),
    };

    setPartnerMessages((prev) => [...prev, userMessage]);

    const history = partnerMessages.filter(isUserAssistantMessage).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    partnerChatMutation.mutate({ message: partnerInput.trim(), history });
    setPartnerInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePartnerQuickReply = (question: string) => {
    setPartnerInput(question);
  };

  const handleConfirmDraft = (draft: ActionDraft) => {
    setConfirmingDraftId(draft.id);
    confirmPartnerMutation.mutate(draft);
  };

  const isSupportMode = mode === "support";
  const activeInput = isSupportMode ? supportInput : partnerInput;
  const isPending = isSupportMode ? supportChatMutation.isPending : partnerChatMutation.isPending;
  const accent: ChatAccent = isSupportMode ? "support" : "partner";
  const headerActions = isSupportMode ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-white hover:bg-white/15"
      onClick={openTicketComposer}
    >
      New ticket
    </Button>
  ) : null;

  const handleSupportQuickReply = (question: string) => {
    setSupportInput(question);
  };

  const supportEmptyState = (
    <div className="text-center py-8">
      <h3 className="font-semibold text-foreground mb-1">Support desk</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Ask about settings, billing, or day-to-day workflows.
      </p>
      <SuggestedPrompts prompts={PROMPTS.support} onSelect={handleSupportQuickReply} accent={accent} />
    </div>
  );

  const partnerEmptyState = (
    <div className="text-center py-8">
      <h3 className="font-semibold text-foreground mb-1">Staff actions</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Draft actions and approvals for operations, maintenance, and guest messaging.
      </p>
      <SuggestedPrompts prompts={PROMPTS.partner} onSelect={handlePartnerQuickReply} accent={accent} />
    </div>
  );

  return (
    <ChatShell
      isOpen={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      position="bottom-right"
      accent={accent}
      title="Host"
      subtitle={isSupportMode ? "Support desk" : "Staff actions and drafts"}
      launcherLabel="Open Host assistant"
      icon={isSupportMode ? <LifeBuoy className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
      allowMinimize={false}
      heightClassName="h-[540px]"
      headerActions={headerActions}
    >
      <Dialog open={ticketComposerOpen} onOpenChange={setTicketComposerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit a support ticket</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {SUPPORT_TICKET_RESPONSE_TIME} Email fallback: {SUPPORT_TICKET_EMAIL}.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-ticket-subject">Subject</Label>
              <Input
                id="support-ticket-subject"
                value={ticketSubject}
                onChange={(event) => setTicketSubject(event.target.value)}
                placeholder="Short summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-ticket-severity">Severity</Label>
              <Select
                value={ticketSeverity}
                onValueChange={(value) => {
                  if (value === "low" || value === "medium" || value === "high") {
                    setTicketSeverity(value);
                  }
                }}
              >
                <SelectTrigger id="support-ticket-severity">
                  <SelectValue placeholder="Choose severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-ticket-details">Details</Label>
              <Textarea
                id="support-ticket-details"
                value={ticketDetails}
                onChange={(event) => setTicketDetails(event.target.value)}
                placeholder="Describe the issue or request"
                rows={4}
              />
            </div>
            <div className="flex items-center justify-between space-x-3 rounded-lg border border-border px-3 py-2">
              <div>
                <div className="text-sm font-medium text-foreground">Include transcript</div>
                <div className="text-xs text-muted-foreground">Attach the last 20 messages for context.</div>
              </div>
              <Switch
                checked={ticketIncludeTranscript}
                onCheckedChange={setTicketIncludeTranscript}
                aria-label="Include transcript"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Attachments</Label>
                <span className="text-xs text-muted-foreground">
                  {ticketAttachments.length}/{SUPPORT_TICKET_MAX_ATTACHMENTS}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => ticketFileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Add files
                </Button>
                <input
                  ref={ticketFileInputRef}
                  type="file"
                  multiple
                  accept={SUPPORT_TICKET_ACCEPT}
                  className="hidden"
                  onChange={handleTicketAttachmentChange}
                />
                <span className="text-xs text-muted-foreground">
                  Images or PDFs up to 10 MB.
                </span>
              </div>
              {ticketAttachments.length > 0 && (
                <div className="space-y-2">
                  {ticketAttachments.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{item.file.name}</div>
                          <div className="text-muted-foreground">
                            {item.contentType} • {formatFileSize(item.file.size)}
                          </div>
                          {item.error && (
                            <div className="flex items-center gap-1 text-status-error">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {item.error}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "uploading" && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeTicketAttachment(item.id)}
                          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                          aria-label="Remove attachment"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {ticketError && (
              <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
                {ticketError}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTicketComposerOpen(false)}
              disabled={ticketSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleTicketSubmit}
              disabled={!canSubmitTicket}
            >
              {ticketSubmitting ? "Submitting..." : "Submit ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="border-b border-border px-4 py-2 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("support")}
          className={`rounded-full px-3 py-1 transition-colors ${
            isSupportMode ? "bg-status-info/15 text-status-info" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Support
        </button>
        <button
          type="button"
          onClick={() => setMode("partner")}
          className={`rounded-full px-3 py-1 transition-colors ${
            isSupportMode ? "bg-muted text-muted-foreground hover:bg-muted/80" : "bg-status-success/15 text-status-success"
          }`}
        >
          Staff
        </button>
        {!isSupportMode && !campgroundId && (
          <span className="ml-auto rounded-full bg-status-warning/15 px-2 py-1 text-[11px] text-status-warning">
            Select a campground
          </span>
        )}
      </div>

      {!isSupportMode && (
        <div className="border-b border-status-success/30 bg-status-success/15 px-4 py-2 text-[11px] text-status-success">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Staff actions</span>
              <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-warning">
                Beta
              </span>
            </div>
            <span className="rounded-full border border-status-success/30 bg-card px-2 py-0.5 text-status-success">
              {campgroundId ? `Campground ${formatId(campgroundId)}` : "Select a campground"}
            </span>
          </div>
          <div className="mt-1 text-status-success">
            {campgroundId
              ? "Actions run with your permissions. Review before confirming; I can still guide anything I can't run."
              : "Select a campground in the top bar to run actions."}
          </div>
        </div>
      )}

      {isSupportMode ? (
        <ChatMessageList
          messages={supportMessages}
          isTyping={isPending}
          accent={accent}
          emptyState={supportEmptyState}
          bottomRef={messagesEndRef}
          onTicketAction={openTicketComposer}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {partnerMessages.length === 0 ? (
            partnerEmptyState
          ) : (
            partnerMessages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <ChatMessage {...msg} accent={accent} />
                <div className={cn(msg.role === "assistant" ? "ml-11" : "mr-11")}>
                  {msg.denials?.length ? (
                    <div className="mt-3 rounded-lg border border-status-error/30 bg-status-error/15 px-3 py-2 text-xs text-status-error">
                      {msg.denials.map((denial, idx) => (
                        <div key={`${denial.reason}-${idx}`}>
                          {denial.reason}
                          {denial.guidance ? ` - ${denial.guidance}` : ""}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {msg.questions?.length ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Needs input
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.questions.map((question, idx) => (
                          <button
                            key={`${question}-${idx}`}
                            type="button"
                            onClick={() => handlePartnerQuickReply(question)}
                            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-status-success hover:text-status-success"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {msg.actionDrafts?.length ? (
                    <div className="mt-3 space-y-3">
                      {msg.actionDrafts.map((draft) => {
                        const isReadOnlyExecuted = draft.action === "read" && draft.status === "executed";

                        if (isReadOnlyExecuted) {
                          if (!draft.evidenceLinks?.length) return null;
                          return (
                            <div key={draft.id} className="flex flex-wrap gap-2">
                              {draft.evidenceLinks.map((link) => (
                                <Link
                                  key={`${link.label}-${link.url}`}
                                  href={link.url}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-status-success/30 bg-status-success/10 px-3 py-1.5 text-xs font-medium text-status-success hover:bg-status-success/20 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          );
                        }

                        const statusClass =
                          draft.status === "executed"
                            ? "bg-status-success/15 text-status-success"
                            : draft.status === "denied"
                              ? "bg-status-error/15 text-status-error"
                              : "bg-status-warning/15 text-status-warning";
                        const impactClass =
                          draft.impact?.level === "high"
                            ? "bg-status-error/15 text-status-error"
                            : draft.impact?.level === "medium"
                              ? "bg-status-warning/15 text-status-warning"
                              : "bg-status-success/15 text-status-success";
                        const summary = buildActionSummary(draft);
                        const { items: highlights, usedKeys } = buildActionHighlights(draft);
                        const detailParams = Object.entries(draft.parameters ?? {}).filter(([key]) => !usedKeys.has(key));

                        return (
                          <div key={draft.id} className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-foreground">
                                  {ACTION_LABELS[draft.actionType] || draft.actionType}
                                </div>
                                {summary ? <div className="mt-1 text-xs text-muted-foreground">{summary}</div> : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {draft.requiresConfirmation && (
                                  <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-[11px] text-status-warning">
                                    Confirm to run
                                  </span>
                                )}
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass}`}>
                                  {draft.status}
                                </span>
                              </div>
                            </div>

                            {highlights.length ? (
                              <div className="mt-3 rounded-lg border border-border bg-muted px-3 py-2 text-[11px]">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Key details
                                </div>
                                <div className="mt-2 space-y-1">
                                  {highlights.map((item) => (
                                    <div key={`${draft.id}-${item.key}`} className="flex items-center justify-between gap-4">
                                      <span className="text-muted-foreground">{item.label}</span>
                                      <span className="text-foreground">{item.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {draft.impact && (
                              <div className="mt-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-foreground">Impact</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${impactClass}`}>
                                    {draft.impact.level}
                                  </span>
                                </div>
                                <p className="mt-1 text-muted-foreground">{draft.impact.summary}</p>
                                {draft.impact.warnings?.length ? (
                                  <div className="mt-2 space-y-1 text-status-warning">
                                    {draft.impact.warnings.map((warning) => (
                                      <div key={warning}>- {warning}</div>
                                    ))}
                                  </div>
                                ) : null}
                                {draft.impact.saferAlternative ? (
                                  <div className="mt-2 text-status-success">
                                    Safer alternative: {draft.impact.saferAlternative}
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {draft.evidenceLinks?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {draft.evidenceLinks.map((link) => (
                                  <Link
                                    key={`${link.label}-${link.url}`}
                                    href={link.url}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-status-success/30 bg-status-success/10 px-3 py-1 text-[11px] text-status-success hover:bg-status-success/20"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    {link.label}
                                  </Link>
                                ))}
                              </div>
                            ) : null}

                            {draft.requiresConfirmation && (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {EXECUTABLE_ACTIONS.has(draft.actionType) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDraft(draft)}
                                    disabled={confirmPartnerMutation.isPending && confirmingDraftId === draft.id}
                                    className="rounded-full bg-status-success px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-status-success/80 disabled:opacity-60"
                                  >
                                    {confirmingDraftId === draft.id ? "Confirming..." : "Confirm & run"}
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    Review this draft in the linked screen to continue.
                                  </span>
                                )}
                                <span className="text-[11px] text-muted-foreground">Runs with your permissions.</span>
                              </div>
                            )}

                            {(draft.sensitivity || detailParams.length > 0) && (
                              <details className="mt-3 text-[11px] text-muted-foreground">
                                <summary className="cursor-pointer select-none">Technical details</summary>
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center justify-between gap-4">
                                    <span>Action</span>
                                    <span className="text-foreground">{draft.action}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span>Resource</span>
                                    <span className="text-foreground">{draft.resource}</span>
                                  </div>
                                  {draft.sensitivity && (
                                    <div className="flex items-center justify-between gap-4">
                                      <span>Sensitivity</span>
                                      <span className="text-foreground">{draft.sensitivity}</span>
                                    </div>
                                  )}
                                  {detailParams.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {detailParams.map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between gap-4">
                                          <span>{key}</span>
                                          <span className="text-foreground">{formatValue(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {msg.confirmations?.length ? (
                    <div className="mt-3 rounded-lg border border-status-warning/30 bg-status-warning/15 px-3 py-2 text-xs text-status-warning">
                      {msg.confirmations.map((confirmation) => (
                        <div key={confirmation.id}>{confirmation.prompt}</div>
                      ))}
                    </div>
                  ) : null}

                  {msg.evidenceLinks?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      {msg.evidenceLinks.map((link) => (
                        <Link
                          key={`${link.label}-${link.url}`}
                          href={link.url}
                          className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground hover:border-status-success hover:text-status-success"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}

          {isPending && <ChatMessage id="typing" role="assistant" content="" isLoading={true} accent={accent} />}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={activeInput}
            onChange={(event) => {
              if (isSupportMode) {
                setSupportInput(event.target.value);
              } else {
                setPartnerInput(event.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isSupportMode
                ? "Ask a question..."
                : "Ask for actions, maintenance, billing, messaging, or drafts..."
            }
            className={`flex-1 px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 text-sm ${
              isSupportMode
                ? "focus:ring-status-info/20 focus:border-status-info"
                : "focus:ring-status-success/20 focus:border-status-success"
            }`}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!activeInput.trim() || isPending}
            className={`p-2 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isSupportMode ? "bg-status-info hover:bg-status-info/80" : "bg-status-success hover:bg-status-success/80"
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </ChatShell>
  );
}
