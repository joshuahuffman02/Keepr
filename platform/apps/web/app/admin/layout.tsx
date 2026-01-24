"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Shield,
  Users,
  HeadphonesIcon,
  BarChart3,
  RefreshCw,
  Megaphone,
  Building2,
  LayoutDashboard,
  ExternalLink,
  LogOut,
  ChevronRight,
  Zap,
  TrendingUp,
  Heart,
  Menu,
  X,
  Bug,
} from "lucide-react";
import { signOut } from "next-auth/react";

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Campgrounds",
    icon: Building2,
    children: [
      { title: "View All", href: "/admin/campgrounds" },
      { title: "Create New", href: "/admin/campgrounds/new" },
    ],
  },
  {
    title: "Support",
    icon: HeadphonesIcon,
    children: [
      { title: "All Tickets", href: "/admin/support" },
      { title: "Analytics", href: "/admin/support/analytics" },
      { title: "Staff", href: "/admin/support/staff" },
    ],
  },
  {
    title: "Platform",
    icon: Users,
    children: [
      { title: "Staff", href: "/admin/platform/users" },
      { title: "Directory", href: "/admin/users" },
    ],
  },
  {
    title: "Marketing",
    icon: Megaphone,
    children: [{ title: "Leads", href: "/admin/marketing/leads" }],
  },
  {
    title: "Charity",
    icon: Heart,
    children: [
      { title: "Charities", href: "/admin/charity" },
      { title: "Reports", href: "/admin/charity/reports" },
    ],
  },
  {
    title: "Guest Insights",
    icon: TrendingUp,
    children: [
      { title: "Analytics", href: "/admin/guests" },
      { title: "Segments", href: "/admin/guests/segments" },
      { title: "Trends", href: "/admin/guests/trends" },
    ],
  },
  {
    title: "Analytics Hub",
    icon: BarChart3,
    children: [
      { title: "Executive", href: "/admin/analytics/executive" },
      { title: "Platform Growth", href: "/admin/analytics/growth" },
      { title: "Overview", href: "/admin/analytics" },
      { title: "Revenue", href: "/admin/analytics/revenue" },
      { title: "Guests", href: "/admin/analytics/guests" },
      { title: "Accommodations", href: "/admin/analytics/accommodations" },
      { title: "Geographic", href: "/admin/analytics/geographic" },
      { title: "Booking", href: "/admin/analytics/booking" },
      { title: "Length of Stay", href: "/admin/analytics/los" },
      { title: "Amenities", href: "/admin/analytics/amenities" },
      { title: "Benchmarks", href: "/admin/analytics/benchmarks" },
      { title: "NPS", href: "/admin/analytics/nps" },
      { title: "Compare", href: "/admin/analytics/compare" },
      { title: "Goals", href: "/admin/analytics/goals" },
      { title: "AI Insights", href: "/admin/analytics/insights" },
      { title: "Export", href: "/admin/analytics/export" },
    ],
  },
  {
    title: "System",
    icon: RefreshCw,
    children: [
      { title: "Health", href: "/admin/system/health" },
      { title: "Audit Log", href: "/admin/system/audit" },
      { title: "Feature Flags", href: "/admin/system/flags" },
      { title: "Announcements", href: "/admin/system/announcements" },
      { title: "Sync Summary", href: "/admin/sync-summary" },
      { title: "Issues", href: "/admin/system/issues" },
    ],
  },
  {
    title: "IoT",
    icon: Zap,
    children: [{ title: "Devices", href: "/admin/devices" }],
  },
];

function NavItem({ item, pathname }: { item: (typeof adminNavItems)[0]; pathname: string }) {
  const isActive = item.href === pathname || item.children?.some((c) => c.href === pathname);
  const Icon = item.icon;

  if (item.children) {
    return (
      <div className="space-y-2">
        <div
          className={`flex items-center gap-3 px-3 h-11 text-[15px] font-medium rounded-xl transition-colors ${
            isActive ? "bg-muted/60 text-foreground font-semibold" : "text-muted-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
          {item.title}
        </div>
        <div className="ml-8 space-y-2">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={`flex items-center gap-2 px-3 h-10 text-[14px] font-medium rounded-xl transition-colors ${
                pathname === child.href
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              <ChevronRight className="h-3 w-3" />
              {child.title}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={`flex items-center gap-3 px-3 h-11 text-[15px] font-medium rounded-xl transition-colors ${
        pathname === item.href
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
      }`}
    >
      <Icon className="h-5 w-5" />
      {item.title}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border" />
      </div>
    );
  }

  // @ts-ignore - platformRole not in NextAuth v5 beta types (works at runtime)
  const isPlatformAdmin = session?.user?.platformRole === "platform_admin";

  // Not logged in - show login prompt
  if (!session) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="bg-card p-8 rounded-lg shadow-lg text-center max-w-md border border-border">
          <Shield className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Admin Login Required</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in to access the platform admin area.
          </p>
          <Link
            href="/auth/signin?callbackUrl=/admin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Logged in but not platform admin - show Access Denied
  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="bg-card p-8 rounded-lg shadow-lg text-center max-w-md border border-border">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-2">
            You need platform admin privileges to access this area.
          </p>
          <p className="text-muted-foreground text-sm mb-4">Signed in as: {session.user?.email}</p>
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700"
            >
              Return to Home
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/admin" })}
              className="inline-flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground text-sm"
            >
              <LogOut className="h-4 w-4" />
              Sign in with a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            <span className="text-lg font-bold text-foreground">Platform Admin</span>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-5 space-y-6 overflow-y-auto">
        {adminNavItems.map((item) => (
          <NavItem key={item.title} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border space-y-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 h-11 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Staff Dashboard
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 px-3 h-11 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
        <div className="px-3 py-2 text-xs text-muted-foreground">{session.user?.email}</div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-muted flex">
      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-[280px] bg-card border-r border-border flex-col">
        {sidebarContent}
      </aside>

      {/* Sidebar - Mobile (Slide-in) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-card border-r border-border flex flex-col transform transition-transform duration-200 ease-in-out md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-muted">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <span className="text-[15px] font-semibold text-foreground">Admin</span>
          </div>
        </div>

        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
