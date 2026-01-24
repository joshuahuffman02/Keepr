"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface SystemCheckIssue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

type SystemCheckItem = {
  message: string;
  action?: string;
  href?: string;
};

type SystemCheckResponse = {
  errors: SystemCheckItem[];
  warnings: SystemCheckItem[];
  suggestions: SystemCheckItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toSystemCheckItems = (value: unknown): SystemCheckItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const message = typeof entry.message === "string" ? entry.message : null;
      if (!message) return null;
      const item: SystemCheckItem = { message };
      if (typeof entry.action === "string") item.action = entry.action;
      if (typeof entry.href === "string") item.href = entry.href;
      return item;
    })
    .filter((entry): entry is SystemCheckItem => entry !== null);
};
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
  const systemCheckCount = systemCheckIssues.filter((i) => i.severity !== "info").length;

  // Fetch system check issues from the API
  const refreshSystemCheck = useCallback(async () => {
    setIsLoadingSystemCheck(true);
    try {
      const campgroundId = localStorage.getItem("selectedCampgroundId");
      if (!campgroundId) {
        setSystemCheckIssues([]);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/system-check/${campgroundId}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Campground-Id": campgroundId,
          },
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch system check");
      }

      const rawData: unknown = await response.json();
      const data: SystemCheckResponse = isRecord(rawData)
        ? {
            errors: toSystemCheckItems(rawData.errors),
            warnings: toSystemCheckItems(rawData.warnings),
            suggestions: toSystemCheckItems(rawData.suggestions),
          }
        : { errors: [], warnings: [], suggestions: [] };

      // Map API response to component format
      const toIssue = (
        severity: SystemCheckIssue["severity"],
        item: SystemCheckItem,
        idx: number,
      ): SystemCheckIssue => ({
        id: `${severity}-${idx}`,
        severity,
        message: item.message,
        actionLabel: item.action,
        actionHref: item.href,
      });

      const issues: SystemCheckIssue[] = [
        ...data.errors.map((e, idx: number) => toIssue("error", e, idx)),
        ...data.warnings.map((w, idx: number) => toIssue("warning", w, idx)),
        ...data.suggestions.map((s, idx: number) => toIssue("info", s, idx)),
      ];

      setSystemCheckIssues(issues);
    } catch (error) {
      console.error("Failed to fetch system check:", error);
      // Fall back to empty state on error
      setSystemCheckIssues([]);
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
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </SettingsContext.Provider>
  );
}
