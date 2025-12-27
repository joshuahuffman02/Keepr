"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, AlertTriangle } from "lucide-react";
import { CategoryTabs } from "./navigation/CategoryTabs";
import { SettingsSearch } from "./navigation/SettingsSearch";
import { useSettings } from "./SettingsContext";
import { cn } from "@/lib/utils";

interface SettingsShellProps {
  children: ReactNode;
  className?: string;
}

export function SettingsShell({ children, className }: SettingsShellProps) {
  const { systemCheckCount, isSearchOpen, openSearch, closeSearch } = useSettings();

  return (
    <div className={cn("min-h-screen bg-slate-50", className)}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Settings</span>
              </Button>
            </Link>
            <div className="hidden sm:block h-6 w-px bg-slate-200" />
            <h1 className="text-lg font-semibold text-slate-900">
              Central Settings
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* System check badge */}
            {systemCheckCount > 0 && (
              <Link href="/dashboard/settings/central/system/check">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-800 hover:bg-amber-100"
                  >
                    {systemCheckCount}
                  </Badge>
                  <span className="hidden md:inline">issues</span>
                </Button>
              </Link>
            )}

            {/* Search button */}
            <Button
              variant="outline"
              size="sm"
              onClick={openSearch}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden md:inline-flex px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 rounded">
                ⌘K
              </kbd>
            </Button>
          </div>
        </div>

        {/* Category tabs (Level 1) */}
        <CategoryTabs />
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Search modal */}
      <SettingsSearch open={isSearchOpen} onOpenChange={closeSearch} />
    </div>
  );
}
