"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "../../../lib/utils";
import { AdminTopBar } from "./AdminTopBar";
import { apiClient } from "@/lib/api-client";
import { StaffChat } from "../../StaffChat";
import { useWhoami } from "@/hooks/use-whoami";
import { useMenuConfig } from "@/hooks/use-menu-config";
import { SyncStatus } from "../../sync/SyncStatus";
import { SyncDetailsDrawer } from "../../sync/SyncDetailsDrawer";
import { useSyncStatus } from "@/contexts/SyncStatusContext";
import { SupportChatWidget } from "../../support/SupportChatWidget";
import { AdminAiAssistant } from "../../admin/AdminAiAssistant";
import { resolvePages, PAGE_REGISTRY, PageDefinition } from "@/lib/page-registry";
import { useCampground } from "@/contexts/CampgroundContext";
import { ErrorBoundary } from "../../ErrorBoundary";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type IconName =
  | "dashboard"
  | "camp"
  | "calendar"
  | "pricing"
  | "reservation"
  | "guest"
  | "wrench"
  | "ledger"
  | "reports"
  | "audit"
  | "megaphone"
  | "tag"
  | "form"
  | "brand"
  | "policy"
  | "users"
  | "payments"
  | "sparkles"
  | "message"
  | "ticket"
  | "star"
  | "plus"
  | "clock"
  | "alert"
  | "lock"
  | "trophy";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  soon?: boolean;
  tooltip?: string;
  dataTour?: string;
};

type CommandItem = {
  id: string;
  label: string;
  href: string;
  subtitle?: string;
};

type NavSection = {
  heading: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

const Icon = ({ name, active }: { name: IconName; active?: boolean }) => {
  const stroke = active ? "#14b8a6" : "#94a3b8";
  const common = { width: 18, height: 18, strokeWidth: 1.6, stroke, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (name) {
    case "dashboard":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </svg>
      );
    case "camp":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="m4 20 8-14 8 14M2 20h20M9 15h6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "pricing":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 10c0-1.5 1.5-2.5 3-2.5s3 .9 3 2.5-1.5 2.5-3 2.5-3 .9-3 2.5 1.5 2.5 3 2.5 3-.9 3-2.5" />
        </svg>
      );
    case "reservation":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M6 3h12a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z" />
          <path d="M9 8h6M9 12h6" />
        </svg>
      );
    case "guest":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="4" />
          <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M19.4 4.6a5 5 0 0 1-6.8 6.8L8 15l-3-3 3.6-4.6a5 5 0 0 1 6.8-2.8l-3 3 3 3z" />
          <path d="M7 14 3.5 17.5" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M20 12 12 20 4 12V4h8l8 8Z" />
          <circle cx="9" cy="9" r="1.5" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2M13 17v2M13 11v2" />
        </svg>
      );
    case "star":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "ledger":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M7 4h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2V6a2 2 0 0 1 2-2Z" />
          <path d="M9 8h6M9 12h6" />
        </svg>
      );
    case "reports":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M4 20h16M4 4h5v16H4zM11 8h4v12h-4zM17 12h3v8h-3z" />
        </svg>
      );
    case "audit":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M5 3h10l4 4v14H5z" />
          <path d="M9 12h6M9 16h6M9 8h4" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M3 11v2a1 1 0 0 0 1 1h2l5 3V7L6 10H4a1 1 0 0 0-1 1Z" />
          <path d="M14 7a4 4 0 0 1 0 10" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M20 12 12 20 4 12V4h8l8 8Z" />
          <circle cx="9" cy="9" r="1.5" />
        </svg>
      );
    case "form":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M8 10h8M8 14h6" />
        </svg>
      );
    case "brand":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "policy":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M6 4h12v16l-6-3-6 3z" />
          <path d="M9 9h6M9 12h6" />
        </svg>
      );
    case "users":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="9" cy="8" r="3" />
          <path d="M2 20a7 7 0 0 1 14 0" />
          <circle cx="17" cy="9" r="2" />
          <path d="M22 20a4.5 4.5 0 0 0-6-4.2" />
        </svg>
      );
    case "payments":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M7 15h2" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 8l1.8 3.7L18 13l-3.7 1.3L12 18l-1.3-3.7L7 13l3.7-1.3z" />
        </svg>
      );
    case "message":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 2 2 22h20L12 2Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      );
    default:
      return null;
  }
};

// Extended user type with platform role
interface UserWithPlatformRole {
  platformRole?: string | null;
  memberships?: Array<{ campgroundId: string }>;
}

// Extended session type with API token
interface SessionWithApiToken {
  apiToken?: string;
  user?: {
    id?: string;
  };
}

/**
 * Layout density controls the maximum container width for data-dense pages.
 * - "normal": Standard max-width (max-w-7xl) for content-focused pages
 * - "full": Full width (max-w-none) for data-dense pages like calendars and booking grids
 */
export type DashboardDensity = "normal" | "full";

export interface DashboardShellProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  /**
   * Layout density - controls container max-width.
   * Use "full" for data-dense pages (calendar, booking grid).
   * Defaults to "normal" for standard content pages.
   */
  density?: DashboardDensity;
}

export function DashboardShell({ children, className, title, subtitle, density = "normal" }: DashboardShellProps) {
  const { data: session } = useSession();
  const { data: whoami } = useWhoami();
  const { setSelectedCampground } = useCampground();
  const [campgrounds, setCampgrounds] = useState<{ id: string; name: string; organizationId?: string }[]>([]);
  const [campgroundsLoading, setCampgroundsLoading] = useState(true);
  const [campgroundsError, setCampgroundsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | "">("");
  const [selectedOrg, setSelectedOrg] = useState<string | "">("");
  const selectedRef = useRef<string | "">("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pinEditMode, setPinEditMode] = useState(false);
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
  const { status } = useSyncStatus();

  // Use the menu config hook for pinned pages
  const {
    pinnedPages,
    sidebarCollapsed: savedCollapsed,
    isPinned,
    togglePin,
    setSidebarCollapsed,
    reorderPages,
    hasCustomPins,
  } = useMenuConfig();

  // DnD sensors for drag-and-drop reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering pinned pages
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = pinnedPages.indexOf(active.id as string);
        const newIndex = pinnedPages.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(pinnedPages, oldIndex, newIndex);
          reorderPages(newOrder);
        }
      }
    },
    [pinnedPages, reorderPages]
  );

  // Sync collapsed state from server
  useEffect(() => {
    if (savedCollapsed !== undefined) {
      setCollapsed(savedCollapsed);
    }
  }, [savedCollapsed]);

  // Get all resolved pages for this campground
  const allPages = useMemo(() => resolvePages(selected || null), [selected]);

  // Permission helpers
  const memberships = whoami?.user?.memberships ?? [];
  const hasCampgroundAccess = memberships.length > 0;
  const platformRole = (whoami?.user as UserWithPlatformRole | undefined)?.platformRole ?? null;
  const supportAllowed =
    whoami?.allowed?.supportRead || whoami?.allowed?.supportAssign || whoami?.allowed?.supportAnalytics;
  const allowSupport = !!supportAllowed && (platformRole ? true : hasCampgroundAccess);
  const allowOps = (whoami?.allowed?.operationsWrite ?? false) && (platformRole ? true : hasCampgroundAccess);

  // Role-based visibility for nav sections
  // Cast allowed to any to access permissions that may not be in the strict type
  const allowed = whoami?.allowed as Record<string, boolean> | undefined;
  // Check for manager-level or higher permissions (financeRead, reportsRead, or any write permission)
  const isManager = Boolean(
    platformRole ||
    allowed?.financeRead ||
    allowed?.reportsRead ||
    allowed?.usersWrite ||
    allowOps
  );
  // Check for admin-level permissions (settings access)
  const isAdmin = Boolean(
    platformRole ||
    allowed?.settingsWrite ||
    allowed?.usersWrite ||
    allowed?.pricingWrite
  );

  // Sync API token from session to localStorage
  useEffect(() => {
    const extendedSession = session as SessionWithApiToken | null;
    const apiToken = extendedSession?.apiToken;
    if (apiToken) {
      localStorage.setItem("campreserv:authToken", apiToken);
    }
  }, [session]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const fetchCampgrounds = useCallback(async () => {
    setCampgroundsLoading(true);
    setCampgroundsError(null);
    try {
      const stored = localStorage.getItem("campreserv:selectedCampground");
      const storedOrg = localStorage.getItem("campreserv:selectedOrg");
      const authToken = localStorage.getItem("campreserv:authToken");
      if (stored) setSelected(stored);
      if (storedOrg) setSelectedOrg(storedOrg);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
      const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const resp = await fetch(`${apiBase}/campgrounds`, { headers });
      if (!resp.ok) {
        throw new Error(`Failed to load campgrounds: ${resp.status}`);
      }
      const data = await resp.json();
      if (Array.isArray(data)) {
        // If the user has memberships, only show those campgrounds.
        const membershipIds =
          whoami?.user?.memberships?.map((m) => m.campgroundId) ?? [];
        const filtered =
          membershipIds.length > 0
            ? data.filter((cg) => membershipIds.includes(cg.id))
            : data;

        setCampgrounds(filtered);

        // If a stored selection is no longer allowed, clear it.
        if (stored && filtered.every((cg) => cg.id !== stored)) {
          setSelected("");
          setSelectedOrg("");
          selectedRef.current = "";
        }

        // Auto-select the first allowed campground if none is chosen yet
        const currentSelected = selectedRef.current || stored || "";
        if (!currentSelected && filtered.length > 0) {
          const next = filtered[0];
          setSelected(next.id);
          selectedRef.current = next.id;
          if (next.organizationId) {
            setSelectedOrg(next.organizationId);
          } else {
            setSelectedOrg("");
          }
        }
      } else {
        throw new Error("Invalid campground response");
      }
    } catch (err) {
      setCampgroundsError("Unable to load campgrounds. Please try again.");
      setCampgrounds([]);
    } finally {
      setCampgroundsLoading(false);
    }
  }, [whoami]);

  useEffect(() => {
    fetchCampgrounds();
  }, [fetchCampgrounds]);

  // Refresh unread message badge (guest + internal staff chat) when campground changes and on a short poll
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selected) return;

    const loadUnread = async () => {
      try {
        const guest = await apiClient.getUnreadMessageCount(selected);
        // Internal conversations endpoint can 404 in some environments; skip to reduce log noise.
        // If re-enabled, move under a feature flag and handle missing API.
        setUnreadMessages(guest.unreadCount || 0);
      } catch {
        // ignore unread errors
      }
    };

    loadUnread();
    const id = setInterval(loadUnread, 20000);
    return () => clearInterval(id);
  }, [selected, session]);

  // Note: Favorites are now managed via useMenuConfig hook (database-backed)

  useEffect(() => {
    if (!selected) return;
    localStorage.setItem("campreserv:selectedCampground", selected);
    // Sync with CampgroundContext so other components can access it
    const campground = campgrounds.find(c => c.id === selected);
    setSelectedCampground(campground ? { id: campground.id, name: campground.name } : { id: selected });
  }, [selected, campgrounds, setSelectedCampground]);
  useEffect(() => {
    if (!selectedOrg) return;
    localStorage.setItem("campreserv:selectedOrg", selectedOrg);
  }, [selectedOrg]);

  const currentPath = useMemo(() => pathname || "", [pathname]);
  const cgScopedPath = selected ? `/campgrounds/${selected}` : "/campgrounds";
  const cgSitesPath = selected ? `/campgrounds/${selected}/sites` : "/campgrounds";
  const cgClassesPath = selected ? `/campgrounds/${selected}/classes` : "/campgrounds";
  const cgReservationsPath = selected ? `/campgrounds/${selected}/reservations` : "/reservations";
  const cgMapPath = selected ? `/campgrounds/${selected}/map` : "/campgrounds";
  // Operations items for top bar quick actions (moved from sidebar)
  const operationsItems = useMemo<NavItem[]>(() => [
    { label: "Check In/Out", href: "/check-in-out", icon: "reservation" },
    { label: "New Booking", href: "/booking", icon: "plus" },
    { label: "POS", href: "/pos", icon: "payments" },
    { label: "Waitlist", href: "/waitlist", icon: "clock" },
    { label: "Maintenance", href: "/maintenance", icon: "wrench" },
    { label: "Housekeeping", href: selected ? `/campgrounds/${selected}/housekeeping` : "/campgrounds", icon: "wrench" }
  ], [selected]);

  const navSections = useMemo(() => {
    // PRIMARY - Core daily operations (no accordion, always visible)
    const primaryItems: NavItem[] = [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard", dataTour: "dashboard-link" },
      { label: "Calendar", href: "/calendar", icon: "calendar", dataTour: "calendar-link" },
      { label: "Site Map", href: cgMapPath, icon: "camp", tooltip: "View and manage the campground map" },
      { label: "Reservations", href: cgReservationsPath, icon: "reservation", dataTour: "reservations-link" },
      { label: "Guests", href: "/guests", icon: "guest", dataTour: "guests-link" },
      { label: "Messages", href: "/messages", icon: "message", badge: unreadMessages, dataTour: "messages-link" },
      { label: "Reports", href: "/reports", icon: "reports", dataTour: "reports-link" },
      { label: "Gamification", href: "/gamification", icon: "trophy", tooltip: "Staff leaderboards and rewards", dataTour: "gamification-link" }
    ];

    // Add Management link for managers (simplified - links to hub page)
    if (isManager) {
      primaryItems.push({ label: "Management", href: "/dashboard/management", icon: "wrench", tooltip: "Inventory, finance, and operations" });
    }

    // Add Settings link for admins (simplified - links to hub page)
    if (isAdmin) {
      primaryItems.push({ label: "Settings", href: "/dashboard/settings", icon: "policy", tooltip: "All settings and configuration", dataTour: "settings-link" });
    }

    // NOTE: Operations items moved to top bar
    // NOTE: Support Queue / Analytics / Platform Users are accessed via /admin layout

    const sections = [
      {
        heading: "Primary",
        items: primaryItems,
        collapsible: false,
        defaultOpen: true
      }
    ];

    return sections;
  }, [cgMapPath, cgReservationsPath, unreadMessages, isManager, isAdmin]);

  const frontDeskShortcuts = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { label: "Arrivals/Departures", href: "/check-in-out", icon: "reservation" },
      { label: "New Booking", href: "/booking", icon: "plus" },
      { label: "Calendar", href: "/calendar", icon: "calendar" },
      { label: "POS", href: "/pos", icon: "payments" },
      { label: "Messages", href: "/messages", icon: "message", badge: unreadMessages }
    ];

    if (allowOps && selected) {
      items.push(
        { label: "Timeclock", href: `/campgrounds/${selected}/staff/timeclock`, icon: "clock" },
        { label: "Shift Approvals", href: `/campgrounds/${selected}/staff/approvals`, icon: "users" },
        { label: "Override Requests", href: `/campgrounds/${selected}/staff/overrides`, icon: "alert" }
      );
    }

    return items;
  }, [unreadMessages, allowOps, selected]);

  const toggleSection = useCallback(
    (heading: string) => {
      setOpenSections((prev) => {
        const current = prev[heading] ?? navSections.find((s) => s.heading === heading)?.defaultOpen ?? false;
        const next: Record<string, boolean> = {};
        navSections.forEach((section) => {
          next[section.heading] = section.heading === heading ? !current : false;
        });
        return next;
      });
    },
    [navSections]
  );

  // Flatten all nav items for lookup
  const allNavItems = useMemo(() => {
    const map = new Map<string, NavItem>();
    navSections.forEach((section) => {
      section.items.forEach((item) => {
        map.set(item.href, item);
      });
    });
    return map;
  }, [navSections]);

  // Close mobile nav on navigation
  useEffect(() => {
    if (!pathname) return;
    setMobileNavOpen(false);
  }, [pathname]);

  // Build favorites items from pinned pages (from hook)
  const favoritesItems = useMemo(() => {
    return pinnedPages
      .map((href) => {
        // First check allNavItems for exact match
        const navItem = allNavItems.get(href);
        if (navItem) return navItem;

        // Then check page registry for the page definition
        const pageDef = allPages.find((p) => p.href === href);
        if (pageDef) {
          return {
            label: pageDef.label,
            href: pageDef.href,
            icon: pageDef.icon,
            tooltip: pageDef.description,
          } as NavItem;
        }
        return null;
      })
      .filter(Boolean) as NavItem[];
  }, [pinnedPages, allNavItems, allPages]);

  const toCommandItem = useCallback((item: NavItem, subtitle?: string): CommandItem => ({
    id: item.href,
    label: item.label,
    href: item.href,
    subtitle: subtitle ?? item.tooltip ?? item.href
  }), []);

  const navigationCommandItems = useMemo(
    () => navSections.flatMap((section) => section.items.map((item) => toCommandItem(item))),
    [navSections, toCommandItem]
  );

  const actionCommandItems = useMemo(
    () => operationsItems.map((item) => toCommandItem(item, "Quick action")),
    [operationsItems, toCommandItem]
  );

  const favoriteCommandItems = useMemo(
    () => favoritesItems.map((item) => toCommandItem(item, "Pinned")),
    [favoritesItems, toCommandItem]
  );

  // Build command items from all pages for search
  const allPagesCommandItems = useMemo(
    () => allPages.map((page) => ({
      id: page.href,
      label: page.label,
      href: page.href,
      subtitle: page.description,
    })),
    [allPages]
  );

  const PinButton = ({ pinned, onClick }: { pinned: boolean; onClick: (e: React.MouseEvent) => void }) => (
    <button
      type="button"
      className={cn(
        "ml-2 inline-flex h-6 w-6 items-center justify-center rounded border text-slate-400 hover:text-white transition-colors",
        pinned ? "border-amber-300 bg-amber-50/10" : "border-slate-700 bg-slate-900/60 hover:bg-slate-800"
      )}
      aria-label={pinned ? "Unpin from menu" : "Pin to menu"}
      title={pinned ? "Unpin from menu" : "Pin to menu"}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        className="h-3.5 w-3.5"
      >
        <path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
      </svg>
    </button>
  );

  // Sortable favorite item component for drag-and-drop reordering
  const SortableFavoriteItem = ({ item, isActive, isCollapsed, showPin }: {
    item: NavItem;
    isActive: boolean;
    isCollapsed: boolean;
    showPin: boolean;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.href });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div ref={setNodeRef} style={style}>
        <Link
          className={cn(
            "flex items-center justify-between rounded-md px-3 py-2.5 text-sm md:text-[15px] text-slate-400 hover:bg-slate-800 hover:text-white transition-colors",
            isActive && "bg-slate-800 text-white font-semibold",
            isDragging && "z-50"
          )}
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          title={item.tooltip ?? item.label}
          data-tour={item.dataTour}
        >
          <span className={cn("flex items-center gap-2", isCollapsed && "justify-center w-full")}>
            {/* Drag handle - only show in edit mode */}
            {showPin && !isCollapsed && (
              <span
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 mr-1"
                onClick={(e) => e.preventDefault()}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="2" />
                  <circle cx="15" cy="6" r="2" />
                  <circle cx="9" cy="12" r="2" />
                  <circle cx="15" cy="12" r="2" />
                  <circle cx="9" cy="18" r="2" />
                  <circle cx="15" cy="18" r="2" />
                </svg>
              </span>
            )}
            <Icon name={(item.icon as IconName) ?? "sparkles"} active={isActive} />
            {!isCollapsed && item.label}
          </span>
          {!isCollapsed && showPin && (
            <PinButton
              pinned={true}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePin(item.href);
              }}
            />
          )}
        </Link>
      </div>
    );
  };

  // Initialize open sections; preserve prior state but default to section defaults
  useEffect(() => {
    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      navSections.forEach((section) => {
        const existing = prev[section.heading];
        if (typeof existing === "boolean") {
          next[section.heading] = existing;
        } else {
          next[section.heading] = section.defaultOpen ?? false;
        }
      });
      return next;
    });
  }, [navSections]);

  const handleCampgroundChange = (value: string) => {
    setSelected(value);
    if (!value) return;
    if (typeof window === "undefined") return;
    const cg = campgrounds.find((c) => c.id === value);
    if (cg?.organizationId) {
      setSelectedOrg(cg.organizationId);
      localStorage.setItem("campreserv:selectedOrg", cg.organizationId);
    }
    // Always send to the reservations landing for that campground
    window.location.href = `/campgrounds/${value}/reservations`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      {/* Admin Top Bar */}
      <AdminTopBar
        onToggleNav={() => setMobileNavOpen((v) => !v)}
        mobileNavOpen={mobileNavOpen}
        navigationItems={navigationCommandItems}
        actionItems={actionCommandItems}
        favoriteItems={favoriteCommandItems}
        allPagesItems={allPagesCommandItems}
      />

      {/* Mobile nav drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition",
          mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity",
            mobileNavOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={cn(
            "absolute top-0 left-0 h-full w-[78vw] max-w-sm bg-slate-900 text-white shadow-2xl transition-transform duration-200 ease-out",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8">
                <Image src="/logo.png" alt="Camp Everyday" fill sizes="32px" className="object-contain" />
              </div>
              <span className="font-semibold text-sm text-slate-100">Navigate</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
              aria-label="Close navigation"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Menu</div>
              {favoritesItems.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-400">
                  No pages pinned yet. Use "Customize Menu" below to add pages.
                </div>
              ) : (
                <div className="space-y-1">
                  {favoritesItems.map((item) => {
                    const baseHref = item.href.split(/[?#]/)[0];
                    const isActive = currentPath === baseHref || currentPath.startsWith(baseHref + "/");
                    return (
                      <Link
                        key={`m-fav-${item.href}`}
                        href={item.href}
                        title={"tooltip" in item ? item.tooltip : item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-base",
                          isActive ? "bg-slate-800 text-white font-semibold" : "bg-slate-800/40 text-slate-100 hover:bg-slate-800"
                        )}
                        onClick={() => setMobileNavOpen(false)}
                      >
                        <Icon name={(item.icon as IconName) ?? "sparkles"} active={isActive} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* All Pages link for customization */}
            <div className="mt-4 pt-4 border-t border-slate-700">
              <Link
                href="/all-pages"
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-base bg-slate-800/40 text-slate-100 hover:bg-slate-800"
                onClick={() => setMobileNavOpen(false)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Customize Menu</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <aside
          className={cn(
            "hidden md:flex md:flex-col border-r border-slate-800 bg-slate-900 transition-all h-[calc(100vh-3.5rem)] sticky top-14",
            collapsed ? "w-16 items-center" : "w-64"
          )}
        >
          <div className={cn("w-full border-b border-slate-800 flex items-center", collapsed ? "justify-center p-3" : "justify-between p-4 gap-2")}>
            {collapsed ? (
              <div className="relative w-8 h-8">
                <Image src="/logo.png" alt="Camp Everyday" fill sizes="32px" className="object-contain" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8">
                  <Image src="/logo.png" alt="Camp Everyday" fill sizes="32px" className="object-contain" />
                </div>
                <div className="text-lg font-semibold text-white">Camp Everyday</div>
              </div>
            )}
            <button
              className="rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
              onClick={() => {
                const newValue = !collapsed;
                setCollapsed(newValue);
                setSidebarCollapsed(newValue);
              }}
              aria-label="Toggle sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {collapsed ? <path d="M10 6l6 6-6 6" /> : <path d="M14 6l-6 6 6 6" />}
              </svg>
            </button>
          </div>
          {!collapsed && (
            <div className="px-4 py-4 border-b border-slate-800">
              <div className="text-xs text-slate-400">
                <div className="mb-1 font-semibold text-slate-300">Campground</div>
                {campgroundsLoading ? (
                  <div className="w-full rounded-md border border-slate-800 bg-slate-800 px-3 py-2 text-sm text-slate-400 animate-pulse">
                    Loading campgrounds...
                  </div>
                ) : campgroundsError ? (
                  <div className="space-y-2">
                    <div className="text-xs text-red-200">{campgroundsError}</div>
                    <button
                      type="button"
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                      onClick={fetchCampgrounds}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                    value={selected}
                    onChange={(e) => handleCampgroundChange(e.target.value)}
                  >
                    <option value="">Select campground</option>
                    {campgrounds.map((cg) => (
                      <option key={cg.id} value={cg.id}>
                        {cg.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
          <nav className={cn("flex-1 px-3 py-4 space-y-4 overflow-y-auto", collapsed && "px-1")}>
            {!collapsed && (
              <div className="flex items-center justify-between px-1 pb-1 text-xs text-slate-500">
                <span className="uppercase tracking-wide font-semibold">Navigation</span>
                <button
                  type="button"
                  className={cn(
                    "rounded px-2 py-1 border text-xs transition-colors",
                    pinEditMode
                      ? "border-emerald-300 text-emerald-200 bg-emerald-900/30"
                      : "border-slate-700 text-slate-400 bg-slate-800/60 hover:bg-slate-800"
                  )}
                  onClick={() => setPinEditMode((v) => !v)}
                  aria-pressed={pinEditMode}
                >
                  {pinEditMode ? "Done" : "Edit pins"}
                </button>
              </div>
            )}
            {/* Pinned pages with drag-and-drop reordering */}
            <div className="space-y-1">
              {!collapsed && (
                <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Menu
                </div>
              )}
              {favoritesItems.length === 0 && !collapsed && (
                <div className="px-3 py-4 text-sm text-slate-500">
                  No pages pinned yet.{" "}
                  <Link href="/all-pages" className="text-teal-400 hover:underline">
                    Add pages
                  </Link>
                </div>
              )}
              {favoritesItems.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={pinnedPages}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {favoritesItems.map((item) => {
                        const baseHref = item.href.split(/[?#]/)[0];
                        const isActive = currentPath === baseHref || currentPath.startsWith(baseHref + "/");
                        return (
                          <SortableFavoriteItem
                            key={`fav-${item.href}`}
                            item={item}
                            isActive={isActive}
                            isCollapsed={collapsed}
                            showPin={pinEditMode}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>



            {/* All Pages link */}
            {!collapsed && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <Link
                  href="/all-pages"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span>All Pages</span>
                </Link>
              </div>
            )}
          </nav>
        </aside>
        <main className={cn("flex-1", className)}>
          <ErrorBoundary>
            <div className={cn(
              "mx-auto px-6 py-6 space-y-4",
              density === "full" ? "max-w-none" : "max-w-7xl"
            )}>
              {(title || subtitle) && (
                <div className="mb-6">
                  {title && <h1 className="text-2xl font-bold text-foreground">{title}</h1>}
                  {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
                </div>
              )}
              {children}
            </div>
          </ErrorBoundary>
        </main>
      </div>

      {/* Sync Status Footer */}
      {(status.totalPending > 0 || status.totalConflicts > 0 || !status.isOnline) && (
        <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
          <SyncStatus
            variant="compact"
            showDetails={false}
            onClick={() => setSyncDrawerOpen(true)}
          />
        </div>
      )}

      <SyncDetailsDrawer open={syncDrawerOpen} onOpenChange={setSyncDrawerOpen} />
      <StaffChat />
      <div data-tour="help-button">
        <SupportChatWidget />
      </div>
      {/* AI Assistant for admin users */}
      {isAdmin && <AdminAiAssistant />}
    </div>
  );
}
