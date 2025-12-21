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

const ACTION_LABELS: Record<string, string> = {
  lookup_availability: "Lookup availability",
  create_hold: "Create hold",
  move_reservation: "Move reservation",
  adjust_rate: "Adjust rate",
};

const EXECUTABLE_ACTIONS = new Set(["lookup_availability", "create_hold"]);

function formatValue(value: any) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const serialized = JSON.stringify(value);
  if (!serialized) return "-";
  return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
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
            "I can help with availability checks, temporary holds, and operational guidance. Tell me what you want to do, and I will draft the action.",
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
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center z-[9999]"
        aria-label="Open Host assistant"
      >
        <LifeBuoy className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[540px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-slate-200">
      {/* Header */}
      <div
        className={`text-white p-4 flex items-center justify-between ${
          isSupportMode ? "bg-gradient-to-r from-blue-500 to-indigo-600" : "bg-gradient-to-r from-emerald-500 to-teal-600"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
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
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="border-b border-slate-200 px-4 py-2 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("support")}
          className={`rounded-full px-3 py-1 transition-colors ${
            isSupportMode ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          Support
        </button>
        <button
          type="button"
          onClick={() => setMode("partner")}
          className={`rounded-full px-3 py-1 transition-colors ${
            isSupportMode ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          Staff
        </button>
        {!isSupportMode && !campgroundId && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-1 text-[11px] text-amber-700">
            Select a campground
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isSupportMode ? (
          supportMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
              )}
              <div
                className={`max-w-[75%] p-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-900 rounded-bl-md"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {msg.helpArticles && msg.helpArticles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-slate-500">Related articles:</p>
                    {msg.helpArticles.map((article, idx) => (
                      <Link
                        key={idx}
                        href={article.url}
                        className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-200 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {article.title}
                      </Link>
                    ))}
                  </div>
                )}

                {msg.showTicketPrompt && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500 mb-2">Need more help?</p>
                    <Link
                      href="/help/contact"
                      className="inline-flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      <Ticket className="w-4 h-4" />
                      Submit a Ticket
                    </Link>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          ))
        ) : (
          partnerMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <div
                className={`max-w-[75%] p-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-emerald-500 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-900 rounded-bl-md"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {msg.denials?.length ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
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
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs input</div>
                    <div className="flex flex-wrap gap-2">
                      {msg.questions.map((question, idx) => (
                        <button
                          key={`${question}-${idx}`}
                          type="button"
                          onClick={() => handlePartnerQuickReply(question)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
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
                      const statusClass =
                        draft.status === "executed"
                          ? "bg-emerald-100 text-emerald-700"
                          : draft.status === "denied"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700";
                      const impactClass =
                        draft.impact?.level === "high"
                          ? "bg-rose-100 text-rose-700"
                          : draft.impact?.level === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700";

                      return (
                        <div key={draft.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900">
                              {ACTION_LABELS[draft.actionType] || draft.actionType}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {draft.requiresConfirmation && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                                  Needs confirmation
                                </span>
                              )}
                              <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass}`}>
                                {draft.status}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              Action: {draft.action}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              Resource: {draft.resource}
                            </span>
                            {draft.sensitivity && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                Sensitivity: {draft.sensitivity}
                              </span>
                            )}
                          </div>

                          {draft.parameters && Object.keys(draft.parameters).length > 0 && (
                            <div className="mt-2 space-y-1">
                              {Object.entries(draft.parameters).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between gap-4">
                                  <span className="text-slate-500">{key}</span>
                                  <span className="text-slate-900">{formatValue(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {draft.impact && (
                            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-700">Impact</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${impactClass}`}>
                                  {draft.impact.level}
                                </span>
                              </div>
                              <p className="mt-1 text-slate-600">{draft.impact.summary}</p>
                              {draft.impact.warnings?.length ? (
                                <div className="mt-2 space-y-1 text-amber-700">
                                  {draft.impact.warnings.map((warning) => (
                                    <div key={warning}>- {warning}</div>
                                  ))}
                                </div>
                              ) : null}
                              {draft.impact.saferAlternative ? (
                                <div className="mt-2 text-emerald-700">
                                  Safer alternative: {draft.impact.saferAlternative}
                                </div>
                              ) : null}
                            </div>
                          )}

                          {draft.result && (
                            <div className="mt-2 text-slate-600">Result: {formatValue(draft.result)}</div>
                          )}

                          {draft.evidenceLinks?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                              {draft.evidenceLinks.map((link) => (
                                <Link
                                  key={`${link.label}-${link.url}`}
                                  href={link.url}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
                                >
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
                                  className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {confirmingDraftId === draft.id ? "Confirming..." : "Confirm & run"}
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-500">
                                  Manual approval required in the app.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {msg.confirmations?.length ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
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
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          ))
        )}

        {isPending && (
          <div className="flex gap-3 justify-start">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isSupportMode ? "bg-blue-100" : "bg-emerald-100"
            }`}>
              <Bot className={`w-4 h-4 ${isSupportMode ? "text-blue-600" : "text-emerald-600"}`} />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-bl-md p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto">
        {isSupportMode ? (
          [
            { label: "Help Center", href: "/help" },
            { label: "FAQs", href: "/help/faq" },
            { label: "Contact", href: "/help/contact" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex-shrink-0 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-slate-200 transition-colors"
            >
              {link.label}
            </Link>
          ))
        ) : (
          [
            "Check availability for next weekend",
            "Hold site 12 for June 10-12",
            "Show high occupancy dates",
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setPartnerInput(prompt)}
              className="flex-shrink-0 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-slate-200 transition-colors"
            >
              {prompt}
            </button>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200">
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
            placeholder={isSupportMode ? "Ask a question..." : "Ask for availability, holds, or drafts..."}
            className={`flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 text-sm ${
              isSupportMode ? "focus:ring-blue-500/20 focus:border-blue-500" : "focus:ring-emerald-500/20 focus:border-emerald-500"
            }`}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!activeInput.trim() || isPending}
            className={`p-2 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isSupportMode ? "bg-blue-500 hover:bg-blue-600" : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
