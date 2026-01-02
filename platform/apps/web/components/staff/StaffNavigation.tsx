"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  CheckSquare,
  Receipt,
  Users,
  Download,
  Palmtree,
  CalendarDays,
  ChevronDown,
  ArrowLeftRight,
  Copy,
  BarChart3,
  Timer,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffNavigationProps {
  campgroundId: string;
}

type NavItem = {
  href: (id: string) => string;
  label: string;
  icon: typeof Calendar;
  matchPaths: string[];
};

type NavGroup = {
  id: string;
  label: string;
  icon: typeof Calendar;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "scheduling",
    label: "Scheduling",
    icon: Calendar,
    items: [
      {
        href: (id: string) => `/campgrounds/${id}/staff-scheduling`,
        label: "Calendar",
        icon: CalendarDays,
        matchPaths: ["/staff-scheduling"],
      },
      {
        href: (id: string) => `/campgrounds/${id}/staff/availability`,
        label: "Availability",
        icon: Clock,
        matchPaths: ["/staff/availability"],
      },
      {
        href: (id: string) => `/campgrounds/${id}/staff/swaps`,
        label: "Shift Swaps",
        icon: ArrowLeftRight,
        matchPaths: ["/staff/swaps"],
      },
      {
        href: (id: string) => `/campgrounds/${id}/staff/templates`,
        label: "Templates",
        icon: Copy,
        matchPaths: ["/staff/templates"],
      },
    ],
  },
  {
    id: "time-tracking",
    label: "Time Tracking",
    icon: Timer,
    items: [
      {
        href: (id: string) => `/campgrounds/${id}/staff/timeclock`,
        label: "Time Clock",
        icon: Clock,
        matchPaths: ["/staff/timeclock"],
      },
      {
        href: (id: string) => `/campgrounds/${id}/staff/approvals`,
        label: "Approvals",
        icon: CheckSquare,
        matchPaths: ["/staff/approvals"],
      },
      {
        href: (id: string) => `/campgrounds/${id}/staff/time-off`,
        label: "Time Off",
        icon: Palmtree,
        matchPaths: ["/staff/time-off"],
      },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    icon: DollarSign,
    items: [
      {
        href: (id: string) => `/campgrounds/${id}/staff/payroll`,
        label: "Export",
        icon: Download,
        matchPaths: ["/staff/payroll"],
      },
      {
        href: (id: string) => `/campgrounds/${id}/staff/reports`,
        label: "Reports",
        icon: BarChart3,
        matchPaths: ["/staff/reports"],
      },
      {
        href: (id: string) => `/campgrounds/${id}/staff/overrides`,
        label: "Overrides",
        icon: Receipt,
        matchPaths: ["/staff/overrides"],
      },
    ],
  },
];

export function StaffNavigation({ campgroundId }: StaffNavigationProps) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isItemActive = (matchPaths: string[]) => {
    return matchPaths.some((path) => pathname.includes(path));
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => isItemActive(item.matchPaths));
  };

  const getActiveLabel = (group: NavGroup) => {
    const activeItem = group.items.find((item) => isItemActive(item.matchPaths));
    return activeItem?.label || group.label;
  };

  return (
    <div className="mb-6" ref={navRef}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-action-primary flex items-center justify-center shadow-lg">
          <Users className="w-5 h-5 text-action-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
          <p className="text-sm text-muted-foreground">Schedule, track time, and manage your team</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav
        className="flex flex-wrap gap-2 p-1.5 bg-muted rounded-xl"
        role="navigation"
        aria-label="Staff management sections"
      >
        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const groupActive = isGroupActive(group);
          const isOpen = openGroup === group.id;

          return (
            <div key={group.id} className="relative">
              <button
                onClick={() => setOpenGroup(isOpen ? null : group.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  groupActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-expanded={isOpen}
                aria-haspopup="true"
              >
                <GroupIcon
                  className={cn("w-4 h-4", groupActive ? "text-action-primary" : "text-muted-foreground")}
                />
                <span className="hidden sm:inline">
                  {groupActive ? getActiveLabel(group) : group.label}
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-50 mt-1 left-0 min-w-[180px] bg-card rounded-xl shadow-lg border border-border py-1 overflow-hidden"
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isItemActive(item.matchPaths);

                      return (
                        <Link
                          key={item.label}
                          href={item.href(campgroundId)}
                          onClick={() => setOpenGroup(null)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                            active
                              ? "bg-teal-50 text-teal-700"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <Icon
                            className={cn(
                              "w-4 h-4",
                              active ? "text-teal-600" : "text-muted-foreground"
                            )}
                          />
                          <span className="font-medium">{item.label}</span>
                          {active && (
                            <motion.div
                              layoutId="staff-nav-active-dot"
                              className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500"
                            />
                          )}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
