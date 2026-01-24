"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Loader2, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  state: string | null;
  similarity: number;
}

export function SemanticSearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function search() {
      if (!query.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await apiClient.searchCampgroundsSemantic(query, 20);
        setResults(data.results);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search campgrounds. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    search();
  }, [query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-lg text-slate-600">Searching campgrounds...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <div className="text-slate-400 mb-4">
          <Sparkles className="h-16 w-16 mx-auto" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No results found</h3>
        <p className="text-slate-600">
          Try different search terms or browse campgrounds by location
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 mb-4">
        Found {results.length} campground{results.length === 1 ? "" : "s"} matching your search
      </p>

      <div className="grid gap-4">
        {results.map((result) => (
          <Link
            key={result.id}
            href={`/park/${result.slug}`}
            className="block bg-white rounded-xl p-6 border border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-emerald-600">
                  {result.name}
                </h3>

                {(result.city || result.state) && (
                  <div className="flex items-center gap-2 text-slate-600 mb-3">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {result.city && result.state
                        ? `${result.city}, ${result.state}`
                        : result.state || result.city}
                    </span>
                  </div>
                )}

                {result.description && (
                  <div
                    className="text-slate-600 text-sm line-clamp-2"
                    dangerouslySetInnerHTML={{
                      __html: result.description.replace(/<[^>]*>/g, ""),
                    }}
                  />
                )}
              </div>

              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-600">
                    {Math.round(result.similarity * 100)}% match
                  </span>
                </div>
                <span className="text-sm text-emerald-600 font-medium">View Details →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
