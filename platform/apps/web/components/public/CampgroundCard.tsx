"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface CampgroundCardProps {
    id: string;
    name: string;
    slug?: string; // Use slug for public routing
    city?: string;
    state?: string;
    country?: string;
    description?: string;
    imageUrl?: string;
    isInternal?: boolean; // Whether campground is in our system
    rating?: number | null;
    reviewCount?: number | null;
    pricePerNight?: number;
    amenities?: string[];
    onExplore?: () => void;
    ratingBadge?: string;
}

export function CampgroundCard({
    id,
    name,
    slug,
    city,
    state,
    country,
    description,
    imageUrl,
    isInternal = false,
    rating,
    reviewCount,
    pricePerNight,
    amenities = [],
    onExplore,
    ratingBadge
}: CampgroundCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);

    const STORAGE_KEY = "campreserv:saved-campgrounds";

    const readSaved = () => {
        if (typeof window === "undefined") return [] as string[];
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    const writeSaved = (ids: string[]) => {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
        } catch {
            // ignore
        }
    };

    // Initialize favorite state from storage
    useEffect(() => {
        const saved = readSaved();
        if (saved.includes(id)) setIsFavorited(true);
    }, [id]);

    // Use slug for routing if available, fallback to ID
    const campgroundPath = `/park/${slug || id}`;

    const location = [city, state, country].filter(Boolean).join(", ") || "Location TBD";

    // Generate a placeholder gradient if no image
    const gradients = [
        "from-emerald-400 to-cyan-500",
        "from-violet-400 to-purple-500",
        "from-orange-400 to-rose-500",
        "from-blue-400 to-indigo-500",
        "from-teal-400 to-emerald-500",
        "from-pink-400 to-rose-500"
    ];
    const gradientIndex = name.charCodeAt(0) % gradients.length;
    const placeholderGradient = gradients[gradientIndex];
    const hasRating = typeof rating === "number" && Number.isFinite(rating);

    return (
        <div
            className="group relative bg-white rounded-2xl overflow-hidden shadow-lg shadow-slate-900/5 hover:shadow-2xl hover:shadow-slate-900/10 transition-all duration-300 transform hover:-translate-y-1"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Image container */}
            <div className="relative aspect-[4/3] overflow-hidden">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${placeholderGradient} flex items-center justify-center`}>
                        <svg className="w-16 h-16 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m4 20 8-14 8 14M2 20h20M9 15h6" />
                        </svg>
                    </div>
                )}

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Enhanced badge for internal campgrounds */}
                {isInternal && (
                    <div className="absolute top-4 left-4 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                    </div>
                )}

                {/* Favorite button */}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        setIsFavorited((prev) => {
                            const next = !prev;
                            const saved = readSaved();
                            const nextList = next
                                ? Array.from(new Set([...saved, id]))
                                : saved.filter((x) => x !== id);
                            writeSaved(nextList);
                            return next;
                        });
                    }}
                    className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                >
                    <svg
                        className={`w-5 h-5 transition-colors ${isFavorited ? "text-rose-500 fill-current" : "text-slate-600"}`}
                        fill={isFavorited ? "currentColor" : "none"}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                    </svg>
                </button>

                {/* Quick book button on hover */}
                {isInternal && (
                    <Link
                        href={campgroundPath}
                        className={`absolute bottom-4 left-4 right-4 py-3 bg-white/95 backdrop-blur-sm text-center text-sm font-semibold text-slate-900 rounded-xl shadow-lg transition-all duration-300 ${isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                            }`}
                    >
                        View Availability
                    </Link>
                )}
            </div>

            {/* Content */}
            <div className="p-5">
                {/* Rating */}
                <div className="flex items-center gap-2 mb-2 text-sm flex-wrap">
                    <div className="flex items-center gap-1">
                        <svg className={`w-4 h-4 ${hasRating ? "text-amber-400" : "text-slate-300"}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                        {hasRating ? (
                            <>
                                <span className="font-semibold text-slate-900">{rating?.toFixed(1)}</span>
                                {typeof reviewCount === "number" && reviewCount > 0 && (
                                    <span className="text-slate-500">({reviewCount} reviews)</span>
                                )}
                            </>
                        ) : (
                            <span className="text-slate-500">Reviews coming soon</span>
                        )}
                    </div>
                    {ratingBadge && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                            {ratingBadge}
                        </span>
                    )}
                    {!isInternal && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">
                            External listing
                        </span>
                    )}
                </div>

                {/* Name */}
                <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">{name}</h3>

                {/* Location */}
                <p className="text-sm text-slate-500 mb-3 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {location}
                </p>

                {/* Amenities */}
                {amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {amenities.slice(0, 3).map((amenity) => (
                            <span
                                key={amenity}
                                className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md"
                            >
                                {amenity}
                            </span>
                        ))}
                        {amenities.length > 3 && (
                            <span className="px-2 py-1 text-xs font-medium text-slate-400 bg-slate-50 rounded-md">
                                +{amenities.length - 3} more
                            </span>
                        )}
                    </div>
                )}

                {/* Price and CTA */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    {pricePerNight ? (
                        <div>
                            <span className="text-lg font-bold text-slate-900">${pricePerNight}</span>
                            <span className="text-sm text-slate-500"> / night</span>
                        </div>
                    ) : (
                        <span className="text-sm text-slate-500">Contact for pricing</span>
                    )}

                    {isInternal ? (
                        <Link
                            href={campgroundPath}
                            onClick={onExplore}
                            className="px-4 py-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                            Explore →
                        </Link>
                    ) : (
                        <div className="flex flex-col items-end gap-1">
                        <span className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 rounded-full">
                            External
                        </span>
                            <a
                                href={`mailto:hello@campeveryday.com?subject=Invite%20${encodeURIComponent(name)}%20to%20Camp%20Everyday&body=Please reach out to ${encodeURIComponent(name)} to join the platform.`}
                                className="text-[11px] text-emerald-700 font-semibold hover:text-emerald-800"
                            >
                                Suggest this park →
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
