# Central Settings - Component Architecture & Domain Validation

## Component Architecture

### Directory Structure

```
platform/apps/web/
├── app/
│   └── dashboard/
│       └── settings/
│           └── central/
│               ├── layout.tsx              # Main settings layout with L1 tabs
│               ├── page.tsx                # Redirect to /property
│               ├── [category]/
│               │   ├── layout.tsx          # Category layout with L2 tabs
│               │   └── [section]/
│               │       └── page.tsx        # Section content
│               └── components/
│                   ├── SettingsShell.tsx   # Overall shell wrapper
│                   ├── SettingsSearch.tsx  # Global Cmd+K search
│                   └── SettingsProgress.tsx # Setup progress tracker
│
├── components/
│   └── settings/
│       ├── navigation/
│       │   ├── CategoryTabs.tsx       # Level 1 tabs (icons + labels)
│       │   ├── SectionTabs.tsx        # Level 2 tabs (scrollable)
│       │   └── ContentTabs.tsx        # Level 3 tabs (within forms)
│       │
│       ├── tables/
│       │   ├── SettingsTable.tsx      # Reusable data table
│       │   ├── StatusFilter.tsx       # Active/Inactive/All toggle
│       │   ├── TableSearch.tsx        # Search input for tables
│       │   └── TablePagination.tsx    # Pagination controls
│       │
│       ├── system-check/
│       │   ├── SystemCheckCard.tsx    # Dashboard card
│       │   ├── IssueRow.tsx           # Individual issue
│       │   └── SystemCheckBadge.tsx   # Count badge for nav
│       │
│       ├── rate-groups/
│       │   ├── RateGroupList.tsx      # List of rate groups
│       │   ├── RateGroupRow.tsx       # Single rate group
│       │   ├── ColorPicker.tsx        # Color selection popover
│       │   └── DateRangeEditor.tsx    # Date range management
│       │
│       ├── custom-fields/
│       │   ├── CustomFieldList.tsx    # Sortable field list
│       │   ├── CustomFieldRow.tsx     # Single draggable field
│       │   ├── FieldTypeSelector.tsx  # Type radio cards
│       │   └── FieldEditorModal.tsx   # Create/edit modal
│       │
│       ├── optimization/
│       │   ├── OptimizationCard.tsx   # Main settings card
│       │   ├── SiteClassSelector.tsx  # Multi-select toggles
│       │   ├── OptimizationLog.tsx    # Activity history
│       │   └── PreviewPanel.tsx       # Preview suggested changes
│       │
│       └── equipment/
│           ├── EquipmentTypeList.tsx  # Equipment type table
│           └── EquipmentTypeForm.tsx  # Create/edit form
```

---

## Core Components

### 1. CategoryTabs (Level 1)

```tsx
// components/settings/navigation/CategoryTabs.tsx
"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, DollarSign, Calendar, ShoppingCart, Shield, Settings
} from "lucide-react";

const categories = [
  { id: "property", label: "Property", icon: Building2, href: "/dashboard/settings/central/property" },
  { id: "pricing", label: "Pricing", icon: DollarSign, href: "/dashboard/settings/central/pricing" },
  { id: "bookings", label: "Bookings", icon: Calendar, href: "/dashboard/settings/central/bookings" },
  { id: "store", label: "Store", icon: ShoppingCart, href: "/dashboard/settings/central/store" },
  { id: "access", label: "Access", icon: Shield, href: "/dashboard/settings/central/access" },
  { id: "system", label: "System", icon: Settings, href: "/dashboard/settings/central/system" },
];

export function CategoryTabs() {
  const pathname = usePathname();
  const activeCategory = categories.find(c => pathname.startsWith(c.href))?.id;

  return (
    <div className="border-b bg-white">
      <nav
        role="tablist"
        aria-label="Settings categories"
        className="flex items-center gap-1 px-4 overflow-x-auto"
      >
        {categories.map((category) => {
          const isActive = category.id === activeCategory;
          const Icon = category.icon;

          return (
            <Link
              key={category.id}
              href={category.href}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${category.id}-panel`}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium",
                "border-b-2 transition-colors whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset",
                isActive
                  ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{category.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

### 2. SectionTabs (Level 2)

```tsx
// components/settings/navigation/SectionTabs.tsx
"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";

interface Section {
  id: string;
  label: string;
  href: string;
}

interface SectionTabsProps {
  sections: Section[];
  categoryId: string;
}

export function SectionTabs({ sections, categoryId }: SectionTabsProps) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();

      if (activeRect.left < containerRect.left || activeRect.right > containerRect.right) {
        active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [pathname]);

  return (
    <div
      ref={containerRef}
      className="border-b bg-slate-50 overflow-x-auto scrollbar-hide"
    >
      <nav
        role="tablist"
        aria-label={`${categoryId} sections`}
        className="flex items-center gap-1 px-4 min-w-max"
      >
        {sections.map((section) => {
          const isActive = pathname === section.href ||
                          pathname.startsWith(`${section.href}/`);

          return (
            <Link
              key={section.id}
              ref={isActive ? activeRef : null}
              href={section.href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "px-3 py-2 text-sm transition-colors whitespace-nowrap",
                "border-b-2 -mb-px",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset",
                isActive
                  ? "border-slate-900 text-slate-900 font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

### 3. SettingsTable (Reusable)

```tsx
// components/settings/tables/SettingsTable.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { StatusFilter, StatusValue } from "./StatusFilter";
import { TablePagination } from "./TablePagination";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface SettingsTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  addLabel?: string;
  onAdd?: () => void;
  onRowClick?: (item: T) => void;
  getRowActions?: (item: T) => React.ReactNode;
  getItemStatus?: (item: T) => "active" | "inactive";
  emptyState?: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  };
  pageSize?: number;
}

export function SettingsTable<T extends { id: string }>({
  data,
  columns,
  searchPlaceholder = "Search...",
  searchFields,
  addLabel = "Add",
  onAdd,
  onRowClick,
  getRowActions,
  getItemStatus,
  emptyState,
  pageSize = 10,
}: SettingsTableProps<T>) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusValue>("all");
  const [page, setPage] = useState(1);

  // Filter data
  const filteredData = data.filter((item) => {
    // Status filter
    if (status !== "all" && getItemStatus) {
      const itemStatus = getItemStatus(item);
      if (status === "active" && itemStatus !== "active") return false;
      if (status === "inactive" && itemStatus !== "inactive") return false;
    }

    // Search filter
    if (search && searchFields) {
      const searchLower = search.toLowerCase();
      return searchFields.some((field) => {
        const value = item[field];
        return String(value).toLowerCase().includes(searchLower);
      });
    }

    return true;
  });

  // Paginate
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: StatusValue) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-64"
              aria-label={searchPlaceholder}
            />
          </div>
          {onAdd && (
            <Button onClick={onAdd}>
              <Plus className="h-4 w-4 mr-2" />
              {addLabel}
            </Button>
          )}
        </div>

        {getItemStatus && (
          <StatusFilter value={status} onChange={handleStatusChange} />
        )}
      </div>

      {/* Table */}
      {paginatedData.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider",
                      column.className
                    )}
                  >
                    {column.label}
                  </th>
                ))}
                {getRowActions && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedData.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "hover:bg-slate-50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={cn("px-4 py-3 text-sm", column.className)}
                    >
                      {column.render
                        ? column.render(item)
                        : String(item[column.key as keyof T] ?? "")}
                    </td>
                  ))}
                  {getRowActions && (
                    <td className="px-4 py-3 text-right">
                      {getRowActions(item)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Empty state
        emptyState && (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <emptyState.icon className="h-10 w-10 mx-auto text-slate-400" />
            <h3 className="mt-3 font-medium text-slate-900">{emptyState.title}</h3>
            <p className="text-sm text-slate-500 mt-1">{emptyState.description}</p>
            {onAdd && (
              <Button className="mt-4" onClick={onAdd}>
                <Plus className="h-4 w-4 mr-2" />
                {addLabel}
              </Button>
            )}
          </div>
        )
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredData.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
```

### 4. StatusFilter

```tsx
// components/settings/tables/StatusFilter.tsx
"use client";

import { cn } from "@/lib/utils";

export type StatusValue = "active" | "inactive" | "all";

interface StatusFilterProps {
  value: StatusValue;
  onChange: (value: StatusValue) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const options: { value: StatusValue; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "all", label: "All" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Filter by status"
      className="flex rounded-lg border p-1 bg-white"
    >
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            value === option.value
              ? "bg-emerald-100 text-emerald-700"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

### 5. SystemCheckCard

```tsx
// components/settings/system-check/SystemCheckCard.tsx
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCircle2, Info, ChevronRight, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Issue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onFix?: () => Promise<void>;
}

interface SystemCheckCardProps {
  issues: Issue[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

const severityConfig = {
  error: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50",
    badge: "bg-red-100 text-red-800",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-800",
  },
};

export function SystemCheckCard({ issues, isLoading, onRefresh }: SystemCheckCardProps) {
  const [fixingId, setFixingId] = useState<string | null>(null);

  const actionableCount = issues.filter(i => i.severity !== "info").length;

  const handleFix = async (issue: Issue) => {
    if (!issue.onFix) return;
    setFixingId(issue.id);
    try {
      await issue.onFix();
    } finally {
      setFixingId(null);
    }
  };

  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
          <h3 className="mt-3 font-medium text-slate-900">All systems go!</h3>
          <p className="text-sm text-slate-500 mt-1">
            No configuration issues detected
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          System Check
        </CardTitle>
        <div className="flex items-center gap-2">
          {actionableCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 animate-in zoom-in duration-300">
              {actionableCount} to review
            </Badge>
          )}
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          {issues.map((issue) => {
            const config = severityConfig[issue.severity];
            const Icon = config.icon;
            const isFixing = fixingId === issue.id;

            return (
              <div
                key={issue.id}
                className="flex items-center justify-between py-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-1 rounded", config.bg)}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <span className="text-sm">{issue.message}</span>
                </div>

                {(issue.actionHref || issue.onFix) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isFixing}
                    onClick={() => issue.onFix && handleFix(issue)}
                    asChild={!!issue.actionHref}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {issue.actionHref ? (
                      <a href={issue.actionHref}>
                        {issue.actionLabel || "Fix"} <ChevronRight className="h-4 w-4 ml-1" />
                      </a>
                    ) : (
                      <>
                        {isFixing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {issue.actionLabel || "Fix now"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Domain Validation: Campground Operations

### Grid Optimization Rules

Based on campground operations, the optimization engine MUST respect:

```typescript
interface OptimizationRules {
  // Hard constraints - NEVER violate
  hardConstraints: {
    // Accessibility requirements are non-negotiable
    accessibilityRequirements: boolean;
    // Guest-locked sites (explicitly requested specific site)
    guestLockedSites: boolean;
    // Site class must match booking
    siteClassMatch: boolean;
    // RV length fits in site
    rigLengthFits: boolean;
    // Hookup requirements met
    hookupRequirements: boolean;
  };

  // Soft constraints - prefer to respect
  softConstraints: {
    // Early check-in requests (keep near office)
    earlyCheckIn: boolean;
    // Late checkout requests
    lateCheckout: boolean;
    // Guest preferences (waterfront, shaded, etc.)
    guestPreferences: boolean;
    // Repeat guest's previous site
    repeatGuestPreference: boolean;
    // Group bookings stay together
    groupProximity: boolean;
  };

  // Optimization goals
  goals: {
    // Maximize revenue per site
    maximizeRevenue: boolean;
    // Fill gaps (prevent 1-night holes)
    fillGaps: boolean;
    // Cluster similar stay lengths
    clusterByLength: boolean;
  };
}
```

### Typical Rate Seasons

```typescript
const typicalRateGroups = [
  // Peak seasons
  { name: "Peak Summer", color: "#ef4444", months: ["Jun", "Jul", "Aug"] },
  { name: "Holiday", color: "#f97316", dates: "major holidays" },

  // Shoulder seasons
  { name: "Spring", color: "#84cc16", months: ["Apr", "May"] },
  { name: "Fall", color: "#eab308", months: ["Sep", "Oct"] },

  // Off-peak
  { name: "Winter", color: "#3b82f6", months: ["Nov", "Dec", "Jan", "Feb", "Mar"] },

  // Special events
  { name: "Rally Weekend", color: "#8b5cf6", dates: "event-specific" },
  { name: "Closed", color: "#64748b", dates: "seasonal closure" },
];
```

### Common Custom Fields (UDFs)

```typescript
const commonCustomFields = [
  // Arrival info
  { question: "Estimated arrival time", type: "TIME", displayAt: ["RESERVATION"] },
  { question: "Are you a first-time visitor?", type: "YES_NO", displayAt: ["RESERVATION"] },

  // Vehicle info (not covered by standard rig fields)
  { question: "Number of vehicles", type: "NUMBER", displayAt: ["RESERVATION"] },
  { question: "Tow vehicle length (ft)", type: "NUMBER", displayAt: ["RESERVATION"] },
  { question: "Do you need a pull-through site?", type: "YES_NO", displayAt: ["RESERVATION"] },

  // Special needs
  { question: "Do you have accessibility requirements?", type: "YES_NO", displayAt: ["RESERVATION"] },
  { question: "Accessibility needs (describe)", type: "TEXT", displayAt: ["RESERVATION"] },

  // Preferences
  { question: "Site preference", type: "DROPDOWN", options: ["No preference", "Waterfront", "Shaded", "Near facilities", "Quiet area"], displayAt: ["RESERVATION"] },
  { question: "How did you hear about us?", type: "DROPDOWN", displayAt: ["RESERVATION"] },

  // Check-in
  { question: "Gate code received?", type: "YES_NO", displayAt: ["CHECKIN"] },
  { question: "Rules acknowledged?", type: "YES_NO", required: true, displayAt: ["CHECKIN"] },

  // Emergency
  { question: "Emergency contact name", type: "TEXT", displayAt: ["REGISTRATION"] },
  { question: "Emergency contact phone", type: "TEXT", displayAt: ["REGISTRATION"] },
];
```

### Site Closure Reasons

```typescript
const siteClosureReasons = [
  // Maintenance
  { code: "MAINT", label: "Scheduled Maintenance", requiresNotes: false },
  { code: "REPAIR", label: "Repairs Needed", requiresNotes: true },
  { code: "UPGRADE", label: "Site Upgrade", requiresNotes: false },

  // Natural/Environmental
  { code: "TREE", label: "Tree Limb/Hazard", requiresNotes: true },
  { code: "FLOOD", label: "Flooding/Drainage", requiresNotes: false },
  { code: "STORM", label: "Storm Damage", requiresNotes: true },

  // Utility issues
  { code: "ELEC", label: "Electrical Issue", requiresNotes: true },
  { code: "WATER", label: "Water/Plumbing Issue", requiresNotes: true },
  { code: "SEWER", label: "Sewer Issue", requiresNotes: true },

  // Administrative
  { code: "OWNER", label: "Owner Use", requiresNotes: false },
  { code: "SEASON", label: "Seasonal Closure", requiresNotes: false },
  { code: "OTHER", label: "Other", requiresNotes: true },
];
```

### Lock Codes (Site Lock Reasons)

```typescript
const lockCodes = [
  // Guest-initiated
  { code: "REQUEST", label: "Guest Requested Site", chargeCode: null },
  { code: "RETURN", label: "Returning Guest Preference", chargeCode: null },
  { code: "ACCESS", label: "Accessibility Requirement", chargeCode: null },

  // Staff-initiated
  { code: "GROUP", label: "Group Booking", chargeCode: null },
  { code: "EARLY", label: "Early Check-in Arranged", chargeCode: "EARLY_CHECKIN" },
  { code: "LATE", label: "Late Checkout Arranged", chargeCode: "LATE_CHECKOUT" },
  { code: "VIP", label: "VIP/Special Guest", chargeCode: null },

  // Operational
  { code: "MANAGER", label: "Manager Hold", chargeCode: null, requiresComment: true },
  { code: "OTA", label: "OTA Specific Site", chargeCode: null },
];
```

### Equipment Types

```typescript
const equipmentTypes = [
  // Towable RVs
  { name: "Travel Trailer", requiresLength: true, requiresTow: true, bufferLength: 5 },
  { name: "Fifth Wheel", requiresLength: true, requiresTow: true, bufferLength: 5 },
  { name: "Toy Hauler", requiresLength: true, requiresTow: true, bufferLength: 5 },
  { name: "Pop-up/Folding", requiresLength: false, requiresTow: true, bufferLength: 0 },
  { name: "Teardrop", requiresLength: false, requiresTow: true, bufferLength: 0 },

  // Motorized RVs
  { name: "Class A Motorhome", requiresLength: true, requiresTow: false, bufferLength: 0 },
  { name: "Class B Van", requiresLength: false, requiresTow: false, bufferLength: 0 },
  { name: "Class C Motorhome", requiresLength: true, requiresTow: false, bufferLength: 0 },

  // Towing with motorhome
  { name: "Motorhome + Toad", requiresLength: true, requiresTow: true, bufferLength: 10 },

  // Other
  { name: "Truck Camper", requiresLength: false, requiresTow: false, bufferLength: 0 },
  { name: "Tent", requiresLength: false, requiresTow: false, bufferLength: 0 },
  { name: "Vehicle Only", requiresLength: false, requiresTow: false, bufferLength: 0 },

  // Special
  { name: "Horse Trailer", requiresLength: true, requiresTow: true, bufferLength: 10 },
  { name: "Boat/Watercraft", requiresLength: true, requiresTow: true, bufferLength: 5 },
];
```

---

## State Management

### URL-Driven Navigation State

```typescript
// All navigation state lives in the URL for shareability/bookmarks
// /dashboard/settings/central/pricing/rate-groups?tab=calendar&filter=active&page=2

interface SettingsURLState {
  category: string;       // L1: property, pricing, bookings, store, access, system
  section: string;        // L2: varies by category
  contentTab?: string;    // L3: varies by section
  filter?: "active" | "inactive" | "all";
  search?: string;
  page?: number;
}

// Hook for managing settings URL state
function useSettingsNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const state: SettingsURLState = {
    category: pathname.split("/")[4] || "property",
    section: pathname.split("/")[5] || "",
    contentTab: searchParams.get("tab") || undefined,
    filter: (searchParams.get("filter") as any) || "all",
    search: searchParams.get("search") || undefined,
    page: Number(searchParams.get("page")) || 1,
  };

  const navigate = (updates: Partial<SettingsURLState>) => {
    const newState = { ...state, ...updates };
    const params = new URLSearchParams();

    if (newState.contentTab) params.set("tab", newState.contentTab);
    if (newState.filter !== "all") params.set("filter", newState.filter);
    if (newState.search) params.set("search", newState.search);
    if (newState.page > 1) params.set("page", String(newState.page));

    const query = params.toString();
    const path = `/dashboard/settings/central/${newState.category}/${newState.section}`;

    router.push(query ? `${path}?${query}` : path);
  };

  return { state, navigate };
}
```

### Settings Context (for cross-component state)

```typescript
// For state that needs to be shared across settings components
interface SettingsContextValue {
  // System check badge count (shown in nav)
  systemCheckCount: number;
  refreshSystemCheck: () => void;

  // Unsaved changes warning
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;

  // Search
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [systemCheckCount, setSystemCheckCount] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Fetch system check count
  const refreshSystemCheck = useCallback(async () => {
    const response = await fetch("/api/system-check/count");
    const data = await response.json();
    setSystemCheckCount(data.count);
  }, []);

  useEffect(() => {
    refreshSystemCheck();
  }, [refreshSystemCheck]);

  // Keyboard shortcut for search
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

  return (
    <SettingsContext.Provider
      value={{
        systemCheckCount,
        refreshSystemCheck,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        isSearchOpen,
        openSearch: () => setIsSearchOpen(true),
        closeSearch: () => setIsSearchOpen(false),
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
```

---

## Shadcn/ui Components to Leverage

| Component | Use Case |
|-----------|----------|
| `Tabs` | Base for L3 content tabs |
| `Dialog` | Modals (field editor, confirmations) |
| `Popover` | Color picker, quick actions |
| `Select` | Mobile category dropdown |
| `Switch` | Toggle settings |
| `Toggle` | Multi-select buttons (site classes) |
| `Input` | Search, text fields |
| `Button` | Actions throughout |
| `Badge` | Status indicators, counts |
| `Card` | Content containers |
| `Alert` | Trust-building messages |
| `Toast` | Success/error feedback |
| `DropdownMenu` | Row actions |
| `Skeleton` | Loading states |

---

## Implementation Order

Based on domain importance and dependencies:

### Phase 1: Navigation Foundation
1. `CategoryTabs` - L1 navigation
2. `SectionTabs` - L2 navigation
3. `SettingsShell` - Layout wrapper
4. Route structure setup

### Phase 2: Core Components
1. `SettingsTable` - Reusable table
2. `StatusFilter` - Active/Inactive/All
3. `TablePagination` - Pagination
4. `SettingsSearch` - Global search

### Phase 3: System Check (High Impact)
1. `SystemCheckCard` - Dashboard display
2. System check API endpoint
3. Issue detection logic

### Phase 4: Rate Groups (High Value)
1. `RateGroupList` - List view
2. `ColorPicker` - Color selection
3. `DateRangeEditor` - Date management
4. Calendar integration

### Phase 5: Custom Fields (Flexibility)
1. `CustomFieldList` - Sortable list
2. `FieldEditorModal` - Create/edit
3. Reservation form integration

### Phase 6: Grid Optimization (Advanced)
1. `OptimizationCard` - Settings UI
2. Optimization engine backend
3. `OptimizationLog` - Activity history
4. `PreviewPanel` - Preview mode

### Phase 7: Supporting Features
1. Equipment Types
2. Site Closures
3. Lock Codes
