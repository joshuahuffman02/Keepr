"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink, Plus, Search, MapPin, Globe } from "lucide-react";

function getAuthHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("campreserv:authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

type Campground = {
    id: string;
    name: string;
    slug: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    isActive?: boolean;
    timezone?: string | null;
    createdAt?: string;
};

export default function AdminCampgroundsListPage() {
    const [campgrounds, setCampgrounds] = useState<Campground[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const loadCampgrounds = async () => {
        setLoading(true);
        setError(null);
        try {
            const base = process.env.NEXT_PUBLIC_API_BASE || "";
            const res = await fetch(`${base}/campgrounds`, {
                credentials: "include",
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error(`Failed to load campgrounds (${res.status})`);
            const data = await res.json();
            setCampgrounds(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message || "Failed to load campgrounds");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCampgrounds();
    }, []);

    const filtered = campgrounds.filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            c.name.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            c.city?.toLowerCase().includes(q) ||
            c.state?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">All Campgrounds</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage all campgrounds on the platform
                    </p>
                </div>
                <Link
                    href="/admin/campgrounds/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Create New
                </Link>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, slug, city, or state..."
                        className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={loadCampgrounds}
                    disabled={loading}
                    className="px-4 py-2 bg-muted text-muted-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
                >
                    {loading ? "Loading..." : "Refresh"}
                </button>
            </div>

            {error && (
                <div className="bg-status-error/15 border border-status-error/30 rounded-lg p-4 text-status-error">
                    {error}
                </div>
            )}

            <div className="bg-muted rounded-lg border border-border overflow-hidden">
                <div className="grid gap-px bg-muted">
                    {loading && campgrounds.length === 0 && (
                        <div className="bg-muted p-8 text-center text-muted-foreground">
                            Loading campgrounds...
                        </div>
                    )}

                    {!loading && filtered.length === 0 && (
                        <div className="bg-muted p-8 text-center text-muted-foreground">
                            {search ? "No campgrounds match your search" : "No campgrounds found"}
                        </div>
                    )}

                    {filtered.map((campground) => (
                        <div
                            key={campground.id}
                            className="bg-muted p-4 flex items-center justify-between gap-4"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-muted rounded-lg">
                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-foreground">{campground.name}</h3>
                                        {campground.isActive === false && (
                                            <span className="px-2 py-0.5 text-xs bg-status-error/15 text-status-error rounded">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                        <span className="flex items-center gap-1">
                                            <Globe className="h-3 w-3" />
                                            /{campground.slug}
                                        </span>
                                        {(campground.city || campground.state) && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {[campground.city, campground.state].filter(Boolean).join(", ")}
                                            </span>
                                        )}
                                    </div>
                                    {campground.email && (
                                        <div className="text-xs text-muted-foreground mt-1">{campground.email}</div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/park/${campground.slug}`}
                                    target="_blank"
                                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                    title="View public page"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Link>
                                <Link
                                    href={`/campgrounds/${campground.id}`}
                                    className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted transition-colors"
                                >
                                    Manage
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-sm text-muted-foreground">
                Showing {filtered.length} of {campgrounds.length} campgrounds
            </div>
        </div>
    );
}
