"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

function NpsRespondContent() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: { token: string; score: number; comment?: string }) =>
      apiClient.respondNps(payload),
    onSuccess: () => setSubmitted(true),
  });

  if (!token) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-6">
        <h1 className="text-2xl font-semibold text-slate-900">Invalid link</h1>
        <p className="text-slate-600 mt-2">This NPS link is missing a token.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-6 text-center">
        <h1 className="text-3xl font-bold text-emerald-600 mb-2">Thanks for your feedback!</h1>
        <p className="text-slate-600">We appreciate your time.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">
        How likely are you to recommend us?
      </h1>
      <div className="grid grid-cols-11 gap-2 mb-4">
        {Array.from({ length: 11 }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => setScore(idx)}
            className={`h-12 rounded-md border text-sm font-semibold ${score === idx ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300 text-slate-700 hover:border-emerald-400"}`}
          >
            {idx}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-500 mb-6">0 = Not at all likely, 10 = Extremely likely</p>
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Tell us more (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          placeholder="What worked well? What could we improve?"
        />
      </div>
      <button
        disabled={score === null || mutation.isPending}
        onClick={() => {
          if (score === null) return;
          mutation.mutate({ token, score, comment: comment.trim() || undefined });
        }}
        className="inline-flex items-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
      >
        {mutation.isPending ? "Submitting..." : "Submit feedback"}
      </button>
      {mutation.error ? (
        <p className="text-sm text-red-600 mt-3">
          {mutation.error instanceof Error ? mutation.error.message : "Something went wrong."}
        </p>
      ) : null}
    </div>
  );
}

export default function NpsRespondPage() {
  return (
    <Suspense
      fallback={<div className="max-w-2xl mx-auto py-10 px-6 text-slate-500">Loading…</div>}
    >
      <NpsRespondContent />
    </Suspense>
  );
}
