"use client";

import React, { useEffect, useMemo } from "react";
import { useKeyboardShortcuts } from "@/contexts/KeyboardShortcutsContext";
import { Command, Zap, Navigation, X } from "lucide-react";

export function KeyboardShortcutsDialog() {
  const { shortcuts, showShortcutsDialog, setShowShortcutsDialog } = useKeyboardShortcuts();

  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, typeof shortcuts> = {
      global: [],
      navigation: [],
      actions: [],
    };

    shortcuts.forEach((shortcut) => {
      if (shortcut.enabled) {
        groups[shortcut.category].push(shortcut);
      }
    });

    return groups;
  }, [shortcuts]);

  useEffect(() => {
    if (!showShortcutsDialog) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowShortcutsDialog(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showShortcutsDialog, setShowShortcutsDialog]);

  if (!showShortcutsDialog) return null;

  const isMac =
    typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  const formatKey = (key: string): string => {
    if (key === "cmd") return isMac ? "⌘" : "Ctrl";
    if (key === "ctrl") return isMac ? "⌃" : "Ctrl";
    if (key === "shift") return isMac ? "⇧" : "Shift";
    if (key === "alt") return isMac ? "⌥" : "Alt";
    if (key === "escape") return "Esc";
    return key.toUpperCase();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "global":
        return <Command className="h-5 w-5 text-status-success" />;
      case "navigation":
        return <Navigation className="h-5 w-5 text-status-info" />;
      case "actions":
        return <Zap className="h-5 w-5 text-status-warning" />;
      default:
        return null;
    }
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case "global":
        return "Global Shortcuts";
      case "navigation":
        return "Navigation";
      case "actions":
        return "Quick Actions";
      default:
        return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "global":
        return "bg-status-success-bg";
      case "navigation":
        return "bg-status-info-bg";
      case "actions":
        return "bg-status-warning-bg";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-muted/60 backdrop-blur-sm"
        onClick={() => setShowShortcutsDialog(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-4xl mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Command className="h-6 w-6 text-action-primary" />
              Keyboard Shortcuts
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Work faster with keyboard shortcuts for common actions
            </p>
          </div>
          <button
            onClick={() => setShowShortcutsDialog(false)}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Close shortcuts dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Platform Note */}
        <div className="px-6 py-3 bg-status-info-bg border-b border-status-info-border">
          <div className="flex items-start gap-3">
            <Command className="h-4 w-4 text-status-info mt-0.5" />
            <div className="text-xs text-status-info-text">
              {isMac ? (
                <span>
                  <strong>Mac shortcuts:</strong> ⌘ = Command, ⇧ = Shift, ⌥ = Option, ⌃ = Control
                </span>
              ) : (
                <span>
                  <strong>Windows/Linux shortcuts:</strong> Ctrl replaces ⌘, Alt replaces ⌥
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => {
              if (categoryShortcuts.length === 0) return null;

              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 ${getCategoryColor(category)} rounded-lg`}>
                      {getCategoryIcon(category)}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {getCategoryTitle(category)}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted transition-colors"
                      >
                        <span className="text-sm text-foreground font-medium">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && !shortcut.sequential && (
                                <span className="text-muted-foreground text-xs mx-0.5">+</span>
                              )}
                              {idx > 0 && shortcut.sequential && (
                                <span className="text-muted-foreground text-xs mx-1">then</span>
                              )}
                              <kbd className="px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono text-foreground shadow-sm min-w-[32px] text-center">
                                {formatKey(key)}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tips Section */}
          <div className="mt-8 p-5 bg-status-warning-bg border border-status-warning-border rounded-xl">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-status-warning" />
              Pro Tips
            </h4>
            <ul className="space-y-2 text-xs text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-status-warning font-bold mt-0.5">•</span>
                <span>
                  Use <kbd className="px-1.5 py-0.5 bg-card rounded border border-border text-[10px]">{formatKey("cmd")}K</kbd> to
                  quickly search for guests, sites, and reservations
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-status-warning font-bold mt-0.5">•</span>
                <span>
                  Sequential shortcuts like <kbd className="px-1.5 py-0.5 bg-card rounded border border-border text-[10px]">G</kbd>{" "}
                  then <kbd className="px-1.5 py-0.5 bg-card rounded border border-border text-[10px]">D</kbd> should be pressed one
                  after another, not together
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-status-warning font-bold mt-0.5">•</span>
                <span>
                  Most shortcuts are disabled when typing in input fields (except global shortcuts)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-status-warning font-bold mt-0.5">•</span>
                <span>
                  Press <kbd className="px-1.5 py-0.5 bg-card rounded border border-border text-[10px]">?</kbd> anytime to see this
                  reference panel
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Press <kbd className="px-2 py-0.5 bg-card rounded text-foreground border border-border text-[10px]">ESC</kbd> to close
          </span>
          <a
            href="/dashboard/help/shortcuts"
            className="text-xs text-action-primary hover:text-action-primary-hover font-medium"
            onClick={() => setShowShortcutsDialog(false)}
          >
            View full documentation →
          </a>
        </div>
      </div>
    </div>
  );
}
