"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, MapPin } from "lucide-react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
}

interface SearchFilters {
  location: string;
  dates: { checkIn: string; checkOut: string };
  guests: number;
}

// US States and popular camping destinations for autocomplete
const LOCATION_SUGGESTIONS = [
  // States
  { label: "Alabama", value: "AL", type: "state" },
  { label: "Alaska", value: "AK", type: "state" },
  { label: "Arizona", value: "AZ", type: "state" },
  { label: "Arkansas", value: "AR", type: "state" },
  { label: "California", value: "CA", type: "state" },
  { label: "Colorado", value: "CO", type: "state" },
  { label: "Connecticut", value: "CT", type: "state" },
  { label: "Delaware", value: "DE", type: "state" },
  { label: "Florida", value: "FL", type: "state" },
  { label: "Georgia", value: "GA", type: "state" },
  { label: "Hawaii", value: "HI", type: "state" },
  { label: "Idaho", value: "ID", type: "state" },
  { label: "Illinois", value: "IL", type: "state" },
  { label: "Indiana", value: "IN", type: "state" },
  { label: "Iowa", value: "IA", type: "state" },
  { label: "Kansas", value: "KS", type: "state" },
  { label: "Kentucky", value: "KY", type: "state" },
  { label: "Louisiana", value: "LA", type: "state" },
  { label: "Maine", value: "ME", type: "state" },
  { label: "Maryland", value: "MD", type: "state" },
  { label: "Massachusetts", value: "MA", type: "state" },
  { label: "Michigan", value: "MI", type: "state" },
  { label: "Minnesota", value: "MN", type: "state" },
  { label: "Mississippi", value: "MS", type: "state" },
  { label: "Missouri", value: "MO", type: "state" },
  { label: "Montana", value: "MT", type: "state" },
  { label: "Nebraska", value: "NE", type: "state" },
  { label: "Nevada", value: "NV", type: "state" },
  { label: "New Hampshire", value: "NH", type: "state" },
  { label: "New Jersey", value: "NJ", type: "state" },
  { label: "New Mexico", value: "NM", type: "state" },
  { label: "New York", value: "NY", type: "state" },
  { label: "North Carolina", value: "NC", type: "state" },
  { label: "North Dakota", value: "ND", type: "state" },
  { label: "Ohio", value: "OH", type: "state" },
  { label: "Oklahoma", value: "OK", type: "state" },
  { label: "Oregon", value: "OR", type: "state" },
  { label: "Pennsylvania", value: "PA", type: "state" },
  { label: "Rhode Island", value: "RI", type: "state" },
  { label: "South Carolina", value: "SC", type: "state" },
  { label: "South Dakota", value: "SD", type: "state" },
  { label: "Tennessee", value: "TN", type: "state" },
  { label: "Texas", value: "TX", type: "state" },
  { label: "Utah", value: "UT", type: "state" },
  { label: "Vermont", value: "VT", type: "state" },
  { label: "Virginia", value: "VA", type: "state" },
  { label: "Washington", value: "WA", type: "state" },
  { label: "West Virginia", value: "WV", type: "state" },
  { label: "Wisconsin", value: "WI", type: "state" },
  { label: "Wyoming", value: "WY", type: "state" },
  // Popular destinations
  { label: "Yellowstone National Park", value: "Yellowstone", type: "destination" },
  { label: "Yosemite National Park", value: "Yosemite", type: "destination" },
  { label: "Grand Canyon", value: "Grand Canyon", type: "destination" },
  { label: "Great Smoky Mountains", value: "Great Smoky Mountains", type: "destination" },
  { label: "Zion National Park", value: "Zion", type: "destination" },
  { label: "Rocky Mountain National Park", value: "Rocky Mountain", type: "destination" },
  { label: "Glacier National Park", value: "Glacier", type: "destination" },
  { label: "Acadia National Park", value: "Acadia", type: "destination" },
  { label: "Joshua Tree", value: "Joshua Tree", type: "destination" },
  { label: "Big Sur, California", value: "Big Sur", type: "destination" },
];

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotionSafe();

  // Filter location suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!location.trim()) return LOCATION_SUGGESTIONS.slice(0, 8);
    const search = location.toLowerCase();
    return LOCATION_SUGGESTIONS.filter(
      (s) => s.label.toLowerCase().includes(search) || s.value.toLowerCase().includes(search),
    ).slice(0, 8);
  }, [location]);

  // Handle check-in date change - auto-set checkout to 3 days later
  const handleCheckInChange = useCallback((newCheckIn: string) => {
    setCheckIn(newCheckIn);
    if (newCheckIn) {
      const checkInDate = new Date(newCheckIn);
      checkInDate.setDate(checkInDate.getDate() + 3);
      const newCheckOut = checkInDate.toISOString().split("T")[0];
      setCheckOut(newCheckOut);
    }
  }, []);

  // Handle location selection from suggestions
  const handleLocationSelect = useCallback((suggestion: (typeof LOCATION_SUGGESTIONS)[0]) => {
    setLocation(suggestion.label);
    setShowLocationSuggestions(false);
    setHighlightedIndex(-1);
  }, []);

  // Handle keyboard navigation in suggestions
  const handleLocationKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showLocationSuggestions) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
            handleLocationSelect(filteredSuggestions[highlightedIndex]);
          }
          break;
        case "Escape":
          setShowLocationSuggestions(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [showLocationSuggestions, highlightedIndex, filteredSuggestions, handleLocationSelect],
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target;
      if (!target || !(target instanceof Node)) return;
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(target) &&
        locationInputRef.current &&
        !locationInputRef.current.contains(target)
      ) {
        setShowLocationSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = useCallback(() => {
    // Trigger compass spin animation
    if (!prefersReducedMotion) {
      setIsSearching(true);
      setTimeout(() => setIsSearching(false), 600);
    }

    onSearch(query || location, {
      location,
      dates: { checkIn, checkOut },
      guests,
    });
  }, [query, location, checkIn, checkOut, guests, onSearch, prefersReducedMotion]);

  // Get minimum date (today) for date inputs
  const minDate = new Date().toISOString().split("T")[0];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-0">
      {/* Main search bar */}
      <div className="relative z-30">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center bg-card rounded-2xl shadow-2xl shadow-slate-900/10 border border-border/50 overflow-hidden p-3 sm:p-0">
          {/* Search icon */}
          <div className="pl-1 sm:pl-5 pr-2 sm:pr-3 self-start sm:self-center">
            <svg
              className="w-5 h-5 text-muted-foreground"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Main input */}
          <input
            type="text"
            placeholder="Search campgrounds, RV parks, cabins..."
            className="flex-1 w-full py-3 sm:py-4 px-2 text-foreground placeholder:text-muted-foreground focus:outline-none text-base sm:text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />

          {/* Filters toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2 mr-0 sm:mr-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
          </button>

          {/* Search button with compass spin */}
          <button
            onClick={handleSearch}
            className="w-full sm:w-auto m-0 sm:m-2 px-5 sm:px-6 py-3 bg-gradient-to-r from-keepr-evergreen to-keepr-evergreen-light text-white font-semibold rounded-xl hover:from-keepr-evergreen-light hover:to-keepr-evergreen transition-all shadow-lg shadow-keepr-evergreen/30 flex items-center justify-center gap-2 group"
          >
            <span>Find Your Spot</span>
            <motion.div
              animate={isSearching ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Compass className="w-4 h-4" />
            </motion.div>
          </button>
        </div>

        {/* Expanded filters */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 right-0 mt-3 p-6 bg-card rounded-2xl shadow-2xl shadow-slate-900/10 border border-border/50 z-50"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Location with autocomplete */}
                <div className="space-y-2 relative">
                  <label className="block text-sm font-medium text-foreground">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      ref={locationInputRef}
                      type="text"
                      placeholder="State, city, or park"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border focus:border-keepr-evergreen focus:ring-2 focus:ring-keepr-evergreen/20 outline-none transition-all"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setShowLocationSuggestions(true);
                        setHighlightedIndex(-1);
                      }}
                      onFocus={() => setShowLocationSuggestions(true)}
                      onKeyDown={handleLocationKeyDown}
                      autoComplete="off"
                    />
                  </div>

                  {/* Location suggestions dropdown */}
                  <AnimatePresence>
                    {showLocationSuggestions && filteredSuggestions.length > 0 && (
                      <motion.div
                        ref={suggestionsRef}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-card rounded-xl shadow-lg border border-border overflow-hidden z-50 max-h-64 overflow-y-auto"
                      >
                        {filteredSuggestions.map((suggestion, index) => (
                          <button
                            key={suggestion.value}
                            className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-muted transition-colors ${
                              index === highlightedIndex ? "bg-muted" : ""
                            }`}
                            onClick={() => handleLocationSelect(suggestion)}
                          >
                            <MapPin
                              className={`w-4 h-4 ${
                                suggestion.type === "destination"
                                  ? "text-keepr-evergreen"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {suggestion.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {suggestion.type === "state" ? "State" : "Popular Destination"}
                              </p>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Check-in */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Check-in</label>
                  <input
                    type="date"
                    min={minDate}
                    className="w-full px-4 py-3 rounded-xl border border-border focus:border-keepr-evergreen focus:ring-2 focus:ring-keepr-evergreen/20 outline-none transition-all"
                    value={checkIn}
                    onChange={(e) => handleCheckInChange(e.target.value)}
                  />
                </div>

                {/* Check-out */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Check-out
                    {checkIn && checkOut && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        (
                        {Math.ceil(
                          (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
                            (1000 * 60 * 60 * 24),
                        )}{" "}
                        nights)
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    min={checkIn || minDate}
                    className="w-full px-4 py-3 rounded-xl border border-border focus:border-keepr-evergreen focus:ring-2 focus:ring-keepr-evergreen/20 outline-none transition-all"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                  />
                </div>

                {/* Guests */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Guests</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-border focus:border-keepr-evergreen focus:ring-2 focus:ring-keepr-evergreen/20 outline-none transition-all"
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "Guest" : "Guests"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filter tags */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex flex-wrap gap-2">
                  {[
                    "RV Sites",
                    "Tent Camping",
                    "Cabins",
                    "Waterfront",
                    "Pet Friendly",
                    "Full Hookups",
                  ].map((tag) => (
                    <button
                      key={tag}
                      className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-full hover:bg-keepr-clay/15 hover:text-keepr-clay transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
