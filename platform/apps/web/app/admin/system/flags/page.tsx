"use client";

import { useState, useEffect } from "react";
import { Flag, ToggleLeft, ToggleRight, Search, Building2, Globe, Plus, RefreshCw } from "lucide-react";

type FeatureFlag = {
    id: string;
    key: string;
    name: string;
    description: string | null;
    enabled: boolean;
    scope: "global" | "campground";
    campgrounds: string[];
};

function getAuthHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("campreserv:authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function FeatureFlagsPage() {
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [scopeFilter, setScopeFilter] = useState<string>("all");

    const loadFlags = async () => {
        setLoading(true);
        setError(null);
        try {
            const base = process.env.NEXT_PUBLIC_API_BASE || "";
            const res = await fetch(`${base}/admin/flags`, {
                credentials: "include",
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error(`Failed to load flags (${res.status})`);
            const data = await res.json();
            setFlags(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message || "Failed to load feature flags");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFlags();
    }, []);

    const toggleFlag = async (id: string) => {
        try {
            const base = process.env.NEXT_PUBLIC_API_BASE || "";
            const res = await fetch(`${base}/admin/flags/${id}/toggle`, {
                method: "PATCH",
                credentials: "include",
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error(`Failed to toggle flag`);
            const updated = await res.json();
            setFlags((prev) =>
                prev.map((f) => (f.id === id ? updated : f))
            );
        } catch (err: any) {
            setError(err.message);
        }
    };

    const filtered = flags.filter((flag) => {
        if (scopeFilter !== "all" && flag.scope !== scopeFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                flag.name.toLowerCase().includes(q) ||
                flag.key.toLowerCase().includes(q) ||
                flag.description?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const enabledCount = flags.filter((f) => f.enabled).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Feature Flags</h1>
                    <p className="text-muted-foreground mt-1">
                        Enable or disable features across the platform
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadFlags}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">{enabledCount}/{flags.length}</div>
                        <div className="text-sm text-muted-foreground">Features enabled</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search features..."
                        className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={scopeFilter}
                    onChange={(e) => setScopeFilter(e.target.value)}
                    className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Scopes</option>
                    <option value="global">Global</option>
                    <option value="campground">Per Campground</option>
                </select>
            </div>

            {error && (
                <div className="bg-status-error/15 border border-status-error/30 rounded-lg p-4 text-status-error">
                    {error}
                </div>
            )}

            {/* Flags Grid */}
            <div className="grid gap-4 md:grid-cols-2">
                {loading && flags.length === 0 && (
                    <div className="col-span-2 p-8 text-center text-muted-foreground">
                        Loading feature flags...
                    </div>
                )}
                {!loading && filtered.length === 0 && (
                    <div className="col-span-2 p-8 text-center text-muted-foreground">
                        No feature flags found. Create one to get started.
                    </div>
                )}
                {filtered.map((flag) => (
                    <div
                        key={flag.id}
                        className={`bg-muted rounded-lg border p-4 transition-colors ${flag.enabled ? "border-status-success/30" : "border-border"
                            }`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${flag.enabled ? "bg-status-success/15" : "bg-muted"}`}>
                                    <Flag className={`h-4 w-4 ${flag.enabled ? "text-status-success" : "text-muted-foreground"}`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">{flag.name}</span>
                                        <span className="text-xs font-mono text-muted-foreground">{flag.key}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">{flag.description || "No description"}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        {flag.scope === "global" ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                <Globe className="h-3 w-3" /> Global
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                <Building2 className="h-3 w-3" /> Per Campground
                                            </span>
                                        )}
                                        {flag.campgrounds && flag.campgrounds.length > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                ({flag.campgrounds.length} enabled)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleFlag(flag.id)}
                                className="flex-shrink-0 p-1 hover:bg-muted rounded transition-colors"
                            >
                                {flag.enabled ? (
                                    <ToggleRight className="h-8 w-8 text-status-success" />
                                ) : (
                                    <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-sm text-muted-foreground text-center">
                Changes are saved automatically
            </div>
        </div>
    );
}
