"use client";

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
    TrendingUp
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
        children: [
            { title: "Leads", href: "/admin/marketing/leads" },
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
        ],
    },
    {
        title: "IoT",
        icon: Zap,
        children: [
            { title: "Devices", href: "/admin/devices" },
        ],
    },
];

function NavItem({ item, pathname }: { item: typeof adminNavItems[0]; pathname: string }) {
    const isActive = item.href === pathname || item.children?.some(c => c.href === pathname);
    const Icon = item.icon;

    if (item.children) {
        return (
            <div className="space-y-1">
                <div className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg ${isActive ? "text-white" : "text-slate-400"
                    }`}>
                    <Icon className="h-5 w-5" />
                    {item.title}
                </div>
                <div className="ml-8 space-y-1">
                    {item.children.map((child) => (
                        <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${pathname === child.href
                                ? "bg-slate-700 text-white"
                                : "text-slate-400 hover:text-white hover:bg-slate-800"
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
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === item.href
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
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

    if (status === "loading") {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
            </div>
        );
    }

    // @ts-ignore - platformRole might not be in types
    const isPlatformAdmin = session?.user?.platformRole === "platform_admin";

    // Not logged in - show login prompt
    if (!session) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="bg-slate-800 p-8 rounded-lg shadow-lg text-center max-w-md border border-slate-700">
                    <Shield className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Admin Login Required</h1>
                    <p className="text-slate-400 mb-6">
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
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="bg-slate-800 p-8 rounded-lg shadow-lg text-center max-w-md border border-slate-700">
                    <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                    <p className="text-slate-400 mb-2">
                        You need platform admin privileges to access this area.
                    </p>
                    <p className="text-slate-500 text-sm mb-4">
                        Signed in as: {session.user?.email}
                    </p>
                    <div className="flex flex-col gap-2">
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300"
                        >
                            Return to Home
                        </Link>
                        <button
                            onClick={() => signOut({ callbackUrl: "/admin" })}
                            className="inline-flex items-center justify-center gap-2 text-slate-400 hover:text-white text-sm"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign in with a different account
                        </button>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-slate-900 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <Shield className="h-6 w-6 text-blue-400" />
                        <span className="text-lg font-bold text-white">Platform Admin</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {adminNavItems.map((item) => (
                        <NavItem key={item.title} item={item} pathname={pathname} />
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 space-y-2">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Staff Dashboard
                    </Link>
                    <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors w-full"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </button>
                    <div className="px-3 py-2 text-xs text-slate-500">
                        {session.user?.email}
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 bg-slate-900">
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
