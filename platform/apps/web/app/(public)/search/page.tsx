import { Metadata } from "next";
import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SemanticSearchResults } from "./SemanticSearchResults";

export const metadata: Metadata = {
  title: "Search Campgrounds | Keepr",
  description: "Find the perfect campground using natural language search",
};

interface PageProps {
  searchParams: { q?: string };
}

export default function SearchPage({ searchParams }: PageProps) {
  const query = searchParams.q || "";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <Link href="/camping" className="text-emerald-200 hover:text-white mb-4 inline-block">
            ← Back to Browse
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-6 w-6 text-emerald-300" />
            <h1 className="text-3xl font-bold text-white">AI-Powered Campground Search</h1>
          </div>
          <p className="text-emerald-100 text-lg">
            {query ? (
              <>
                Results for: <span className="font-semibold">&quot;{query}&quot;</span>
              </>
            ) : (
              "Use natural language to find your perfect campground"
            )}
          </p>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {query ? (
          <SemanticSearchResults query={query} />
        ) : (
          <div className="bg-white rounded-xl p-12 text-center">
            <Sparkles className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Try Natural Language Search</h2>
            <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
              Search using natural language like &quot;RV camping near lakes&quot;, &quot;primitive
              camping in the mountains&quot;, or &quot;family-friendly campgrounds with pools&quot;
            </p>
            <Button asChild size="lg">
              <Link href="/camping">Start Searching</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
