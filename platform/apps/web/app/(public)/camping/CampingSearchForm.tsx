"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";

export function CampingSearchForm() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Use semantic search for natural language queries
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try 'lakeside RV camping' or 'primitive sites near mountains'..."
          className="w-full pl-12 pr-4 py-4 rounded-xl text-lg border-2 border-transparent focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-medium flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Search
        </button>
      </div>
      <p className="text-center mt-3 text-sm text-emerald-200">
        ✨ AI-powered semantic search - search using natural language
      </p>
    </form>
  );
}
