"use client";

import { useState } from "react";

interface SearchBarProps {
    onSearch: (query: string, filters: SearchFilters) => void;
}

interface SearchFilters {
    location: string;
    dates: { checkIn: string; checkOut: string };
    guests: number;
}

export function SearchBar({ onSearch }: SearchBarProps) {
    const [query, setQuery] = useState("");
    const [location, setLocation] = useState("");
    const [checkIn, setCheckIn] = useState("");
    const [checkOut, setCheckOut] = useState("");
    const [guests, setGuests] = useState(2);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleSearch = () => {
        onSearch(query, {
            location,
            dates: { checkIn, checkOut },
            guests
        });
    };

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-0">
            {/* Main search bar */}
            <div className="relative z-30">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center bg-white rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200/50 overflow-hidden p-3 sm:p-0">
                    {/* Search icon */}
                    <div className="pl-1 sm:pl-5 pr-2 sm:pr-3 self-start sm:self-center">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Main input */}
                    <input
                        type="text"
                        placeholder="Search campgrounds, RV parks, cabins..."
                        className="flex-1 w-full py-3 sm:py-4 px-2 text-slate-900 placeholder:text-slate-400 focus:outline-none text-base sm:text-lg"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setIsExpanded(true)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />

                    {/* Filters toggle */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2 mr-0 sm:mr-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filters
                    </button>

                    {/* Search button */}
                    <button
                        onClick={handleSearch}
                        className="w-full sm:w-auto m-0 sm:m-2 px-5 sm:px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-2 group"
                    >
                        <span>Explore</span>
                        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </button>
                </div>

                {/* Expanded filters */}
                {isExpanded && (
                    <div className="absolute top-full left-0 right-0 mt-3 p-6 bg-white rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200/50 z-50">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Location */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700">Location</label>
                                <input
                                    type="text"
                                    placeholder="City, state, or region"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                />
                            </div>

                            {/* Check-in */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700">Check-in</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                    value={checkIn}
                                    onChange={(e) => setCheckIn(e.target.value)}
                                />
                            </div>

                            {/* Check-out */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700">Check-out</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                    value={checkOut}
                                    onChange={(e) => setCheckOut(e.target.value)}
                                />
                            </div>

                            {/* Guests */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700">Guests</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
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
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex flex-wrap gap-2">
                                {["RV Sites", "Tent Camping", "Cabins", "Waterfront", "Pet Friendly", "Full Hookups"].map((tag) => (
                                    <button
                                        key={tag}
                                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-full hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
