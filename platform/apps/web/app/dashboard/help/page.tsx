"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { helpTopics, type HelpTopic } from "@/content/help/topics";
import { getContextTopics, searchTopics } from "@/lib/help";
import { useWhoami } from "@/hooks/use-whoami";

const LS_PINS = "campreserv:help:pins";
const LS_RECENT = "campreserv:help:recent";
const LS_ROLE = "campreserv:help:role";

export default function HelpPage() {
  const pathname = usePathname();
  const { data: whoami, isLoading: loadingWhoami, isError: whoamiError } = useWhoami();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    try {
      setPinnedIds(JSON.parse(localStorage.getItem(LS_PINS) || "[]"));
      setRecentIds(JSON.parse(localStorage.getItem(LS_RECENT) || "[]"));
      const storedRole = localStorage.getItem(LS_ROLE);
      if (storedRole) setRole(storedRole);
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
    if (role) {
      localStorage.setItem(LS_ROLE, role);
    } else {
      localStorage.removeItem(LS_ROLE);
    }
  }, [role]);

  const categories = useMemo(() => Array.from(new Set(helpTopics.map((t) => t.category))), []);

  const roleFilterTopics = useCallback((topics: HelpTopic[]) => (role ? topics.filter((t) => !t.roles || t.roles.includes(role)) : topics), [role]);

  const contextual = useMemo(() => roleFilterTopics(getContextTopics(pathname || "/")), [pathname, roleFilterTopics]);

  const filtered = useMemo(() => {
    let list: HelpTopic[] = roleFilterTopics(helpTopics);
    if (category) list = list.filter((t) => t.category === category);
    if (query.trim()) {
      const hits = searchTopics(query, 100);
      const ids = new Set(hits.map((h) => h.id));
      list = list.filter((t) => ids.has(t.id));
    }
    return list;
  }, [category, roleFilterTopics, query]);

  const popular = useMemo(() => roleFilterTopics(helpTopics.slice(0, 6)), [roleFilterTopics]);

  const pinnedTopics = useMemo(() => filteredByIds(roleFilterTopics(helpTopics), pinnedIds), [pinnedIds, roleFilterTopics]);
  const recentTopics = useMemo(() => filteredByIds(roleFilterTopics(helpTopics), recentIds), [recentIds, roleFilterTopics]);

  const recordRecent = (id: string) => {
    setRecentIds((prev) => [id, ...prev.filter((r) => r !== id)].slice(0, 12));
  };

  const togglePin = (id: string) => {
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev].slice(0, 12)));
  };

  const copyLink = async (id: string) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/dashboard/help#${id}` : `/dashboard/help#${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const emptySuggestions = useMemo(() => {
    if (!query.trim()) return popular;
    const alt = searchTopics(query, 5);
    return alt.length ? alt : popular;
  }, [query, popular]);

  const isStaff =
    !!whoami?.user?.memberships?.length ||
    !!whoami?.user?.ownershipRoles?.length ||
    !!whoami?.user?.platformRole;

  if (!loadingWhoami && (!whoami || whoamiError || !isStaff)) {
    return (
      <DashboardShell>
        <div className="max-w-2xl mx-auto card p-6 border border-amber-200 bg-amber-50">
          <div className="text-sm font-semibold text-amber-800 mb-2">Staff access required</div>
          <p className="text-slate-700 text-sm">
            Help content is available to campground staff. Please sign in with your staff account to continue.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/auth/signin?callbackUrl=/dashboard/help"
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
            >
              Sign in
            </Link>
            <Link href="/" className="px-4 py-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              Go to homepage
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (loadingWhoami) {
    return (
      <DashboardShell>
        <div className="card p-6 border border-slate-200">
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-5/6 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Help", href: "/dashboard/help" }
          ]}
        />

        <div className="card p-6 border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Help desk</div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Fast answers for every screen</h1>
              <p className="text-slate-600 mt-2 text-sm">Context-aware help. Short steps for front desk, deeper detail when needed. No videos.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(category === cat ? null : cat)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    category === cat ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[2fr,1fr]">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search how-tos, e.g. refunds, pricing rules, OTA mapping"
                className="w-full border border-slate-200 rounded-lg px-4 py-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Role filter</span>
              {["owner", "manager", "frontdesk", "maintenance", "finance", "marketing"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(role === r ? null : r)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    role === r ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {r}
                </button>
              ))}
              <button
                onClick={() => {
                  setRole(null);
                  setCategory(null);
                  setQuery("");
                }}
                className="ml-auto text-xs font-semibold text-slate-600 hover:text-emerald-700"
              >
                Reset
              </button>
            </div>
          </div>

          {contextual.length > 0 && (
            <div className="mt-4 border border-emerald-100 bg-emerald-50/50 rounded-lg p-3">
              <div className="text-xs font-semibold text-emerald-700 uppercase">Relevant to this page</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {contextual.map((topic) => (
                  <a
                    key={topic.id}
                    href={`#${topic.id}`}
                    onClick={() => recordRecent(topic.id)}
                    className="px-3 py-2 rounded-lg border border-emerald-100 bg-white text-sm text-slate-800 hover:border-emerald-300"
                  >
                    {topic.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Popular:</span>
            {popular.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setQuery(topic.title)}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition"
              >
                {topic.title}
              </button>
            ))}
          </div>
        </div>

        {pinnedTopics.length > 0 && (
          <section className="card p-4 border border-slate-200">
            <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Pinned</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pinnedTopics.map((topic) => (
                <HelpCard key={topic.id} topic={topic} onVisit={recordRecent} onPinToggle={togglePin} onCopy={copyLink} pinned />
              ))}
            </div>
          </section>
        )}

        {recentTopics.length > 0 && (
          <section className="card p-4 border border-slate-200">
            <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Recently viewed</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentTopics.map((topic) => (
                <HelpCard key={topic.id} topic={topic} onVisit={recordRecent} onPinToggle={togglePin} onCopy={copyLink} pinned={pinnedIds.includes(topic.id)} />
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-4">
          {filtered.map((topic) => (
            <HelpCard
              key={topic.id}
              topic={topic}
              onVisit={recordRecent}
              onPinToggle={togglePin}
              onCopy={copyLink}
              pinned={pinnedIds.includes(topic.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="card p-6 text-center text-slate-600 border border-slate-200 space-y-3">
              <div className="text-lg font-semibold text-slate-800">No results found</div>
              <p className="text-sm">Try a different search term or clear your filters.</p>
              <div className="flex items-center justify-center gap-2 flex-wrap text-sm">
                <button
                  onClick={() => {
                    setQuery("");
                    setCategory(null);
                    setRole(null);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                >
                  Reset filters
                </button>
                <span className="text-slate-500 text-xs uppercase">Suggestions</span>
                {emptySuggestions.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setQuery(t.title)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs text-slate-700"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function filteredByIds(topics: HelpTopic[], ids: string[]): HelpTopic[] {
  const idSet = new Set(ids);
  return ids.map((id) => topics.find((t) => t.id === id)).filter(Boolean) as HelpTopic[];
}

function HelpCard({
  topic,
  pinned,
  onPinToggle,
  onCopy,
  onVisit
}: {
  topic: HelpTopic;
  pinned?: boolean;
  onPinToggle?: (id: string) => void;
  onCopy?: (id: string) => void;
  onVisit?: (id: string) => void;
}) {
  const steps = topic.steps.slice(0, 5);

  return (
    <div id={topic.id} className="card p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">{topic.title}</h3>
            <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-600">{topic.category}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{topic.summary}</p>
          <div className="mt-3 space-y-2">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs">{idx + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          {topic.tips && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <div className="font-semibold text-amber-800 mb-1">Tips</div>
              <ul className="list-disc pl-5 space-y-1">
                {topic.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {topic.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">
                #{tag}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
            {topic.links?.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                {link.label}
                <ArrowIcon />
              </Link>
            ))}
            <Link
              href={`/dashboard/help#${topic.id}`}
              onClick={() => onVisit?.(topic.id)}
              className="inline-flex items-center gap-1 text-emerald-600 font-semibold"
            >
              Open
              <ArrowUpRightIcon />
            </Link>
            <button onClick={() => onCopy?.(topic.id)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700">
              <CopyIcon />
              Copy link
            </button>
            <button
              onClick={() => onPinToggle?.(topic.id)}
              className={`inline-flex items-center gap-1 ${pinned ? "text-amber-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              <PinIcon filled={pinned} />
              {pinned ? "Pinned" : "Pin"}
            </button>
            <Link href="/dashboard/help" className="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-700 ml-auto">
              Back to top
              <ArrowUpIcon />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 16.5 4 4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
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

function ArrowUpRightIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M10 7h7v7" />
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
