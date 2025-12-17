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
        return <Command className="h-5 w-5 text-emerald-600" />;
      case "navigation":
        return <Navigation className="h-5 w-5 text-blue-600" />;
      case "actions":
        return <Zap className="h-5 w-5 text-amber-600" />;
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
        return "bg-emerald-100";
      case "navigation":
        return "bg-blue-100";
      case "actions":
        return "bg-amber-100";
      default:
        return "bg-slate-100";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => setShowShortcutsDialog(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-4xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Command className="h-6 w-6 text-emerald-600" />
              Keyboard Shortcuts
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Work faster with keyboard shortcuts for common actions
            </p>
          </div>
          <button
            onClick={() => setShowShortcutsDialog(false)}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Close shortcuts dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Platform Note */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-start gap-3">
            <Command className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-xs text-blue-700">
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
                    <h3 className="text-lg font-semibold text-slate-900">
                      {getCategoryTitle(category)}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-sm text-slate-700 font-medium">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && !shortcut.sequential && (
                                <span className="text-slate-400 text-xs mx-0.5">+</span>
                              )}
                              {idx > 0 && shortcut.sequential && (
                                <span className="text-slate-400 text-xs mx-1">then</span>
                              )}
                              <kbd className="px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono text-slate-900 shadow-sm min-w-[32px] text-center">
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
          <div className="mt-8 p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              Pro Tips
            </h4>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <span>
                  Use <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px]">{formatKey("cmd")}K</kbd> to
                  quickly search for guests, sites, and reservations
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <span>
                  Sequential shortcuts like <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px]">G</kbd>{" "}
                  then <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px]">D</kbd> should be pressed one
                  after another, not together
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <span>
                  Most shortcuts are disabled when typing in input fields (except global shortcuts)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <span>
                  Press <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px]">?</kbd> anytime to see this
                  reference panel
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Press <kbd className="px-2 py-0.5 bg-white rounded text-slate-900 border border-slate-200 text-[10px]">ESC</kbd> to close
          </span>
          <a
            href="/help/shortcuts"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            onClick={() => setShowShortcutsDialog(false)}
          >
            View full documentation →
          </a>
        </div>
      </div>
    </div>
  );
}
