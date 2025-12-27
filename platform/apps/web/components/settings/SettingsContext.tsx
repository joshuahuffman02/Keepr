"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

interface SystemCheckIssue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

interface SettingsContextValue {
  // System check
  systemCheckCount: number;
  systemCheckIssues: SystemCheckIssue[];
  refreshSystemCheck: () => Promise<void>;
  isLoadingSystemCheck: boolean;

  // Unsaved changes
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;

  // Search
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;

  // Announcements for screen readers
  announce: (message: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [systemCheckIssues, setSystemCheckIssues] = useState<SystemCheckIssue[]>([]);
  const [isLoadingSystemCheck, setIsLoadingSystemCheck] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Calculate count from issues
  const systemCheckCount = systemCheckIssues.filter(
    (i) => i.severity !== "info"
  ).length;

  // Fetch system check issues
  const refreshSystemCheck = useCallback(async () => {
    setIsLoadingSystemCheck(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch("/api/system-check");
      // const data = await response.json();
      // setSystemCheckIssues(data.issues);

      // Mock data for now
      setSystemCheckIssues([
        {
          id: "1",
          severity: "warning",
          message: "Tax rules not configured for some site types",
          actionLabel: "Configure",
          actionHref: "/dashboard/settings/central/pricing/taxes",
        },
        {
          id: "2",
          severity: "warning",
          message: "No rate groups defined for 2026",
          actionLabel: "Add rate groups",
          actionHref: "/dashboard/settings/central/pricing/rate-groups",
        },
        {
          id: "3",
          severity: "info",
          message: "Grid optimization is disabled",
          actionLabel: "Enable",
          actionHref: "/dashboard/settings/central/bookings/optimization",
        },
      ]);
    } catch (error) {
      console.error("Failed to fetch system check:", error);
    } finally {
      setIsLoadingSystemCheck(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refreshSystemCheck();
  }, [refreshSystemCheck]);

  // Global keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Announcement for screen readers
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    // Clear after announcement
    setTimeout(() => setAnnouncement(""), 1000);
  }, []);

  const value: SettingsContextValue = {
    systemCheckCount,
    systemCheckIssues,
    refreshSystemCheck,
    isLoadingSystemCheck,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    isSearchOpen,
    openSearch: () => setIsSearchOpen(true),
    closeSearch: () => setIsSearchOpen(false),
    announce,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </SettingsContext.Provider>
  );
}
