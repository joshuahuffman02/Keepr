"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Home,
  Settings,
  MessageSquare,
  ShoppingCart,
  FileText,
  CreditCard,
  ClipboardList,
  Search,
  Plus,
  Building2,
  UserPlus,
  DollarSign,
  BarChart3,
  Truck,
  Bell,
  HelpCircle,
  Keyboard,
  Moon,
  Sun,
  Laptop,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useKeyboardShortcuts } from "@/contexts/KeyboardShortcutsContext";
import { useTheme } from "next-themes";

interface CommandOption {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

export function GlobalCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { setShowShortcutsDialog } = useKeyboardShortcuts();
  const { setTheme, theme } = useTheme();

  // Register the search callback with keyboard shortcuts system
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const shortcuts = window.__keyboardShortcuts;
    if (shortcuts) {
      shortcuts.onSearch(() => {
        setOpen(true);
      });
    }
  }, []);

  // Also listen for Cmd+K directly as a fallback
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const navigationCommands: CommandOption[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: Home,
      shortcut: "G D",
      action: () => router.push("/dashboard"),
      keywords: ["home", "overview", "stats"],
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: Calendar,
      shortcut: "G C",
      action: () => router.push("/calendar"),
      keywords: ["booking", "schedule", "availability"],
    },
    {
      id: "reservations",
      label: "Reservations",
      icon: ClipboardList,
      shortcut: "G R",
      action: () => router.push("/reservations"),
      keywords: ["bookings", "stays"],
    },
    {
      id: "guests",
      label: "Guests",
      icon: Users,
      shortcut: "G G",
      action: () => router.push("/guests"),
      keywords: ["customers", "people", "contacts"],
    },
    {
      id: "pos",
      label: "Point of Sale",
      icon: ShoppingCart,
      shortcut: "G P",
      action: () => router.push("/pos"),
      keywords: ["store", "shop", "retail", "checkout"],
    },
    {
      id: "messages",
      label: "Messages",
      icon: MessageSquare,
      shortcut: "G M",
      action: () => router.push("/messages"),
      keywords: ["inbox", "chat", "communication"],
    },
    {
      id: "finance",
      label: "Finance",
      icon: DollarSign,
      action: () => router.push("/finance"),
      keywords: ["money", "payments", "accounting", "revenue"],
    },
    {
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      action: () => router.push("/reports"),
      keywords: ["analytics", "stats", "metrics"],
    },
    {
      id: "operations",
      label: "Operations",
      icon: Truck,
      action: () => router.push("/operations"),
      keywords: ["tasks", "housekeeping", "maintenance"],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      shortcut: "G S",
      action: () => router.push("/settings"),
      keywords: ["config", "preferences", "options"],
    },
  ];

  const quickActions: CommandOption[] = [
    {
      id: "new-reservation",
      label: "New Reservation",
      icon: Plus,
      action: () => router.push("/booking"),
      keywords: ["create", "book", "add"],
    },
    {
      id: "new-guest",
      label: "Add Guest",
      icon: UserPlus,
      action: () => router.push("/guests?action=new"),
      keywords: ["create", "add", "customer"],
    },
    {
      id: "quick-checkin",
      label: "Quick Check-in",
      icon: FileText,
      action: () => router.push("/check-in"),
      keywords: ["arrival", "register"],
    },
    {
      id: "process-payment",
      label: "Process Payment",
      icon: CreditCard,
      action: () => router.push("/pos"),
      keywords: ["charge", "pay", "collect"],
    },
  ];

  const themeCommands: CommandOption[] = [
    {
      id: "theme-light",
      label: "Light Mode",
      icon: Sun,
      action: () => setTheme("light"),
      keywords: ["theme", "appearance", "bright"],
    },
  ];

  const helpCommands: CommandOption[] = [
    {
      id: "keyboard-shortcuts",
      label: "Keyboard Shortcuts",
      icon: Keyboard,
      shortcut: "?",
      action: () => setShowShortcutsDialog(true),
      keywords: ["help", "hotkeys", "keys"],
    },
    {
      id: "help",
      label: "Help & Support",
      icon: HelpCircle,
      action: () => router.push("/dashboard/help"),
      keywords: ["support", "docs", "documentation"],
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          {quickActions.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={`${cmd.label} ${cmd.keywords?.join(" ") || ""}`}
              onSelect={() => runCommand(cmd.action)}
            >
              <cmd.icon className="mr-2 h-4 w-4" />
              <span>{cmd.label}</span>
              {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {navigationCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={`${cmd.label} ${cmd.keywords?.join(" ") || ""}`}
              onSelect={() => runCommand(cmd.action)}
            >
              <cmd.icon className="mr-2 h-4 w-4" />
              <span>{cmd.label}</span>
              {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          {themeCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={`${cmd.label} ${cmd.keywords?.join(" ") || ""}`}
              onSelect={() => runCommand(cmd.action)}
            >
              <cmd.icon className="mr-2 h-4 w-4" />
              <span>{cmd.label}</span>
              {theme === cmd.id.replace("theme-", "") && (
                <span className="ml-2 text-xs text-muted-foreground">(current)</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Help">
          {helpCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={`${cmd.label} ${cmd.keywords?.join(" ") || ""}`}
              onSelect={() => runCommand(cmd.action)}
            >
              <cmd.icon className="mr-2 h-4 w-4" />
              <span>{cmd.label}</span>
              {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
