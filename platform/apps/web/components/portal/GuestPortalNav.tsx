"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Gift,
  CalendarCog,
  Ticket,
  ShoppingBag,
  Wallet,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { GUEST_TOKEN_KEY, SPRING_CONFIG } from "@/lib/portal-constants";

const NAV_ITEMS = [
  { href: "/portal/my-stay", label: "My Stay", icon: Home },
  { href: "/portal/manage", label: "Manage", icon: CalendarCog },
  { href: "/portal/rewards", label: "Rewards", icon: Gift },
  { href: "/portal/store", label: "Store", icon: ShoppingBag },
  { href: "/portal/activities", label: "Activities", icon: Ticket },
  { href: "/portal/wallet", label: "Wallet", icon: Wallet },
];

// Mobile bottom nav - shows 5 main items
const MOBILE_NAV_ITEMS = [
  { href: "/portal/my-stay", label: "Stay", icon: Home },
  { href: "/portal/manage", label: "Manage", icon: CalendarCog },
  { href: "/portal/rewards", label: "Rewards", icon: Gift },
  { href: "/portal/store", label: "Store", icon: ShoppingBag },
  { href: "/portal/wallet", label: "Wallet", icon: Wallet },
];

interface GuestPortalNavProps {
  guestName?: string;
}

export function GuestPortalTopNav({ guestName }: GuestPortalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem(GUEST_TOKEN_KEY);
    router.push("/portal/login");
  };

  return (
    <>
      {/* Desktop Top Nav */}
      <header className="hidden md:block sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Brand */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Home className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-lg text-foreground">
                Guest Portal
              </span>
            </div>

            {/* Nav Links */}
            <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-x-2 -bottom-[17px] h-0.5 bg-primary"
                        transition={SPRING_CONFIG}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {guestName && (
                <span className="text-sm text-muted-foreground">
                  Welcome, {guestName}
                </span>
              )}
              <button
                onClick={handleLogout}
                aria-label="Logout"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 rounded-lg"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Top Bar */}
      <header className="md:hidden sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-foreground">
              Guest Portal
            </span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute top-14 left-0 right-0 bg-card border-b border-border shadow-lg"
            >
              <nav className="p-2" role="navigation" aria-label="Mobile navigation">
                {NAV_ITEMS.map((item, index) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.href}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        router.push(item.href);
                        setMobileMenuOpen(false);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </motion.button>
                  );
                })}
                <div className="border-t border-border mt-2 pt-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

export function GuestPortalBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all",
                "min-w-[60px] min-h-[44px]", // 44px touch target
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary"
                    transition={SPRING_CONFIG}
                  />
                )}
              </div>
              <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
