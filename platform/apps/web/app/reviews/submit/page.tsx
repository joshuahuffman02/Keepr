"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

function ReviewSubmitContent() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [rating, setRating] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: { token: string; rating: number; title?: string; body?: string }) => apiClient.submitReview(payload),
    onSuccess: () => setSubmitted(true)
  });

  if (!token) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-6">
        <h1 className="text-2xl font-semibold text-foreground">Invalid review link</h1>
        <p className="text-muted-foreground mt-2">This review link is missing a token.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-6 text-center">
        <h1 className="text-3xl font-bold text-emerald-600 mb-2">Thank you!</h1>
        <p className="text-muted-foreground">Your review was submitted for moderation.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <h1 className="text-3xl font-bold text-foreground mb-6">Share your experience</h1>
      <div className="mb-4">
        <label className="block text-sm font-medium text-foreground mb-2">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              onClick={() => setRating(val)}
              className={`h-12 w-12 rounded-full border text-lg font-semibold ${rating === val ? "bg-amber-500 text-white border-amber-500" : "border-border text-foreground"}`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-foreground mb-2">Title (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          placeholder="A quick headline"
        />
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">Details (optional)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          placeholder="What did you enjoy? What could be improved?"
        />
      </div>
      <button
        disabled={rating === null || mutation.isPending}
        onClick={() => {
          if (rating === null) return;
          mutation.mutate({
            token,
            rating,
            title: title.trim() || undefined,
            body: body.trim() || undefined
          });
        }}
        className="inline-flex items-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
      >
          {mutation.isPending ? "Submitting..." : "Submit review"}
      </button>
      {mutation.error ? (
        <p className="text-sm text-red-600 mt-3">{(mutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}

export default function ReviewSubmitPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto py-10 px-6 text-muted-foreground">Loading…</div>}>
      <ReviewSubmitContent />
    </Suspense>
  );
}

