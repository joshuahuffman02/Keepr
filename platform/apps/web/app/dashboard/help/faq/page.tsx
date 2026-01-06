"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BookOpen, HelpCircle, MessageCircle, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  link?: string;
}

const faqs: FAQItem[] = [
  {
    id: "payment-failed",
    question: "A payment failed at check-in. What should I try first?",
    answer: "Re-enter the card, try a smaller amount, and confirm your payment terminal is online. If the guest has another card, authorize $1 first. For persistent errors, capture the error code and submit a ticket on /dashboard/help/contact.",
    category: "Payments",
    tags: ["payments", "check-in", "terminal", "troubleshooting"],
    link: "/dashboard/help?query=troubleshooting"
  },
  {
    id: "report-export",
    question: "How do I export a report to CSV?",
    answer: "Go to Reports, open the desired view, then click Export > CSV. Saved views remember your filters. For scheduled exports, set up weekly emails under Settings > Reports.",
    category: "Reports",
    tags: ["reports", "export", "csv", "analytics"],
    link: "/dashboard/help?query=reporting"
  },
  {
    id: "winterization",
    question: "What is the winterization checklist?",
    answer: "Blow out water lines, wrap exposed pipes, shut down bathhouses, secure pedestals, and document with photos. See Seasonal Operations in the help center for the full step list.",
    category: "Seasonal Operations",
    tags: ["winterization", "seasonal", "maintenance"],
    link: "/dashboard/help?query=winterization"
  },
  {
    id: "wifi",
    question: "Guests report slow WiFi. How can I help them?",
    answer: "Ask them to forget/rejoin the network, move closer to the nearest access point, and avoid streaming on multiple devices. Reboot access points weekly during peak season and keep SSID/password visible on maps and confirmation emails.",
    category: "Technology",
    tags: ["wifi", "network", "support"],
    link: "/dashboard/help?query=wifi"
  },
  {
    id: "no-show",
    question: "How do we handle no-show reservations?",
    answer: "Wait at least 2 hours after check-in time, call/text the guest, then mark as No Show to free the site. Charge the first night per policy and document attempts to reach the guest.",
    category: "Reservations",
    tags: ["no-show", "policy", "front desk"],
    link: "/dashboard/help?query=no-show"
  },
  {
    id: "group-booking",
    question: "How do I keep group sites together?",
    answer: "Create the primary reservation, then add linked sites with the Group function. Block nearby sites under the group name until guest details are provided. Apply the group discount and collect a deposit from the organizer.",
    category: "Groups & Events",
    tags: ["groups", "events", "reservations"],
    link: "/dashboard/help?query=group"
  },
  {
    id: "changelog",
    question: "Where can I see recent product changes?",
    answer: "Check the What's New / Changelog page for weekly releases. We highlight role-specific updates so you can update your SOPs quickly.",
    category: "Product Updates",
    tags: ["changelog", "releases", "updates"],
    link: "/dashboard/help/changelog"
  },
  {
    id: "training",
    question: "Do you offer staff training resources?",
    answer: "Yes. Use the tutorials library for quick starts, the documentation center for role-based guides, and request a live onboarding session via the contact form.",
    category: "Training",
    tags: ["training", "onboarding", "videos"],
    link: "/dashboard/help/tutorials"
  }
];

export default function FAQPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = Array.from(new Set(faqs.map((f) => f.category)));

  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesCategory = category === "all" || faq.category === category;
      const matchesSearch =
        search.trim() === "" ||
        faq.question.toLowerCase().includes(search.toLowerCase()) ||
        faq.answer.toLowerCase().includes(search.toLowerCase()) ||
        faq.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  const suggestedSearches = ["payments", "reports", "wifi", "winterization", "group reservations"];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Help", href: "/dashboard/help" },
            { label: "FAQ" }
          ]}
        />

        <div className="card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Frequently Asked Questions</h1>
              <p className="text-slate-600">Quick answers to the questions we hear most often.</p>
            </div>
            <div className="px-3 py-1.5 bg-status-success/15 border border-status-success rounded-lg text-sm text-status-success font-semibold">
              {filteredFaqs.length} item{filteredFaqs.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FAQ (e.g. payments, reports, wifi)"
              className="w-full pl-12 pr-4 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-700 uppercase">Category</span>
            <button
              onClick={() => setCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                category === "all" ? "bg-status-success/15 text-status-success" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  category === cat ? "bg-status-success/15 text-status-success" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-slate-500">Try:</span>
            {suggestedSearches.map((term) => (
              <button
                key={term}
                onClick={() => setSearch(term)}
                className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs hover:bg-slate-200 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-6">
          {filteredFaqs.length === 0 ? (
            <div className="text-center">
              <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No answers yet. Try another search or contact support.</p>
              <Link href="/dashboard/help/contact" className="inline-flex items-center gap-2 mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-semibold">
                <MessageCircle className="h-4 w-4" />
                Open a ticket
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFaqs.map((faq) => (
                <details key={faq.id} className="group border border-slate-200 rounded-lg px-4 py-3">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-emerald-600" />
                      <span className="font-semibold text-slate-900">{faq.question}</span>
                    </div>
                    <Sparkles className="h-4 w-4 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="mt-3 text-sm text-slate-700">
                    {faq.answer}
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {faq.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">#{tag}</span>
                    ))}
                    {faq.link && (
                      <Link href={faq.link} className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold">
                        <MessageCircle className="h-4 w-4" />
                        Learn more
                      </Link>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
