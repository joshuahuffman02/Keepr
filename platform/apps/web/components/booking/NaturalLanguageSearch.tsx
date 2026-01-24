"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Search,
  Sparkles,
  Calendar,
  MapPin,
  Loader2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  DollarSign,
  Users,
  PawPrint,
  Accessibility,
  Wifi,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type NLSearchResponse = Awaited<ReturnType<typeof apiClient.naturalLanguageSearch>>;
type SearchIntent = NLSearchResponse["intent"];
type NLSearchResult = NLSearchResponse["results"][0];

interface NaturalLanguageSearchProps {
  slug: string;
  onApplyIntent: (intent: SearchIntent, results: NLSearchResult[]) => void;
  onSelectSite?: (siteId: string, dates: { arrivalDate: string; departureDate: string }) => void;
  className?: string;
}

const EXAMPLE_QUERIES = [
  "Pet-friendly RV site next weekend",
  "Waterfront cabin for 4 this Friday",
  "Tent site with hookups under $40/night",
  "Quiet spot away from the road",
  "ADA accessible site near bathhouse",
];

export function NaturalLanguageSearch({
  slug,
  onApplyIntent,
  onSelectSite,
  className,
}: NaturalLanguageSearchProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [sessionId] = useState(() => `nl-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchMutation = useMutation({
    mutationFn: (q: string) => apiClient.naturalLanguageSearch(slug, q, sessionId),
    onSuccess: () => {
      setShowResults(true);
    },
  });

  const handleSearch = () => {
    if (!query.trim() || query.length < 3) return;
    searchMutation.mutate(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    setShowExamples(false);
    // Auto-search after selecting example
    setTimeout(() => {
      searchMutation.mutate(example);
    }, 100);
  };

  const handleApplyResults = () => {
    if (searchMutation.data) {
      onApplyIntent(searchMutation.data.intent, searchMutation.data.results);
      setShowResults(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setShowResults(false);
    searchMutation.reset();
    inputRef.current?.focus();
  };

  // Format intent for display
  const formatIntent = (intent: SearchIntent) => {
    const parts: string[] = [];

    if (intent.arrivalDate && intent.departureDate) {
      const arr = new Date(intent.arrivalDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const dep = new Date(intent.departureDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      parts.push(`${arr} - ${dep}`);
    } else if (intent.nights) {
      parts.push(`${intent.nights} night${intent.nights > 1 ? "s" : ""}`);
    }

    if (intent.siteType) {
      parts.push(intent.siteType.charAt(0).toUpperCase() + intent.siteType.slice(1));
    }

    if (intent.adults || intent.children) {
      const guests = [];
      if (intent.adults) guests.push(`${intent.adults} adult${intent.adults > 1 ? "s" : ""}`);
      if (intent.children)
        guests.push(`${intent.children} child${intent.children > 1 ? "ren" : ""}`);
      parts.push(guests.join(", "));
    }

    return parts;
  };

  // Format amenity badges
  const getAmenityBadges = (intent: SearchIntent) => {
    const badges: { icon: React.ReactNode; label: string }[] = [];

    if (intent.petFriendly)
      badges.push({ icon: <PawPrint className="h-3 w-3" />, label: "Pet-friendly" });
    if (intent.accessible)
      badges.push({ icon: <Accessibility className="h-3 w-3" />, label: "Accessible" });
    if (intent.waterfront)
      badges.push({ icon: <MapPin className="h-3 w-3" />, label: "Waterfront" });
    if (intent.hookups?.power || intent.hookups?.water || intent.hookups?.sewer) {
      badges.push({ icon: <Wifi className="h-3 w-3" />, label: "Hookups" });
    }
    if (intent.maxPricePerNight) {
      badges.push({
        icon: <DollarSign className="h-3 w-3" />,
        label: `Under $${intent.maxPricePerNight}/night`,
      });
    }

    return badges;
  };

  return (
    <div className={cn("relative", className)}>
      {/* Search Input */}
      <div className="relative">
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-3 bg-card border-2 rounded-xl transition-all duration-200",
            searchMutation.isPending
              ? "border-emerald-300 shadow-lg shadow-emerald-100"
              : "border-border hover:border-border focus-within:border-emerald-500 focus-within:shadow-lg focus-within:shadow-emerald-100",
          )}
        >
          {searchMutation.isPending ? (
            <Loader2 className="h-5 w-5 text-emerald-500 animate-spin flex-shrink-0" />
          ) : (
            <Sparkles className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => !query && setShowExamples(true)}
            onBlur={() => setTimeout(() => setShowExamples(false), 200)}
            placeholder="Try: 'Pet-friendly RV site next weekend under $50'"
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            disabled={searchMutation.isPending}
          />

          {query && (
            <button
              onClick={handleClear}
              className="p-1 rounded-full text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={handleSearch}
            disabled={searchMutation.isPending || query.length < 3}
            className={cn(
              "px-4 py-1.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2",
              query.length >= 3
                ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>

        {/* AI Badge */}
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
          <Zap className="h-3 w-3" />
          AI-Powered
        </div>
      </div>

      {/* Example Queries Dropdown */}
      <AnimatePresence>
        {showExamples && !searchMutation.data && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-10 w-full mt-2 p-3 bg-card border border-border rounded-xl shadow-lg"
          >
            <p className="text-xs font-medium text-muted-foreground mb-2">Try these searches:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((example) => (
                <button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  className="px-3 py-1.5 bg-muted hover:bg-emerald-50 text-muted-foreground hover:text-emerald-700 text-sm rounded-lg border border-border hover:border-emerald-200 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Panel */}
      <AnimatePresence>
        {showResults && searchMutation.data && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-20 w-full mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          >
            {/* Interpretation Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">
                      I understood your search
                    </span>
                    {searchMutation.data.aiEnabled && (
                      <span className="px-1.5 py-0.5 bg-status-success-bg text-status-success-text text-xs rounded">
                        AI
                      </span>
                    )}
                  </div>

                  {searchMutation.data.intent.interpretedQuery && (
                    <p className="text-sm text-muted-foreground italic mb-2">
                      "{searchMutation.data.intent.interpretedQuery}"
                    </p>
                  )}

                  {/* Intent details */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {formatIntent(searchMutation.data.intent).map((part, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card rounded-full text-sm text-foreground border border-border"
                      >
                        {i === 0 && <Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
                        {part}
                      </span>
                    ))}
                  </div>

                  {/* Amenity badges */}
                  {getAmenityBadges(searchMutation.data.intent).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {getAmenityBadges(searchMutation.data.intent).map((badge, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-status-success-bg text-status-success-text text-xs rounded-full"
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowResults(false)}
                  className="p-1 rounded-full text-muted-foreground hover:text-muted-foreground hover:bg-card/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Clarification needed */}
              {searchMutation.data.intent.clarificationNeeded && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    {searchMutation.data.intent.clarificationNeeded}
                  </p>
                </div>
              )}
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto">
              {searchMutation.data.results.length > 0 ? (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {searchMutation.data.results.length} matching site
                    {searchMutation.data.results.length !== 1 ? "s" : ""}
                  </p>

                  {searchMutation.data.results.slice(0, 5).map((result, index) => (
                    <motion.div
                      key={result.site.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors group"
                      onClick={() => {
                        if (
                          onSelectSite &&
                          searchMutation.data.intent.arrivalDate &&
                          searchMutation.data.intent.departureDate
                        ) {
                          onSelectSite(result.site.id, {
                            arrivalDate: searchMutation.data.intent.arrivalDate,
                            departureDate: searchMutation.data.intent.departureDate,
                          });
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {result.site.name || result.site.siteNumber}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {result.site.siteClass?.name}
                            </span>
                          </div>

                          {/* Match reasons */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.matchReasons.slice(0, 3).map((reason, i) => (
                              <span key={i} className="text-xs text-emerald-600">
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="text-right">
                          {result.pricePerNight && (
                            <span className="font-semibold text-foreground">
                              ${(result.pricePerNight / 100).toFixed(0)}
                              <span className="text-xs text-muted-foreground font-normal">
                                /night
                              </span>
                            </span>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${Math.round(result.matchScore * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(result.matchScore * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {searchMutation.data.results.length > 5 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground text-center">
                      +{searchMutation.data.results.length - 5} more results
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground">No sites match your criteria</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your search</p>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="p-3 bg-muted border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Search took {searchMutation.data.searchDuration}ms
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowResults(false)}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyResults}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Apply & View Sites
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      <AnimatePresence>
        {searchMutation.isError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg"
          >
            <p className="text-sm text-red-700">
              {searchMutation.error instanceof Error
                ? searchMutation.error.message
                : "Search failed. Please try again."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
