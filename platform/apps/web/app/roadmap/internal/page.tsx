"use server";

import fs from "fs";
import path from "path";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";

async function loadDoc() {
  const docPath = path.join(process.cwd(), "docs", "roadmap-internal.md");
  return fs.promises.readFile(docPath, "utf-8");
}

function DocBlock({ content }: { content: string }) {
  return (
    <pre className="whitespace-pre-wrap bg-white border border-slate-200 rounded-xl p-4 text-sm leading-6 text-slate-800 shadow-sm">
      {content}
    </pre>
  );
}

export default async function RoadmapInternalDocPage() {
  const content = await loadDoc();

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumbs items={[{ label: "Roadmap", href: "/roadmap" }, { label: "Internal Doc" }]} />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">RV Hospitality Roadmap (Internal)</h1>
          <p className="text-slate-600">
            This is the detailed internal roadmap pulled from{" "}
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
              docs/roadmap-internal.md
            </code>
            .
          </p>
        </div>

        <DocBlock content={content} />
      </div>
    </DashboardShell>
  );
}
