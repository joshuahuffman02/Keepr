"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Send, Bot, User, LifeBuoy, ExternalLink, Ticket, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface SupportMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  helpArticles?: { title: string; url: string }[];
  showTicketPrompt?: boolean;
}

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
  parameters?: Record<string, any>;
  status: "draft" | "executed" | "denied";
  requiresConfirmation?: boolean;
  sensitivity?: "low" | "medium" | "high";
  impact?: ImpactSummary;
  evidenceLinks?: EvidenceLink[];
  result?: Record<string, any>;
};

interface PartnerMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionDrafts?: ActionDraft[];
  confirmations?: { id: string; prompt: string }[];
  denials?: { reason: string; guidance?: string }[];
  questions?: string[];
  evidenceLinks?: EvidenceLink[];
}

function generateSessionId() {
  return `support_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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

function formatValue(value: any) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const serialized = JSON.stringify(value);
  if (!serialized) return "-";
  return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
}

function formatId(value: any) {
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

function isPrimitive(value: any) {
  const t = typeof value;
  return t === "string" || t === "number" || t === "boolean";
}

function toLabel(value: string) {
  const spaced = value.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

function buildActionSummary(draft: ActionDraft) {
  const params = draft.parameters ?? {};
  const primaryArrival = params.newArrivalDate ?? params.arrivalDate;
  const primaryDeparture = params.newDepartureDate ?? params.departureDate;
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

  const dateRange = formatDateRange(params.arrivalDate, params.departureDate);
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

  const newDateRange = formatDateRange(params.newArrivalDate, params.newDepartureDate);
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
  const [supportSessionId] = useState(() => generateSessionId());
  const [partnerSessionId] = useState(() => `partner_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [confirmingDraftId, setConfirmingDraftId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [supportMessages, partnerMessages, mode]);

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
            "Hi! I'm here to help with any questions about Camp Everyday. What can I help you with today?\n\nI can assist with:\n- Setting up your campground\n- Payment and billing questions\n- Managing reservations\n- Using specific features\n\nJust ask away!",
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
            "- Check our [Help Center](/help) for answers to common questions\n" +
            "- Browse the [FAQ](/help/faq) section\n" +
            "- [Submit a support ticket](/help/contact) for personalized assistance",
          helpArticles: [
            { title: "Help Center", url: "/help" },
            { title: "FAQs", url: "/help/faq" },
            { title: "Contact Support", url: "/help/contact" },
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
            "- Emailing support@campeveryday.com",
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
      const assistantMessage: PartnerMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data?.message || "Tell me what you want to do and I will draft the steps.",
        actionDrafts: data?.actionDrafts,
        confirmations: data?.confirmations,
        denials: data?.denials,
        questions: data?.questions,
        evidenceLinks: data?.evidenceLinks,
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
      const assistantMessage: PartnerMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data?.message || "Action confirmed.",
        actionDrafts: data?.actionDrafts,
        confirmations: data?.confirmations,
        denials: data?.denials,
        questions: data?.questions,
        evidenceLinks: data?.evidenceLinks,
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

      const history = supportMessages.map((m) => ({
        role: m.role as "user" | "assistant",
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

    const history = partnerMessages.map((m) => ({
      role: m.role as "user" | "assistant",
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

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center z-[9999] ${
          isSupportMode
            ? "bg-status-info text-status-info-foreground"
            : "bg-action-primary text-action-primary-foreground"
        }`}
        aria-label="Open Host assistant"
      >
        <LifeBuoy className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[540px] bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-border">
      {/* Header */}
      <div
        className={`p-4 flex items-center justify-between ${
          isSupportMode
            ? "bg-status-info text-status-info-foreground"
            : "bg-action-primary text-action-primary-foreground"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-card/20 rounded-full flex items-center justify-center">
            {isSupportMode ? <LifeBuoy className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <div className="font-semibold">Host</div>
            <div className="text-xs text-white/80">{isSupportMode ? "Support desk" : "Staff actions and drafts"}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-2 hover:bg-card/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isSupportMode ? (
          supportMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-status-info/15 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-status-info" />
                </div>
              )}
              <div
                className={`max-w-[75%] p-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-status-info text-white rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {msg.helpArticles && msg.helpArticles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Related articles:</p>
                    {msg.helpArticles.map((article, idx) => (
                      <Link
                        key={idx}
                        href={article.url}
                        className="flex items-center gap-2 bg-card rounded-lg p-2 border border-border text-sm text-status-info hover:bg-status-info/15 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {article.title}
                      </Link>
                    ))}
                  </div>
                )}

                {msg.showTicketPrompt && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Need more help?</p>
                    <Link
                      href="/help/contact"
                      className="inline-flex items-center gap-2 bg-status-info text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-status-info/80 transition-colors"
                    >
                      <Ticket className="w-4 h-4" />
                      Submit a Ticket
                    </Link>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))
        ) : (
          partnerMessages.map((msg) => {
            const hasActionDrafts = (msg.actionDrafts?.length ?? 0) > 0;
            const bubbleWidth = msg.role === "user" ? "max-w-[75%]" : hasActionDrafts ? "max-w-[90%]" : "max-w-[75%]";
            const bubbleStyle =
              msg.role === "user"
                ? "bg-status-success text-white rounded-br-md"
                : hasActionDrafts
                  ? "bg-muted text-foreground rounded-bl-md border border-border"
                  : "bg-muted text-foreground rounded-bl-md";
            const bubblePadding = hasActionDrafts ? "p-4" : "p-3";

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 bg-status-success/15 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-status-success" />
                  </div>
                )}
                <div className={`${bubbleWidth} ${bubblePadding} rounded-2xl ${bubbleStyle}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

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
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs input</div>
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
                      // For read-only executed actions, just show evidence links (no technical card)
                      const isReadOnlyExecuted = draft.action === "read" && draft.status === "executed";

                      if (isReadOnlyExecuted) {
                        // Simple display: just evidence links
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

                      // Full display for write actions or pending/denied actions
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
                {msg.role === "user" && (
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isPending && (
          <div className="flex gap-3 justify-start">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isSupportMode ? "bg-status-info/15" : "bg-status-success/15"
            }`}>
              <Bot className={`w-4 h-4 ${isSupportMode ? "text-status-info" : "text-status-success"}`} />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-md p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-border flex gap-2 overflow-x-auto">
        {isSupportMode ? (
          [
            { label: "Help Center", href: "/help" },
            { label: "FAQs", href: "/help/faq" },
            { label: "Contact", href: "/help/contact" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex-shrink-0 px-3 py-1.5 bg-muted text-muted-foreground text-xs font-medium rounded-full hover:bg-muted transition-colors"
            >
              {link.label}
            </Link>
          ))
        ) : (
          [
            "Check availability for next weekend",
            "Block site 12 for maintenance June 10-20",
            "Create maintenance ticket for site 7: broken pedestal",
            "Move reservation ABC123 to site 4 July 10-12",
            "Refund reservation ABC123 5000 cents",
            "Log guest note for reservation ABC123: late arrival",
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setPartnerInput(prompt)}
              className="flex-shrink-0 px-3 py-1.5 bg-muted text-muted-foreground text-xs font-medium rounded-full hover:bg-muted transition-colors"
            >
              {prompt}
            </button>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={activeInput}
            onChange={(e) => {
              if (isSupportMode) {
                setSupportInput(e.target.value);
              } else {
                setPartnerInput(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={isSupportMode ? "Ask a question..." : "Ask for actions, maintenance, billing, messaging, or drafts..."}
            className={`flex-1 px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 text-sm ${
              isSupportMode ? "focus:ring-status-info/20 focus:border-status-info" : "focus:ring-status-success/20 focus:border-status-success"
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
    </div>
  );
}
