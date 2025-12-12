"use client";

import Link from "next/link";
import { Code2, BookOpen, PlugZap, ShieldCheck } from "lucide-react";

export default function DevelopersPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
          Public API (preview)
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Camp Everyday API</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Lightweight REST APIs to search campgrounds, manage reservations, and sync availability. Built for partners and operators.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {[
          {
            icon: Code2,
            title: "REST + JSON",
            desc: "Simple REST endpoints with JSON responses; versioned and documented.",
          },
          {
            icon: ShieldCheck,
            title: "Secure access",
            desc: "Token-based auth with per-organization scoping. HTTPS required.",
          },
          {
            icon: PlugZap,
            title: "Key endpoints",
            desc: "Campgrounds, availability, reservations, guests, and payments (roadmap).",
          },
          {
            icon: BookOpen,
            title: "Docs & examples",
            desc: "OpenAPI spec and code snippets for JS/TS, Python, and cURL.",
          },
        ].map((item) => (
          <div key={item.title} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex gap-4">
            <div className="h-12 w-12 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <item.icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Get started</h2>
        <ol className="list-decimal list-inside space-y-2 text-slate-700">
          <li>Sign in as staff and generate an API token (coming soon in Settings &gt; Developer).</li>
          <li>Use the token as a Bearer header: <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">Authorization: Bearer &lt;token&gt;</code></li>
          <li>Explore the OpenAPI spec to see endpoints and payloads.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs/api/openapi.json"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            View OpenAPI (JSON)
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 hover:bg-emerald-100"
          >
            Request partner access
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          Note: API access is in preview; endpoints and auth scopes may change before GA.
        </p>
      </div>
    </div>
  );
}
