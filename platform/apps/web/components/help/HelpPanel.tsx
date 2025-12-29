"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAllTopics, getContextTopics, searchTopics, getPopularTopics } from "@/lib/help";
import type { HelpTopic } from "@/content/help/topics";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { useToast } from "../ui/use-toast";
import { useWhoami } from "@/hooks/use-whoami";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

type HelpPanelProps = {
  open: boolean;
  onClose: () => void;
};

type Feedback = { helpful: boolean; note?: string };

type TicketSubmitter = {
  id: string | null;
  name: string | null;
  email: string | null;
};

type DeviceType = "mobile" | "desktop" | "tablet";

type TicketClient = {
  userAgent: string;
  platform: string | null;
  language: string | null;
  deviceType: DeviceType;
};

type WhoamiUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string;
};

type WhoamiData = {
  user?: WhoamiUser;
  id?: string;
  email?: string;
  name?: string;
};

const LS_PINS = "campreserv:help:pins";
const LS_RECENT = "campreserv:help:recent";
const LS_FEEDBACK = "campreserv:help:feedback";
const LS_ROLE = "campreserv:help:role";

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportDescription, setReportDescription] = useState("");
  const [reportSteps, setReportSteps] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { data: whoami } = useWhoami();

  useEffect(() => {
    try {
      setPinnedIds(JSON.parse(localStorage.getItem(LS_PINS) || "[]"));
      setRecentIds(JSON.parse(localStorage.getItem(LS_RECENT) || "[]"));
      setFeedback(JSON.parse(localStorage.getItem(LS_FEEDBACK) || "{}"));
      const storedRole = localStorage.getItem(LS_ROLE);
      if (storedRole) setRoleFilter(storedRole);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_PINS, JSON.stringify(pinnedIds));
    } catch {
      // ignore
    }
  }, [pinnedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_RECENT, JSON.stringify(recentIds));
    } catch {
      // ignore
    }
  }, [recentIds]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_FEEDBACK, JSON.stringify(feedback));
    } catch {
      // ignore
    }
  }, [feedback]);

  useEffect(() => {
    if (roleFilter) {
      localStorage.setItem(LS_ROLE, roleFilter);
    } else {
      localStorage.removeItem(LS_ROLE);
    }
  }, [roleFilter]);

  // AI search when static results are insufficient
  const fetchAiHelp = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setAiResponse(null);
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/support/help-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}`,
        },
        body: JSON.stringify({
          query: searchQuery,
          context: pathname || "/",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.answer || null);
      } else {
        // Fallback response when AI endpoint doesn't exist
        setAiResponse(
          "I couldn't find a specific answer for that. Try browsing the topics below or submit a support ticket for personalized help."
        );
      }
    } catch (err) {
      console.error("AI search error:", err);
      setAiResponse(null);
    } finally {
      setAiLoading(false);
    }
  }, [pathname]);

  // Trigger AI search when static results < 3 (with debounce)
  useEffect(() => {
    if (aiSearchTimeout.current) {
      clearTimeout(aiSearchTimeout.current);
    }

    // Clear AI response when query changes
    setAiResponse(null);

    // Only trigger AI if query exists and static results are insufficient
    if (query && query.length >= 3) {
      const staticResults = searchTopics(query, 50);
      const filteredResults = roleFilter
        ? staticResults.filter((t) => !t.roles || t.roles.includes(roleFilter))
        : staticResults;

      if (filteredResults.length < 3) {
        aiSearchTimeout.current = setTimeout(() => {
          fetchAiHelp(query);
        }, 500); // 500ms debounce
      }
    }

    return () => {
      if (aiSearchTimeout.current) {
        clearTimeout(aiSearchTimeout.current);
      }
    };
  }, [query, roleFilter, fetchAiHelp]);

  const roleFilterTopics = useCallback(
    (topics: HelpTopic[]) => (roleFilter ? topics.filter((t) => !t.roles || t.roles.includes(roleFilter)) : topics),
    [roleFilter]
  );

  const contextTopics = useMemo(() => roleFilterTopics(getContextTopics(pathname || "/")), [pathname, roleFilterTopics]);
  const searchResults = useMemo(() => roleFilterTopics(query ? searchTopics(query, 50) : []), [query, roleFilterTopics]);
  const popular = useMemo(() => roleFilterTopics(getPopularTopics(6)), [roleFilterTopics]);

  const taskShortcuts = useMemo(() => (contextTopics.length ? contextTopics.slice(0, 3) : popular.slice(0, 3)), [contextTopics, popular]);

  const emptyState = query && searchResults.length === 0;

  const allTopics = useMemo(() => roleFilterTopics(getAllTopics()), [roleFilterTopics]);

  const pinnedTopics = useMemo(() => allTopics.filter((t) => pinnedIds.includes(t.id)), [allTopics, pinnedIds]);
  const recentTopics = useMemo(
    () => recentIds.map((id) => allTopics.find((t) => t.id === id)).filter(Boolean) as HelpTopic[],
    [recentIds, allTopics]
  );

  const visibleTopics = query ? searchResults : contextTopics.length ? contextTopics : popular;

  const togglePin = (id: string) => {
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev].slice(0, 12)));
  };

  const recordRecent = (id: string) => {
    setRecentIds((prev) => [id, ...prev.filter((r) => r !== id)].slice(0, 12));
  };

  const copyLink = async (id: string) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/help#${id}` : `/help#${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleFeedback = (id: string, helpful: boolean) => {
    setFeedback((prev) => ({ ...prev, [id]: { helpful } }));
  };

  const collectContext = () => {
    if (typeof window === "undefined") return {};
    const nav = navigator;
    return {
      path: pathname || "/",
      query,
      roleFilter,
      pinnedIds,
      recentIds,
      userAgent: nav.userAgent,
      language: nav.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      selectedCampground: localStorage.getItem("campreserv:selectedCampground") || null,
      now: new Date().toISOString()
    };
  };

  const submitReport = async () => {
    const description = reportDescription.trim();
    const steps = reportSteps.trim();
    const contact = reportEmail.trim();

    if (!description) {
      toast({ title: "Add a short description", description: "Tell us what went wrong.", variant: "destructive" });
      return;
    }

    const whoamiData = whoami as WhoamiData | undefined;
    const submitter: TicketSubmitter = {
      id: whoamiData?.id ?? whoamiData?.user?.id ?? null,
      name:
        whoamiData?.name ??
        whoamiData?.user?.name ??
        whoamiData?.user?.firstName ??
        whoamiData?.email ??
        whoamiData?.user?.email ??
        null,
      email: whoamiData?.email ?? whoamiData?.user?.email ?? null
    };

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const platform = typeof navigator !== "undefined" ? (navigator.platform as string | undefined) ?? null : null;
    const language = typeof navigator !== "undefined" ? navigator.language ?? null : null;

    const detectDeviceType = (userAgent: string): DeviceType => {
      const lower = userAgent.toLowerCase();
      if (/ipad|tablet/.test(lower)) return "tablet";
      if (/mobi|android|iphone/.test(lower)) return "mobile";
      return "desktop";
    };
    const deviceType = detectDeviceType(ua);

    const notesParts = [
      steps ? `Steps/details:\n${steps}` : null,
      contact ? `Contact: ${contact}` : null
    ].filter(Boolean);

    const payload = {
      title: description,
      notes: notesParts.join("\n\n"),
      url: typeof window !== "undefined" ? window.location.href : undefined,
      path: pathname || undefined,
      pageTitle: typeof document !== "undefined" ? document.title : undefined,
      userAgent: ua,
      submitter,
      client: {
        userAgent: ua,
        platform,
        language,
        deviceType
      },
      extra: {
        source: "help-panel",
        contact: contact || undefined,
        context: collectContext()
      }
    };

    try {
      await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast({ title: "Thanks! Issue submitted", description: "We captured page and browser context." });
      setIsReportOpen(false);
      setReportDescription("");
      setReportSteps("");
      setReportEmail("");
    } catch (err: any) {
      toast({ title: "Could not submit", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  const renderTopic = (topic: HelpTopic) => {
    const isPinned = pinnedIds.includes(topic.id);
    const fb = feedback[topic.id];
    return (
      <div key={topic.id} className="border border-slate-200 rounded-lg p-3 hover:border-emerald-500 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">{topic.title}</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{topic.category}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{topic.summary}</p>
        <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
          {topic.steps.slice(0, 3).map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1">
          {topic.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <Link
            href={`/help#${topic.id}`}
            onClick={() => recordRecent(topic.id)}
            className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Open details
            <ArrowUpRightIcon />
          </Link>
          <button
            onClick={() => copyLink(topic.id)}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
            title="Copy link"
          >
            <CopyIcon />
          </button>
          <button
            onClick={() => {
              togglePin(topic.id);
              recordRecent(topic.id);
            }}
            className={`inline-flex items-center gap-1 ${isPinned ? "text-amber-600" : "text-slate-500 hover:text-slate-700"}`}
            title={isPinned ? "Unpin" : "Pin for quick access"}
          >
            <PinIcon filled={isPinned} />
            {isPinned ? "Pinned" : "Pin"}
          </button>
          <div className="ml-auto flex items-center gap-1 text-slate-500">
            <span className="text-[11px] uppercase">Helpful?</span>
            <button
              onClick={() => handleFeedback(topic.id, true)}
              className={`p-1 rounded ${fb?.helpful === true ? "text-emerald-600 bg-emerald-50" : "hover:bg-slate-100"}`}
              title="Helpful"
            >
              👍
            </button>
            <button
              onClick={() => handleFeedback(topic.id, false)}
              className={`p-1 rounded ${fb?.helpful === false ? "text-rose-600 bg-rose-50" : "hover:bg-slate-100"}`}
              title="Not helpful"
            >
              👎
            </button>
          </div>
        </div>
        {fb && (
          <div className="mt-2 text-[11px] text-slate-500">
            {fb.helpful ? "Thanks! We’ll keep this handy." : "Thanks for the flag. We’ll tune this guide."}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-50 transition-pointer-events ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />

      <div
        className={`absolute top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900">Help & guidance</div>
            <p className="text-xs text-slate-500">
              Contextual tips for <span className="font-medium">{pathname || "/"}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" aria-label="Close help">
            <CloseIcon />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 space-y-2">
          <label className="relative block">
            <span className="absolute left-3 top-2.5 text-slate-400">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search how-tos, e.g. refunds, pricing rules, OTA"
              className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">Context</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5">{pathname || "/"}</span>
            <span className="text-slate-400">|</span>
            <Link href="/help" className="text-emerald-600 font-semibold hover:text-emerald-700">
              Open full help
            </Link>
            <span className="text-slate-400">|</span>
            <span className="font-semibold text-slate-600">Role</span>
            {["owner", "manager", "frontdesk", "maintenance", "finance", "marketing"].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                className={`px-2 py-0.5 rounded-full border text-[11px] ${
                  roleFilter === role ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="font-semibold text-slate-600">Tasks</span>
            {taskShortcuts.map((t) => (
              <button
                key={t.id}
                onClick={() => setQuery(t.title)}
                className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                {t.title}
              </button>
            ))}
            <button
              onClick={() => setIsReportOpen(true)}
              className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
            >
              Report an issue
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {pinnedTopics.length > 0 && !query && (
            <section>
              <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Pinned</div>
              <div className="grid grid-cols-1 gap-3">{pinnedTopics.map(renderTopic)}</div>
            </section>
          )}

          {recentTopics.length > 0 && !query && (
            <section>
              <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Recently viewed</div>
              <div className="grid grid-cols-1 gap-3">{recentTopics.map(renderTopic)}</div>
            </section>
          )}

          {/* AI Response Section */}
          {query && (aiLoading || aiResponse) && (
            <section className="mb-4">
              <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <AiSparklesIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                      AI Assistant
                    </div>
                    {aiLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        </div>
                        Searching for an answer...
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{aiResponse}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {emptyState && !aiLoading && !aiResponse && (
            <div className="text-sm text-slate-600">
              No results for <span className="font-semibold">"{query}"</span>. Try a different keyword or browse below.
            </div>
          )}

          {!query && contextTopics.length > 0 && (
            <section>
              <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Relevant to this page</div>
              <div className="grid grid-cols-1 gap-3">{contextTopics.map(renderTopic)}</div>
            </section>
          )}

          {query && searchResults.length > 0 && (
            <section>
              <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Search results</div>
              <div className="grid grid-cols-1 gap-3">{searchResults.map(renderTopic)}</div>
            </section>
          )}

          {!query && (
            <section>
              <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Popular</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{popular.map(renderTopic)}</div>
            </section>
          )}

          {!query && (
            <section>
              <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Browse all</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allTopics.map((topic) => (
                  <Link
                    href={`/help#${topic.id}`}
                    key={topic.id}
                    onClick={() => recordRecent(topic.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-500 text-sm text-slate-700"
                  >
                    <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded">{topic.category}</span>
                    <span className="truncate">{topic.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
        <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Report an issue</DialogTitle>
              <DialogDescription>We’ll capture page and browser context automatically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">What went wrong?</label>
                <Textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Briefly describe the issue you hit."
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Steps or details (optional)</label>
                <Textarea
                  value={reportSteps}
                  onChange={(e) => setReportSteps(e.target.value)}
                  placeholder="Steps to reproduce, expected vs actual, error text, etc."
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Contact (optional)</label>
                <Input
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  placeholder="Email to follow up"
                  type="email"
                />
              </div>
              <p className="text-xs text-slate-500">
                We’ll send page URL, browser info, timezone, viewport, role filter, pinned/recent topics, and selected campground to help troubleshoot.
              </p>
            </div>
            <DialogFooter className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsReportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitReport}>Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 16.5 4 4" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M10 7h7v7" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PinIcon({ filled }: { filled?: boolean }) {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill={filled ? "currentColor" : "none"} strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17v5M9 3h6l-1 7h-4zM7 10h10" />
    </svg>
  );
}

function AiSparklesIcon() {
  return (
    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3L14 9H20L15 13L17 19L12 15L7 19L9 13L4 9H10L12 3Z" />
    </svg>
  );
}
