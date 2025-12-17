"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { HelpPanel } from "../../help/HelpPanel";
import { useKeyboardShortcuts } from "@/contexts/KeyboardShortcutsContext";

type AdminTopBarProps = {
    onToggleNav?: () => void;
    mobileNavOpen?: boolean;
};

// Click outside hook for closing dropdowns
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler();
        };
        document.addEventListener("mousedown", listener);
        document.addEventListener("touchstart", listener);
        return () => {
            document.removeEventListener("mousedown", listener);
            document.removeEventListener("touchstart", listener);
        };
    }, [ref, handler]);
}

interface SearchResult {
    type: "guest" | "site" | "reservation" | "report";
    id: string;
    title: string;
    subtitle?: string;
    href: string;
}

export function AdminTopBar({ onToggleNav, mobileNavOpen }: AdminTopBarProps) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { setShowShortcutsDialog } = useKeyboardShortcuts();

    // Close dropdowns when clicking outside
    useClickOutside(menuRef, () => setIsMenuOpen(false));
    useClickOutside(notificationsRef, () => setIsNotificationsOpen(false));

    // Register callbacks with keyboard shortcuts system
    useEffect(() => {
        if (typeof window !== "undefined" && (window as any).__keyboardShortcuts) {
            (window as any).__keyboardShortcuts.onSearch(() => setIsSearchOpen(true));
            (window as any).__keyboardShortcuts.onHelp(() => {
                setIsHelpPanelOpen(true);
                setIsNotificationsOpen(false);
            });
            (window as any).__keyboardShortcuts.onCloseModal(() => {
                setIsSearchOpen(false);
                setIsNotificationsOpen(false);
                setIsHelpPanelOpen(false);
            });
        }
    }, []);

    // Focus search input when opened
    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);

    // Simulate search results
    const performSearch = useCallback((query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);

        // Simulate API call delay
        setTimeout(() => {
            const mockResults: SearchResult[] = [
                { type: "guest" as const, id: "g1", title: "John Smith", subtitle: "john@example.com", href: "/guests" },
                { type: "guest" as const, id: "g2", title: "Jane Doe", subtitle: "jane@example.com", href: "/guests" },
                { type: "site" as const, id: "s1", title: "Site A-12", subtitle: "Full hookup site", href: "/campgrounds" },
                { type: "reservation" as const, id: "r1", title: "Reservation #1234", subtitle: "Dec 15 - Dec 20, 2024", href: "/reservations" },
                { type: "report" as const, id: "rp1", title: "Revenue Report", subtitle: "Daily financial summary", href: "/reports" }
            ].filter(
                (r) =>
                    r.title.toLowerCase().includes(query.toLowerCase()) ||
                    r.subtitle?.toLowerCase().includes(query.toLowerCase())
            );

            setSearchResults(mockResults);
            setIsSearching(false);
        }, 200);
    }, []);

    useEffect(() => {
        const debounce = setTimeout(() => performSearch(searchQuery), 150);
        return () => clearTimeout(debounce);
    }, [searchQuery, performSearch]);

    const handleResultClick = (result: SearchResult) => {
        setIsSearchOpen(false);
        setSearchQuery("");
        router.push(result.href);
    };

    const getTypeIcon = (type: SearchResult["type"]) => {
        switch (type) {
            case "guest":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="7" r="4" />
                        <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
                    </svg>
                );
            case "site":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="m4 20 8-14 8 14M2 20h20M9 15h6" />
                    </svg>
                );
            case "reservation":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M6 3h12a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z" />
                    </svg>
                );
            case "report":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M4 20h16M4 4h5v16H4zM11 8h4v12h-4zM17 12h3v8h-3z" />
                    </svg>
                );
        }
    };

    // Sample notifications (local state with links and resolved flag)
    const [notifications, setNotifications] = useState<
        { id: number; title: string; subtitle: string; time: string; unread: boolean; resolved?: boolean; href?: string }[]
    >([
        { id: 1, title: "New booking received", subtitle: "Site A-12, Dec 15-20", time: "5m ago", unread: true, href: "/reservations" },
        { id: 2, title: "System update available", subtitle: "Version 2.1.0 is ready", time: "1h ago", unread: true, href: "/updates" },
        { id: 3, title: "Payment received", subtitle: "$150.00 from John Smith", time: "3h ago", unread: false, href: "/finance/payouts" }
    ]);

    const unreadCount = notifications.filter((n) => n.unread && !n.resolved).length;

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    };

    const markResolved = (id: number) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, unread: false, resolved: true } : n))
        );
    };

    return (
        <>
            {/* Top Bar */}
            <div className="sticky top-0 z-50 h-14 border-b border-slate-200 bg-white/95 backdrop-blur flex items-center px-3 sm:px-4 gap-3 sm:gap-4 shadow-sm">
                {/* Left - mobile nav + spacer */}
                <div className="flex items-center">
                    {onToggleNav && (
                        <button
                            onClick={onToggleNav}
                            aria-pressed={!!mobileNavOpen}
                            aria-label="Toggle navigation"
                            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {mobileNavOpen ? <path d="M6 18 18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                            </svg>
                        </button>
                    )}
                    <div className="hidden md:block w-8" />
                </div>

                {/* Center - Global Search */}
                <div className="flex-1 flex justify-center">
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex items-center gap-3 px-3 sm:px-4 py-2 w-full max-w-2xl sm:max-w-3xl bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm text-slate-500"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span>Search guests, sites, reservations...</span>
                        <kbd className="ml-auto px-2 py-0.5 bg-white rounded text-xs text-slate-400 border border-slate-200">
                            ⌘K
                        </kbd>
                    </button>
                </div>

                {/* Right - Operations, Notifications & Menu */}
                <div className="flex items-center gap-2">
                    {/* Operations Quick Actions */}
                    <div className="hidden md:flex items-center gap-1 mr-2">
                        <Link
                            href="/check-in-out"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Check In/Out"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path d="M6 3h12a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z" />
                                <path d="M9 8h6M9 12h6" />
                            </svg>
                            <span className="hidden lg:inline">Check In</span>
                        </Link>
                        <Link
                            href="/booking"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="New Booking"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            <span className="hidden lg:inline">New Booking</span>
                        </Link>
                        <Link
                            href="/pos"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Point of Sale"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <rect x="3" y="5" width="18" height="14" rx="2" />
                                <path d="M3 10h18M7 15h2" />
                            </svg>
                            <span className="hidden lg:inline">POS</span>
                        </Link>
                    </div>

                    {/* Notifications */}
                    <div className="relative" ref={notificationsRef}>
                        <button
                            onClick={() => {
                                setIsNotificationsOpen(!isNotificationsOpen);
                                setIsMenuOpen(false);
                                setIsHelpPanelOpen(false);
                            }}
                            className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Notifications"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {isNotificationsOpen && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                                    <div className="font-semibold text-slate-900 text-sm">Notifications</div>
                                    <button
                                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                                        onClick={markAllRead}
                                    >
                                        Mark all read
                                    </button>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`w-full flex items-start gap-3 px-4 py-3 ${
                                                notif.unread && !notif.resolved ? "bg-emerald-50/50" : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full mt-2 ${notif.unread && !notif.resolved ? "bg-emerald-500" : "bg-transparent"}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-900">{notif.title}</div>
                                                <div className="text-xs text-slate-500 truncate">{notif.subtitle}</div>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                    <span>{notif.time}</span>
                                                    {notif.resolved && <span className="text-emerald-600 font-semibold">Resolved</span>}
                                                </div>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <button
                                                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                                                        onClick={() => {
                                                            markResolved(notif.id);
                                                            if (notif.href) router.push(notif.href);
                                                        }}
                                                    >
                                                        Mark resolved
                                                    </button>
                                                    {notif.href && (
                                                        <button
                                                            className="text-xs text-slate-600 hover:text-slate-800"
                                                            onClick={() => {
                                                                setIsNotificationsOpen(false);
                                                                router.push(notif.href as string);
                                                            }}
                                                        >
                                                            Open
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-slate-100 px-4 py-2">
                                    <Link href="/messages" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                                        Open inbox →
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Menu Dropdown */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => {
                                setIsMenuOpen(!isMenuOpen);
                                setIsNotificationsOpen(false);
                                setIsHelpPanelOpen(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Menu"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="19" r="1" />
                            </svg>
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                                {/* Management */}
                                <Link
                                    href="/dashboard/management"
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path d="M19.4 4.6a5 5 0 0 1-6.8 6.8L8 15l-3-3 3.6-4.6a5 5 0 0 1 6.8-2.8l-3 3 3 3z" />
                                        <path d="M7 14 3.5 17.5" />
                                    </svg>
                                    Management
                                </Link>

                                {/* Settings */}
                                <Link
                                    href="/dashboard/settings"
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    Settings
                                </Link>

                                {/* Keyboard Shortcuts */}
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setShowShortcutsDialog(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <rect x="2" y="4" width="20" height="16" rx="2" />
                                        <path d="M6 8h.01M10 8h.01M14 8h.01M6 12h.01M10 12h.01M14 12h.01M6 16h.01M10 16h.01M14 16h8" />
                                    </svg>
                                    Keyboard Shortcuts
                                    <kbd className="ml-auto px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-400 border border-slate-200">?</kbd>
                                </button>

                                {/* Help & Support */}
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setIsHelpPanelOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                                    </svg>
                                    Help & Support
                                    <kbd className="ml-auto px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-400 border border-slate-200">⌘/</kbd>
                                </button>

                                {/* Divider */}
                                <div className="my-2 border-t border-slate-100" />

                                {/* What's New */}
                                <Link
                                    href="/updates"
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    What's New
                                    <span className="ml-auto px-1.5 py-0.5 bg-amber-100 rounded text-[10px] text-amber-700 font-medium">NEW</span>
                                </Link>

                                {/* Divider */}
                                <div className="my-2 border-t border-slate-100" />

                                {/* Sign Out */}
                                <button
                                    onClick={() => {
                                        localStorage.removeItem("campreserv:authToken");
                                        signOut({ callbackUrl: "/auth/signin" });
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Search Modal */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsSearchOpen(false)} />

                    {/* Modal */}
                    <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
                        {/* Search input */}
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search guests, sites, reservations, reports..."
                                className="flex-1 text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <kbd className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-400 border border-slate-200">
                                ESC
                            </kbd>
                        </div>

                        {/* Results */}
                        <div className="max-h-96 overflow-y-auto">
                            {isSearching ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : searchQuery && searchResults.length === 0 ? (
                                <div className="py-12 text-center">
                                    <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-sm text-slate-500">No results found for "{searchQuery}"</div>
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="py-2">
                                    {searchResults.map((result) => (
                                        <button
                                            key={`${result.type}-${result.id}`}
                                            onClick={() => handleResultClick(result)}
                                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left"
                                        >
                                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                                {getTypeIcon(result.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-900">{result.title}</div>
                                                {result.subtitle && (
                                                    <div className="text-xs text-slate-500">{result.subtitle}</div>
                                                )}
                                            </div>
                                            <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-500 capitalize">
                                                {result.type}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : !searchQuery ? (
                                <div className="py-6 px-5">
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                        Quick Actions
                                    </div>
                                    <div className="space-y-1">
                                        <Link
                                            href="/guests"
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                                        >
                                            <span className="text-slate-400">→</span> Browse Guests
                                        </Link>
                                        <Link
                                            href="/reservations"
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                                        >
                                            <span className="text-slate-400">→</span> View Reservations
                                        </Link>
                                        <Link
                                            href="/reports"
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                                        >
                                            <span className="text-slate-400">→</span> Open Reports
                                        </Link>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            <HelpPanel open={isHelpPanelOpen} onClose={() => setIsHelpPanelOpen(false)} />
        </>
    );
}
