"use client";

import Link from "next/link";
import {
  Users,
  HeadphonesIcon,
  BarChart3,
  RefreshCw,
  Megaphone,
  Building2,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Calendar,
  Activity,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserPlus,
  Ticket,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const adminSections = [
  {
    title: "Early Access",
    description: "Monitor signups and resend onboarding emails",
    href: "/admin/early-access",
    icon: UserPlus,
    color: "bg-emerald-500",
  },
  {
    title: "Platform Users",
    description: "Manage all users across the platform",
    href: "/admin/platform/users",
    icon: Users,
    color: "bg-blue-500",
  },
  {
    title: "Support Dashboard",
    description: "View and manage support tickets",
    href: "/admin/support",
    icon: HeadphonesIcon,
    color: "bg-purple-500",
  },
  {
    title: "Support Analytics",
    description: "Track support metrics and trends",
    href: "/admin/support/analytics",
    icon: BarChart3,
    color: "bg-green-500",
  },
  {
    title: "Marketing Leads",
    description: "View and manage marketing leads",
    href: "/admin/marketing/leads",
    icon: Megaphone,
    color: "bg-pink-500",
  },
  {
    title: "Sync Summary",
    description: "View data synchronization status",
    href: "/admin/sync-summary",
    icon: RefreshCw,
    color: "bg-cyan-500",
  },
  {
    title: "Create Campground",
    description: "Add a new campground to the platform",
    href: "/admin/campgrounds/new",
    icon: Building2,
    color: "bg-orange-500",
  },
];

// Mock data - replace with real API calls later
const kpiData = {
  totalCampgrounds: 127,
  campgroundsGrowth: "+12%",
  reservationsToday: 34,
  reservationsWeek: 289,
  reservationsMonth: 1247,
  reservationsGrowth: "+8.3%",
  totalRevenue: 45280,
  revenueGrowth: "+15.2%",
  activeUsers: 3842,
  usersGrowth: "+23%",
};

const systemHealth = {
  apiStatus: "operational",
  databaseStatus: "operational",
  lastSync: "2 minutes ago",
  activeAlerts: 0,
};

const recentActivity = {
  campgroundSignups: [
    { id: 1, name: "Pine Valley Campground", signedUpAt: "2 hours ago", status: "pending" },
    { id: 2, name: "Lakeside Retreat", signedUpAt: "5 hours ago", status: "approved" },
    { id: 3, name: "Mountain View RV Park", signedUpAt: "1 day ago", status: "approved" },
  ],
  supportTickets: [
    { id: 1, title: "Booking system issue", priority: "high", createdAt: "30 minutes ago" },
    { id: 2, title: "Payment not processing", priority: "high", createdAt: "1 hour ago" },
    { id: 3, title: "Account access question", priority: "low", createdAt: "3 hours ago" },
  ],
  userLogins: [
    { id: 1, email: "hello@keeprstay.com", loginAt: "5 minutes ago" },
    { id: 2, email: "hello@keeprstay.com", loginAt: "12 minutes ago" },
    { id: 3, email: "hello@keeprstay.com", loginAt: "1 hour ago" },
  ],
};

const campgroundsNeedingAttention = [
  { id: 1, name: "Sunset Campground", issue: "Pending verification", severity: "warning" },
  {
    id: 2,
    name: "Forest Glen RV",
    issue: "Low activity (0 bookings this month)",
    severity: "info",
  },
  { id: 3, name: "Riverside Camping", issue: "Payment setup incomplete", severity: "error" },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Admin</h1>
        <p className="text-muted-foreground mt-1">
          Manage platform-wide settings and support operations
        </p>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Campgrounds */}
        <Card className="bg-muted border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Campgrounds
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpiData.totalCampgrounds}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-400">{kpiData.campgroundsGrowth}</span> from last month
            </p>
          </CardContent>
        </Card>

        {/* Reservations */}
        <Card className="bg-muted border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reservations
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpiData.reservationsMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              This month • <span className="text-green-400">{kpiData.reservationsGrowth}</span>{" "}
              growth
            </p>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="text-muted-foreground">
                Today:{" "}
                <span className="text-foreground font-medium">{kpiData.reservationsToday}</span>
              </span>
              <span className="text-muted-foreground">
                Week:{" "}
                <span className="text-foreground font-medium">{kpiData.reservationsWeek}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="bg-muted border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ${kpiData.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-400">{kpiData.revenueGrowth}</span> from last month
            </p>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card className="bg-muted border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {kpiData.activeUsers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-400">{kpiData.usersGrowth}</span> from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card className="bg-muted border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Current platform status and monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-status-success/15 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">API Status</p>
                <p className="text-xs text-muted-foreground capitalize">{systemHealth.apiStatus}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-status-success/15 flex items-center justify-center">
                <Database className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Database</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {systemHealth.databaseStatus}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-status-info/15 flex items-center justify-center">
                <Clock className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Last Sync</p>
                <p className="text-xs text-muted-foreground">{systemHealth.lastSync}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  systemHealth.activeAlerts > 0 ? "bg-status-error/15" : "bg-status-success/15"
                }`}
              >
                {systemHealth.activeAlerts > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-status-error" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-status-success" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Active Alerts</p>
                <p className="text-xs text-muted-foreground">
                  {systemHealth.activeAlerts === 0
                    ? "No alerts"
                    : `${systemHealth.activeAlerts} alert(s)`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity and Campgrounds Needing Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <Card className="bg-muted border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Recent Activity</CardTitle>
            <CardDescription className="text-muted-foreground">
              Latest platform events and actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recent Campground Signups */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="h-4 w-4 text-blue-400" />
                <h4 className="text-sm font-semibold text-foreground">Campground Signups</h4>
              </div>
              <div className="space-y-2">
                {recentActivity.campgroundSignups.map((signup) => (
                  <div
                    key={signup.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{signup.name}</p>
                      <p className="text-xs text-muted-foreground">{signup.signedUpAt}</p>
                    </div>
                    <Badge
                      variant={signup.status === "approved" ? "success" : "warning"}
                      className="ml-2"
                    >
                      {signup.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Support Tickets */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Ticket className="h-4 w-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-foreground">Support Tickets</h4>
              </div>
              <div className="space-y-2">
                {recentActivity.supportTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                      <p className="text-xs text-muted-foreground">{ticket.createdAt}</p>
                    </div>
                    <Badge variant={ticket.priority === "high" ? "error" : "info"} className="ml-2">
                      {ticket.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent User Logins */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <LogIn className="h-4 w-4 text-green-400" />
                <h4 className="text-sm font-semibold text-foreground">User Logins</h4>
              </div>
              <div className="space-y-2">
                {recentActivity.userLogins.map((login) => (
                  <div
                    key={login.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <p className="text-sm text-foreground truncate">{login.email}</p>
                    <p className="text-xs text-muted-foreground ml-2">{login.loginAt}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campgrounds Needing Attention */}
        <Card className="bg-muted border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Campgrounds Needing Attention</CardTitle>
            <CardDescription className="text-muted-foreground">
              Issues and low-activity campgrounds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {campgroundsNeedingAttention.map((campground) => (
                <div
                  key={campground.id}
                  className="p-3 rounded-lg bg-muted/50 border-l-4"
                  style={{
                    borderLeftColor:
                      campground.severity === "error"
                        ? "#ef4444"
                        : campground.severity === "warning"
                          ? "#f59e0b"
                          : "#3b82f6",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 ${
                        campground.severity === "error"
                          ? "text-red-400"
                          : campground.severity === "warning"
                            ? "text-amber-400"
                            : "text-blue-400"
                      }`}
                    >
                      {campground.severity === "error" ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : campground.severity === "warning" ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <Activity className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{campground.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{campground.issue}</p>
                    </div>
                    <Link
                      href={`/admin/campgrounds/${campground.id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium whitespace-nowrap"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
              {campgroundsNeedingAttention.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    All campgrounds are in good standing
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Sections Navigation */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="bg-muted rounded-lg border border-border p-5 hover:border-border hover:bg-muted transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className={`${section.color} p-3 rounded-lg`}>
                  <section.icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                    {section.title}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">{section.description}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-400 transition-colors flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
