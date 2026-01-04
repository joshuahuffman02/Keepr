"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { HelpPanel } from "../../help/HelpPanel";
import { useKeyboardShortcuts } from "@/contexts/KeyboardShortcutsContext";
import { apiClient } from "@/lib/api-client";
import { LogoImage } from "@/components/brand";

type AdminTopBarProps = {
    onToggleNav?: () => void;
    mobileNavOpen?: boolean;
    navigationItems?: CommandItem[];
    actionItems?: CommandItem[];
    favoriteItems?: CommandItem[];
    allPagesItems?: CommandItem[];
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

type CommandItem = {
    id: string;
    label: string;
    href: string;
    subtitle?: string;
};

// Types
type Notification = {
    id: string;
    type: string;
    title: string;
    body?: string;
    readAt?: string | null;
    createdAt: string;
};

type WindowWithKeyboardShortcuts = Window & {
    __keyboardShortcuts?: {
        onSearch: (callback: () => void) => void;
        onHelp: (callback: () => void) => void;
        onCloseModal: (callback: () => void) => void;
    };
};

// Notification type configuration
const notificationConfig: Record<string, { icon: string; color: string; href: string }> = {
    arrival: { icon: "log-in", color: "emerald", href: "/check-in-out" },
    departure: { icon: "log-out", color: "blue", href: "/check-in-out" },
    task_assigned: { icon: "clipboard-list", color: "purple", href: "/tasks" },
    task_sla_warning: { icon: "alert-triangle", color: "amber", href: "/tasks" },
    maintenance_urgent: { icon: "wrench", color: "red", href: "/maintenance" },
    payment_received: { icon: "dollar-sign", color: "emerald", href: "/finance/payouts" },
    payment_failed: { icon: "x-circle", color: "red", href: "/finance/payouts" },
    message_received: { icon: "message-square", color: "blue", href: "/messages" },
    general: { icon: "bell", color: "slate", href: "/notifications" },
};

export function AdminTopBar({
    onToggleNav,
    mobileNavOpen,
    navigationItems = [],
    actionItems = [],
    favoriteItems = [],
    allPagesItems = []
}: AdminTopBarProps) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
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
        if (typeof window !== "undefined") {
            const windowWithShortcuts = window as WindowWithKeyboardShortcuts;
            if (windowWithShortcuts.__keyboardShortcuts) {
                windowWithShortcuts.__keyboardShortcuts.onSearch(() => setIsSearchOpen(true));
                windowWithShortcuts.__keyboardShortcuts.onHelp(() => {
                    setIsHelpPanelOpen(true);
                    setIsNotificationsOpen(false);
                });
                windowWithShortcuts.__keyboardShortcuts.onCloseModal(() => {
                    setIsSearchOpen(false);
                    setIsNotificationsOpen(false);
                    setIsHelpPanelOpen(false);
                });
            }
        }
    }, []);

    // Focus search input when opened
    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);

    const handleResultClick = (result: CommandItem) => {
        setIsSearchOpen(false);
        setSearchQuery("");
        router.push(result.href);
    };

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchSections = useMemo(() => {
        const sections = [
            { title: "Pinned", items: favoriteItems },
            { title: "Actions", items: actionItems },
            { title: "Navigation", items: navigationItems },
            { title: "All Pages", items: allPagesItems }
        ];

        const matchesQuery = (item: CommandItem) => {
            if (!normalizedQuery) return true;
            const label = item.label.toLowerCase();
            const subtitle = item.subtitle?.toLowerCase() ?? "";
            return label.includes(normalizedQuery) || subtitle.includes(normalizedQuery);
        };

        let filtered = normalizedQuery
            ? sections.map((section) => ({
                ...section,
                items: section.items.filter(matchesQuery)
            }))
            : sections.filter((section) => section.title !== "All Pages"); // Only show All Pages when searching

        const seen = new Set<string>();
        filtered = filtered
            .map((section) => ({
                ...section,
                items: section.items.filter((item) => {
                    if (seen.has(item.href)) return false;
                    seen.add(item.href);
                    return true;
                })
            }))
            .filter((section) => section.items.length > 0);

        if (!normalizedQuery && filtered.length === 0) {
            const fallback = navigationItems.slice(0, 6);
            if (fallback.length > 0) {
                filtered = [{ title: "Navigation", items: fallback }];
            }
        }

        const totalCount = filtered.reduce((sum, section) => sum + section.items.length, 0);
        return { sections: filtered, totalCount };
    }, [actionItems, favoriteItems, navigationItems, allPagesItems, normalizedQuery]);

    const getSectionIcon = (title: string) => {
        switch (title) {
            case "Favorites":
            case "Pinned":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
                    </svg>
                );
            case "All Pages":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                );
            case "Recent":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 3" />
                    </svg>
                );
            case "Actions":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="m4 20 8-14 8 14M2 20h20M9 15h6" />
                    </svg>
                );
        }
    };

    // Get user session for fetching notifications
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const userId = session?.user?.id;
    const userName = session?.user?.name?.trim();
    const userEmail = session?.user?.email?.trim();
    const isAuthenticated = !!userId;
    const displayName = isAuthenticated ? (userName || userEmail || "Signed in") : "Sign in";
    const displayEmail = isAuthenticated && userName && userEmail && userEmail !== userName ? userEmail : "";
    const initialsSource = isAuthenticated ? (userName || userEmail || "U") : "SI";
    const initials = initialsSource
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || initialsSource.slice(0, 2).toUpperCase();

    // Track when the API token becomes available in localStorage (set by DashboardShell)
    const [hasApiToken, setHasApiToken] = useState(false);
    useEffect(() => {
        // Check immediately and then poll briefly to catch when DashboardShell syncs the token
        const checkToken = () => {
            const token = localStorage.getItem("campreserv:authToken");
            if (token) {
                setHasApiToken(true);
                return true;
            }
            return false;
        };

        if (checkToken()) return;

        // Poll briefly in case the token is being synced
        const interval = setInterval(() => {
            if (checkToken()) {
                clearInterval(interval);
            }
        }, 100);

        // Clean up after 2 seconds if token never appears
        const timeout = setTimeout(() => clearInterval(interval), 2000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [session]);

    // Fetch notifications from API - wait for both userId and token to be available
    const { data: notificationsData } = useQuery({
        queryKey: ["notifications", userId],
        queryFn: () => apiClient.getNotifications(userId!, { limit: 10 }),
        enabled: !!userId && hasApiToken,
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    const notifications = (notificationsData || []) as Notification[];
    const unreadCount = notifications.filter((n) => !n.readAt).length;

    // Mark notification as read mutation
    const markReadMutation = useMutation({
        mutationFn: (notificationId: string) => apiClient.markNotificationRead(notificationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        },
    });

    // Mark all notifications as read mutation
    const markAllReadMutation = useMutation({
        mutationFn: () => apiClient.markAllNotificationsRead(userId!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        },
    });

    const markAllRead = () => {
        if (userId) {
            markAllReadMutation.mutate();
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.readAt) {
            markReadMutation.mutate(notification.id);
        }
        const config = notificationConfig[notification.type] || notificationConfig.general;
        router.push(config.href);
        setIsNotificationsOpen(false);
    };

    return (
        <>
            {/* Top Bar */}
            <div className="sticky top-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur flex items-center px-3 sm:px-4 gap-3 sm:gap-4 shadow-sm transition-colors">
                {/* Left - Logo + mobile nav */}
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="flex items-center">
                        {/* Use overflow-hidden and object-cover to crop the PNG whitespace */}
                        <div className="h-8 overflow-hidden flex items-center">
                            <img
                                src="/images/logo/keepr-logo.png"
                                alt="Keepr"
                                className="h-12 w-auto object-contain object-center -my-2"
                            />
                        </div>
                    </Link>
                    {onToggleNav && (
                        <button
                            onClick={onToggleNav}
                            aria-pressed={!!mobileNavOpen}
                            aria-label="Toggle navigation"
                            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted/40 transition-colors"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {mobileNavOpen ? <path d="M6 18 18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                            </svg>
                        </button>
                    )}
                </div>

                {/* Center - Global Search */}
                <div className="flex-1 flex justify-center">
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex items-center gap-3 px-3 sm:px-4 py-2 w-full max-w-2xl sm:max-w-3xl bg-muted hover:bg-muted/80 rounded-lg transition-colors text-sm text-muted-foreground"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span>Search pages and actions...</span>
                        <kbd className="ml-auto px-2 py-0.5 bg-background rounded text-xs text-muted-foreground border border-border">
                            ⌘K
                        </kbd>
                    </button>
                </div>

                {/* Right - Operations, Notifications & Menu */}
                <div className="flex items-center gap-2">
                    <Link
                        href={isAuthenticated ? "/dashboard/settings/account" : "/auth/signin"}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-foreground text-xs font-semibold transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2 sm:hidden"
                        aria-label={isAuthenticated ? "View profile" : "Sign in"}
                        title={displayEmail ? `${displayName} · ${displayEmail}` : displayName}
                    >
                        {initials}
                    </Link>
                    <Link
                        href={isAuthenticated ? "/dashboard/settings/account" : "/auth/signin"}
                        className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2"
                        title={displayEmail ? `${displayName} · ${displayEmail}` : displayName}
                    >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground text-xs font-semibold">
                            {initials}
                        </div>
                        <div className="min-w-0 leading-tight">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {isAuthenticated ? "Signed in" : "Not signed in"}
                            </div>
                            <div className="text-sm font-semibold text-foreground max-w-[140px] truncate">
                                {displayName}
                            </div>
                            {displayEmail && (
                                <div className="text-[11px] text-muted-foreground max-w-[140px] truncate">
                                    {displayEmail}
                                </div>
                            )}
                        </div>
                    </Link>
                    {/* Operations Quick Actions */}
                    <div className="hidden md:flex items-center gap-1 mr-2">
                        <Link
                            href="/check-in-out"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-status-success hover:bg-status-success/15 rounded-lg transition-colors"
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
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-status-success hover:bg-status-success/15 rounded-lg transition-colors"
                            title="New Booking"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            <span className="hidden lg:inline">New Booking</span>
                        </Link>
                        <Link
                            href="/pos"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-status-success hover:bg-status-success/15 rounded-lg transition-colors"
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
                            className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
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
                            <div className="absolute right-0 top-full mt-2 w-80 bg-card rounded-xl shadow-xl border border-border py-2 z-50">
                                <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                                    <div className="font-semibold text-foreground text-sm">Notifications</div>
                                    {unreadCount > 0 && (
                                        <button
                                            className="text-xs text-status-success hover:text-status-success/80 font-medium disabled:opacity-50"
                                            onClick={markAllRead}
                                            disabled={markAllReadMutation.isPending}
                                        >
                                            {markAllReadMutation.isPending ? "Marking..." : "Mark all read"}
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="px-4 py-8 text-center">
                                            <div className="text-sm text-muted-foreground">No notifications yet</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                You'll see arrivals, payments, and alerts here
                                            </div>
                                        </div>
                                    ) : (
                                        notifications.map((notif) => {
                                            const config = notificationConfig[notif.type] || notificationConfig.general;
                                            const isUnread = !notif.readAt;
                                            return (
                                                <button
                                                    key={notif.id}
                                                    onClick={() => handleNotificationClick(notif)}
                                                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                                                        isUnread ? "bg-status-success/15" : "hover:bg-muted"
                                                    }`}
                                                >
                                                    <div className="text-lg flex-shrink-0">{config.icon}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                                            {notif.title}
                                                            {isUnread && (
                                                                <span className="w-2 h-2 rounded-full bg-status-success flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        {notif.body && (
                                                            <div className="text-xs text-muted-foreground truncate">{notif.body}</div>
                                                        )}
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="border-t border-border px-4 py-2">
                                    <Link
                                        href="/notifications"
                                        className="text-sm text-status-success hover:text-status-success/80 font-medium"
                                        onClick={() => setIsNotificationsOpen(false)}
                                    >
                                        View all notifications →
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
                            className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                            title="Menu"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="19" r="1" />
                            </svg>
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-popover rounded-xl shadow-xl border border-border py-2 z-50">
                                {/* Management */}
                                <Link
                                    href="/dashboard/management"
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path d="M19.4 4.6a5 5 0 0 1-6.8 6.8L8 15l-3-3 3.6-4.6a5 5 0 0 1 6.8-2.8l-3 3 3 3z" />
                                        <path d="M7 14 3.5 17.5" />
                                    </svg>
                                    Management
                                </Link>

                                {/* Settings */}
                                <Link
                                    href="/dashboard/settings/central"
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    Settings
                                </Link>

                                {/* My Profile */}
                                {isAuthenticated ? (
                                    <Link
                                        href="/dashboard/settings/account"
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <circle cx="12" cy="8" r="4" />
                                            <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" />
                                        </svg>
                                        My Profile
                                    </Link>
                                ) : (
                                    <Link
                                        href="/auth/signin"
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m0 0 4-4m-4 4 4 4M21 19V5a2 2 0 0 0-2-2h-6" />
                                        </svg>
                                        Sign in
                                    </Link>
                                )}

                                {/* Billing */}
                                <Link
                                    href="/dashboard/settings/billing"
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <rect x="3" y="5" width="18" height="14" rx="2" />
                                        <path d="M3 10h18M7 15h2" />
                                    </svg>
                                    Billing & Usage
                                </Link>

                                {/* Keyboard Shortcuts */}
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setShowShortcutsDialog(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
                                >
                                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <rect x="2" y="4" width="20" height="16" rx="2" />
                                        <path d="M6 8h.01M10 8h.01M14 8h.01M6 12h.01M10 12h.01M14 12h.01M6 16h.01M10 16h.01M14 16h8" />
                                    </svg>
                                    Keyboard Shortcuts
                                    <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground/70 border border-border">?</kbd>
                                </button>

                                {/* Help & Support */}
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setIsHelpPanelOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
                                >
                                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                                    </svg>
                                    Help & Support
                                    <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground/70 border border-border">⌘/</kbd>
                                </button>

                                {/* Divider */}
                                <div className="my-2 border-t border-border/70" />

                                {/* What's New */}
                                <Link
                                    href="/updates"
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    What's New
                                    <span className="ml-auto px-1.5 py-0.5 bg-status-warning/15 rounded text-[10px] text-status-warning font-medium">NEW</span>
                                </Link>

                                {/* Divider */}
                                <div className="my-2 border-t border-border/70" />

                                {isAuthenticated && (
                                    <button
                                        onClick={() => {
                                            localStorage.removeItem("campreserv:authToken");
                                            signOut({ callbackUrl: "/auth/signin" });
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-status-error-bg hover:text-status-error-text transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Sign Out
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Search Modal */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsSearchOpen(false)} />

                    {/* Modal */}
                    <div className="relative w-full max-w-2xl mx-4 bg-popover rounded-2xl shadow-2xl overflow-hidden">
                        {/* Search input */}
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                            <svg className="w-5 h-5 text-muted-foreground/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search pages, actions, reports..."
                                className="flex-1 text-lg text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <kbd className="px-2 py-1 bg-muted rounded text-xs text-muted-foreground/70 border border-border">
                                ESC
                            </kbd>
                        </div>

                        {/* Results */}
                        <div className="max-h-96 overflow-y-auto">
                            {normalizedQuery && searchSections.totalCount === 0 ? (
                                <div className="py-12 text-center">
                                    <svg className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-sm text-muted-foreground">No results found for "{searchQuery}"</div>
                                </div>
                            ) : searchSections.sections.length > 0 ? (
                                <div className="py-2">
                                    {searchSections.sections.map((section) => (
                                        <div key={section.title} className="py-2">
                                            <div className="px-5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                                                <span className="text-muted-foreground/70">{getSectionIcon(section.title)}</span>
                                                {section.title}
                                            </div>
                                            {section.items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => handleResultClick(item)}
                                                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/40 text-left"
                                                >
                                                    <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                                                        {getSectionIcon(section.title)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-foreground">{item.label}</div>
                                                        {item.subtitle && (
                                                            <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                                                        )}
                                                    </div>
                                                    <span className="px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
                                                        {section.title}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : !normalizedQuery ? (
                                <div className="py-6 px-5">
                                    <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
                                        Quick Actions
                                    </div>
                                    <div className="space-y-1">
                                        <Link
                                            href="/guests"
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 text-sm text-foreground"
                                        >
                                            <span className="text-muted-foreground/70">→</span> Browse Guests
                                        </Link>
                                        <Link
                                            href="/reservations"
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 text-sm text-foreground"
                                        >
                                            <span className="text-muted-foreground/70">→</span> View Reservations
                                        </Link>
                                        <Link
                                            href="/reports"
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 text-sm text-foreground"
                                        >
                                            <span className="text-muted-foreground/70">→</span> Open Reports
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
