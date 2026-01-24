"use client";

import Link from "next/link";
import { Sparkles, Users, TrendingUp, MessageSquare } from "lucide-react";

// Case studies - to be populated with real customer success stories
const studies = [
  {
    id: "example-rv",
    name: "50-Site RV Resort",
    impact: "+18% revenue",
    summary: "Dynamic pricing + online check-in reduced lines and lifted ADR.",
  },
  {
    id: "example-cabins",
    name: "Cabin & Glamping Property",
    impact: "-27% no-shows",
    summary: "Automated pre-arrival messaging and deposits cut no-shows and late arrivals.",
  },
  {
    id: "example-campground",
    name: "Family Campground",
    impact: "2x upsells",
    summary: "POS + guest portal increased firewood, late checkout, and rental upsells.",
  },
];

export default function CaseStudiesClient() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
          Proof from the field
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Case Studies</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          How campgrounds use Keepr to boost revenue, smooth operations, and delight guests.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {studies.map((study) => (
          <div
            key={study.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-900">{study.name}</h3>
              </div>
              <span className="text-sm font-semibold text-emerald-700">{study.impact}</span>
            </div>
            <p className="text-slate-600 text-sm">{study.summary}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" /> Ops + Front desk
              </span>
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> Revenue + upsells
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-4 w-4" /> Guest comms
              </span>
            </div>
            <Link
              href="/contact"
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
            >
              Talk with us →
            </Link>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Want your story featured?</h2>
        <p className="text-slate-600 text-sm">
          We're collecting more case studies as we expand. Share your goals and we'll tailor a
          rollout plan for your park.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
        >
          Share your story
        </Link>
      </div>
    </div>
  );
}
