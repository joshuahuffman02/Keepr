"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

export type ShortcutAction =
  | "search"
  | "help"
  | "new-booking"
  | "close-modal"
  | "go-dashboard"
  | "go-calendar"
  | "go-reservations"
  | "go-guests"
  | "go-pos"
  | "go-messages"
  | "go-settings";

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  action: ShortcutAction | (() => void);
  category: "navigation" | "actions" | "global";
  sequential?: boolean; // For "G then D" style shortcuts
  global?: boolean; // Works even in input fields
  enabled?: boolean;
}

interface KeyboardShortcutsContextValue {
  shortcuts: KeyboardShortcut[];
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
  showShortcutsDialog: boolean;
  setShowShortcutsDialog: (show: boolean) => void;
  isInputFocused: boolean;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutsProvider");
  }
  return context;
}

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const sequentialPrimed = useRef(false);
  const sequentialTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchRef = useRef<(() => void) | null>(null);
  const onHelpRef = useRef<(() => void) | null>(null);
  const onNewBookingRef = useRef<(() => void) | null>(null);
  const onCloseModalRef = useRef<(() => void) | null>(null);

  // Default shortcuts
  const defaultShortcuts: KeyboardShortcut[] = [
    // Global shortcuts
    {
      id: "global-search",
      keys: ["cmd", "k"],
      description: "Open global search",
      action: "search",
      category: "global",
      global: true,
      enabled: true,
    },
    {
      id: "global-help",
      keys: ["cmd", "/"],
      description: "Open help",
      action: "help",
      category: "global",
      global: true,
      enabled: true,
    },
    {
      id: "close-modal",
      keys: ["escape"],
      description: "Close any open modal/dialog",
      action: "close-modal",
      category: "global",
      global: true,
      enabled: true,
    },
    // Actions
    {
      id: "new-booking",
      keys: ["cmd", "n"],
      description: "New booking",
      action: "new-booking",
      category: "actions",
      enabled: true,
    },
    // Navigation (sequential)
    {
      id: "nav-dashboard",
      keys: ["g", "d"],
      description: "Go to Dashboard",
      action: "go-dashboard",
      category: "navigation",
      sequential: true,
      enabled: true,
    },
    {
      id: "nav-calendar",
      keys: ["g", "c"],
      description: "Go to Calendar",
      action: "go-calendar",
      category: "navigation",
      sequential: true,
      enabled: true,
    },
    {
      id: "nav-reservations",
      keys: ["g", "r"],
      description: "Go to Reservations",
      action: "go-reservations",
      category: "navigation",
      sequential: true,
      enabled: true,
    },
    {
      id: "nav-guests",
      keys: ["g", "g"],
      description: "Go to Guests",
      action: "go-guests",
      category: "navigation",
      sequential: true,
      enabled: true,
    },
    {
      id: "nav-pos",
      keys: ["g", "p"],
      description: "Go to POS",
      action: "go-pos",
      category: "navigation",
      sequential: true,
      enabled: true,
    },
    {
      id: "nav-messages",
      keys: ["g", "m"],
      description: "Go to Messages",
      action: "go-messages",
      category: "navigation",
      sequential: true,
      enabled: true,
    },
    {
      id: "nav-settings",
      keys: ["g", "s"],
      description: "Go to Settings",
      action: "go-settings",
      category: "navigation",
      sequential: true,
      enabled: true,
    },
  ];

  useEffect(() => {
    setShortcuts(defaultShortcuts);
  }, []);

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts((prev) => {
      const existing = prev.find((s) => s.id === shortcut.id);
      if (existing) {
        return prev.map((s) => (s.id === shortcut.id ? shortcut : s));
      }
      return [...prev, shortcut];
    });
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const executeAction = useCallback(
    (action: ShortcutAction | (() => void)) => {
      if (typeof action === "function") {
        action();
        return;
      }

      switch (action) {
        case "search":
          onSearchRef.current?.();
          break;
        case "help":
          onHelpRef.current?.();
          break;
        case "new-booking":
          onNewBookingRef.current?.();
          router.push("/booking");
          break;
        case "close-modal":
          onCloseModalRef.current?.();
          break;
        case "go-dashboard":
          router.push("/dashboard");
          break;
        case "go-calendar":
          router.push("/calendar");
          break;
        case "go-reservations":
          router.push("/reservations");
          break;
        case "go-guests":
          router.push("/guests");
          break;
        case "go-pos":
          router.push("/pos");
          break;
        case "go-messages":
          router.push("/messages");
          break;
        case "go-settings":
          router.push("/settings");
          break;
      }
    },
    [router]
  );

  // Track focus state
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      setIsInputFocused(isInput);
    };

    const handleFocusOut = () => {
      setIsInputFocused(false);
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // Check for "?" to show shortcuts dialog
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setShowShortcutsDialog(true);
        return;
      }

      // Normalize key names
      const key = e.key.toLowerCase();
      const hasCmd = e.metaKey || e.ctrlKey;
      const hasShift = e.shiftKey;
      const hasAlt = e.altKey;

      // Check for sequential shortcuts (e.g., "G then D")
      const sequentialShortcuts = shortcuts.filter((s) => s.sequential && s.enabled);

      if (!sequentialPrimed.current && key === "g" && !hasCmd && !isTyping) {
        sequentialPrimed.current = true;
        if (sequentialTimer.current) clearTimeout(sequentialTimer.current);
        sequentialTimer.current = setTimeout(() => {
          sequentialPrimed.current = false;
        }, 1000);
        return;
      }

      if (sequentialPrimed.current) {
        const matchingShortcut = sequentialShortcuts.find((s) => {
          return s.keys[0] === "g" && s.keys[1] === key;
        });

        if (matchingShortcut) {
          e.preventDefault();
          sequentialPrimed.current = false;
          if (sequentialTimer.current) clearTimeout(sequentialTimer.current);
          executeAction(matchingShortcut.action);
          return;
        }
      }

      // Check for regular shortcuts
      for (const shortcut of shortcuts) {
        if (!shortcut.enabled || shortcut.sequential) continue;

        // Skip non-global shortcuts when typing
        if (!shortcut.global && isTyping) continue;

        const shortcutKeys = shortcut.keys.map((k) => k.toLowerCase());

        // Check if this is a modifier + key shortcut
        if (shortcutKeys.includes("cmd") || shortcutKeys.includes("ctrl")) {
          if (!hasCmd) continue;

          const nonModifierKeys = shortcutKeys.filter(
            (k) => !["cmd", "ctrl", "shift", "alt"].includes(k)
          );

          if (nonModifierKeys.length === 1 && nonModifierKeys[0] === key) {
            // Check shift requirement
            if (shortcutKeys.includes("shift") && !hasShift) continue;
            if (!shortcutKeys.includes("shift") && hasShift) continue;

            e.preventDefault();
            executeAction(shortcut.action);
            return;
          }
        } else if (shortcutKeys.length === 1 && shortcutKeys[0] === key && !hasCmd) {
          e.preventDefault();
          executeAction(shortcut.action);
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (sequentialTimer.current) clearTimeout(sequentialTimer.current);
    };
  }, [shortcuts, executeAction]);

  // Expose refs for external components to register callbacks
  useEffect(() => {
    // Store these in window for easy access from other components
    if (typeof window !== "undefined") {
      (window as any).__keyboardShortcuts = {
        onSearch: (fn: () => void) => {
          onSearchRef.current = fn;
        },
        onHelp: (fn: () => void) => {
          onHelpRef.current = fn;
        },
        onNewBooking: (fn: () => void) => {
          onNewBookingRef.current = fn;
        },
        onCloseModal: (fn: () => void) => {
          onCloseModalRef.current = fn;
        },
      };
    }
  }, []);

  const value: KeyboardShortcutsContextValue = {
    shortcuts,
    registerShortcut,
    unregisterShortcut,
    showShortcutsDialog,
    setShowShortcutsDialog,
    isInputFocused,
  };

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}
