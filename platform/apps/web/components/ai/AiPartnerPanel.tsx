"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Bot, Send, ShieldCheck, User } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

type PartnerMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionDrafts?: ActionDraft[];
  confirmations?: { id: string; prompt: string }[];
  denials?: { reason: string; guidance?: string }[];
  questions?: string[];
  evidenceLinks?: EvidenceLink[];
};

const STATUS_VARIANTS: Record<ActionDraft["status"], "warning" | "success" | "error"> = {
  draft: "warning",
  executed: "success",
  denied: "error",
};

const IMPACT_VARIANTS: Record<ImpactSummary["level"], "success" | "warning" | "error"> = {
  low: "success",
  medium: "warning",
  high: "error",
};

const ACTION_LABELS: Record<string, string> = {
  lookup_availability: "Lookup availability",
  create_hold: "Create hold",
  move_reservation: "Move reservation",
  adjust_rate: "Adjust rate",
};

function formatValue(value: any) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const serialized = JSON.stringify(value);
  if (!serialized) return "-";
  return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
}

export function AiPartnerPanel({ campgroundId, enabled = true }: { campgroundId: string; enabled?: boolean }) {
  const [messages, setMessages] = useState<PartnerMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(() => `partner_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const endRef = useRef<HTMLDivElement>(null);

  const history = useMemo(
    () => messages.map((msg) => ({ role: msg.role, content: msg.content })),
    [messages]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: (payload: { message: string; history: { role: "user" | "assistant"; content: string }[] }) =>
      apiClient.aiPartnerChat(campgroundId, {
        sessionId,
        message: payload.message,
        history: payload.history,
      }),
    onSuccess: (data) => {
      const assistantMessage: PartnerMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data?.message || "I can draft an action if you describe the task.",
        actionDrafts: data?.actionDrafts,
        confirmations: data?.confirmations,
        denials: data?.denials,
        questions: data?.questions,
        evidenceLinks: data?.evidenceLinks,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      console.error("AI partner chat failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: "I couldn't reach the AI partner right now. Try again in a moment.",
        },
      ]);
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending || !enabled) return;
    const userMessage: PartnerMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate({ message: trimmed, history });
    setInput("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const renderEvidenceLinks = (links?: EvidenceLink[]) => {
    if (!links?.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {links.map((link) => (
          <Link
            key={`${link.label}-${link.url}`}
            href={link.url}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
          >
            {link.label}
          </Link>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          AI Partner (Staff)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Ask for availability checks, temporary holds, or operational guidance. Drafted actions include impact summaries and confirmation prompts.
        </div>

        {!enabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Enable Reply Assist to activate the AI partner for staff.
          </div>
        )}

        <div className="h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Try: "Hold site 12 for June 10-12" or "What is availability for July 4 weekend?"
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                    <Bot className="h-4 w-4 text-emerald-600" />
                  </div>
                )}
                <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm", msg.role === "user" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-900")}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {msg.denials?.length ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      <div className="font-semibold">Denied</div>
                      {msg.denials.map((denial, idx) => (
                        <div key={`${denial.reason}-${idx}`} className="mt-1">
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
                            onClick={() => setInput(question)}
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
                      {msg.actionDrafts.map((draft) => (
                        <div key={draft.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">
                              {ACTION_LABELS[draft.actionType] || draft.actionType}
                            </div>
                            <div className="flex items-center gap-2">
                              {draft.requiresConfirmation && (
                                <Badge variant="warning" className="capitalize">
                                  Needs confirmation
                                </Badge>
                              )}
                              <Badge variant={STATUS_VARIANTS[draft.status]} className="capitalize">
                                {draft.status}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline">Action: {draft.action}</Badge>
                            <Badge variant="outline">Resource: {draft.resource}</Badge>
                            {draft.sensitivity && <Badge variant="outline">Sensitivity: {draft.sensitivity}</Badge>}
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
                            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-700">Impact</span>
                                <Badge variant={IMPACT_VARIANTS[draft.impact.level]} className="capitalize">
                                  {draft.impact.level}
                                </Badge>
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
                            <div className="mt-2 text-slate-600">
                              Result: {formatValue(draft.result)}
                            </div>
                          )}

                          {renderEvidenceLinks(draft.evidenceLinks)}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {msg.confirmations?.length ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {msg.confirmations.map((confirmation) => (
                        <div key={confirmation.id}>{confirmation.prompt}</div>
                      ))}
                    </div>
                  ) : null}

                  {renderEvidenceLinks(msg.evidenceLinks)}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                    <User className="h-4 w-4 text-slate-600" />
                  </div>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <Bot className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
                  Thinking...
                </div>
              </div>
            )}
          </div>
          <div ref={endRef} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI partner to check availability, place a hold, or draft a change..."
            className="min-h-[84px] bg-white"
            disabled={chatMutation.isPending || !enabled}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Press Enter to send, Shift+Enter for a new line.</span>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending || !enabled}
            >
              Send
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
