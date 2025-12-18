"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Users,
  UserPlus,
  UserMinus,
  Clock,
  Award,
  Calendar,
  DollarSign,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KpiCard,
  TrendChart,
  BreakdownPie,
  DataTable,
  DateRangePicker,
  formatCurrency,
} from "@/components/analytics";

interface PlatformGrowthData {
  overview: {
    totalCampgrounds: number;
    activeCampgrounds: number;
    foundingMembers: number;
    foundingMembersActive: number;
    totalSignups: number;
    signupsThisMonth: number;
    churnRate: number;
    churnedThisMonth: number;
    averageCustomerLifetime: number;
    mrr: number;
    arr: number;
    mrrGrowth: number;
  };
  signupTrends: Array<{
    month: string;
    signups: number;
    churned: number;
    netGrowth: number;
    cumulative: number;
  }>;
  subscriptionTiers: Array<{
    name: string;
    value: number;
    mrr: number;
    color?: string;
  }>;
  foundingMembers: Array<{
    name: string;
    signupDate: string;
    status: "active" | "churned" | "at_risk";
    mrr: number;
    monthsActive: number;
    lastActivity: string;
  }>;
  recentSignups: Array<{
    name: string;
    signupDate: string;
    tier: string;
    state: string;
    mrr: number;
  }>;
  recentChurn: Array<{
    name: string;
    churnDate: string;
    reason: string;
    monthsActive: number;
    lifetimeValue: number;
  }>;
  cohortRetention: Array<{
    cohort: string;
    month0: number;
    month1: number;
    month3: number;
    month6: number;
    month12: number;
  }>;
}

// Mock data for demonstration
const mockGrowthData: PlatformGrowthData = {
  overview: {
    totalCampgrounds: 127,
    activeCampgrounds: 118,
    foundingMembers: 45,
    foundingMembersActive: 41,
    totalSignups: 127,
    signupsThisMonth: 8,
    churnRate: 2.4,
    churnedThisMonth: 3,
    averageCustomerLifetime: 18.5,
    mrr: 47250,
    arr: 567000,
    mrrGrowth: 12.8,
  },
  signupTrends: [
    { month: "2024-01", signups: 8, churned: 1, netGrowth: 7, cumulative: 85 },
    { month: "2024-02", signups: 6, churned: 2, netGrowth: 4, cumulative: 89 },
    { month: "2024-03", signups: 12, churned: 1, netGrowth: 11, cumulative: 100 },
    { month: "2024-04", signups: 9, churned: 3, netGrowth: 6, cumulative: 106 },
    { month: "2024-05", signups: 7, churned: 2, netGrowth: 5, cumulative: 111 },
    { month: "2024-06", signups: 5, churned: 1, netGrowth: 4, cumulative: 115 },
    { month: "2024-07", signups: 4, churned: 2, netGrowth: 2, cumulative: 117 },
    { month: "2024-08", signups: 6, churned: 1, netGrowth: 5, cumulative: 122 },
    { month: "2024-09", signups: 3, churned: 2, netGrowth: 1, cumulative: 123 },
    { month: "2024-10", signups: 5, churned: 1, netGrowth: 4, cumulative: 127 },
    { month: "2024-11", signups: 4, churned: 3, netGrowth: 1, cumulative: 125 },
    { month: "2024-12", signups: 8, churned: 3, netGrowth: 5, cumulative: 118 },
  ],
  subscriptionTiers: [
    { name: "Starter", value: 42, mrr: 8400, color: "#3b82f6" },
    { name: "Professional", value: 51, mrr: 22950, color: "#10b981" },
    { name: "Enterprise", value: 16, mrr: 12800, color: "#8b5cf6" },
    { name: "Founding (Free)", value: 9, mrr: 0, color: "#f59e0b" },
  ],
  foundingMembers: [
    { name: "Sunset Ridge RV Park", signupDate: "2023-03-15", status: "active", mrr: 0, monthsActive: 21, lastActivity: "2024-12-15" },
    { name: "Mountain View Camping", signupDate: "2023-03-18", status: "active", mrr: 0, monthsActive: 21, lastActivity: "2024-12-16" },
    { name: "Lakeside Resort", signupDate: "2023-03-20", status: "active", mrr: 0, monthsActive: 21, lastActivity: "2024-12-14" },
    { name: "Pine Forest Camp", signupDate: "2023-03-22", status: "at_risk", mrr: 0, monthsActive: 21, lastActivity: "2024-11-28" },
    { name: "Desert Oasis RV", signupDate: "2023-03-25", status: "active", mrr: 0, monthsActive: 21, lastActivity: "2024-12-15" },
    { name: "Riverside Retreat", signupDate: "2023-04-01", status: "churned", mrr: 0, monthsActive: 18, lastActivity: "2024-09-15" },
    { name: "Coastal Camping Co", signupDate: "2023-04-05", status: "active", mrr: 0, monthsActive: 20, lastActivity: "2024-12-16" },
    { name: "Evergreen RV Resort", signupDate: "2023-04-08", status: "churned", mrr: 0, monthsActive: 15, lastActivity: "2024-07-10" },
    { name: "Valley View Camp", signupDate: "2023-04-10", status: "active", mrr: 0, monthsActive: 20, lastActivity: "2024-12-14" },
    { name: "Summit Peak Camping", signupDate: "2023-04-12", status: "at_risk", mrr: 0, monthsActive: 20, lastActivity: "2024-11-20" },
  ],
  recentSignups: [
    { name: "Adventure Bay RV", signupDate: "2024-12-14", tier: "Professional", state: "FL", mrr: 450 },
    { name: "Wilderness Haven", signupDate: "2024-12-12", tier: "Starter", state: "CO", mrr: 200 },
    { name: "Starlight Camping", signupDate: "2024-12-10", tier: "Professional", state: "TX", mrr: 450 },
    { name: "Trailhead RV Park", signupDate: "2024-12-08", tier: "Enterprise", state: "CA", mrr: 800 },
    { name: "Cascade Camp", signupDate: "2024-12-05", tier: "Starter", state: "WA", mrr: 200 },
  ],
  recentChurn: [
    { name: "Meadow Springs", churnDate: "2024-12-10", reason: "Business closed", monthsActive: 8, lifetimeValue: 3600 },
    { name: "Old Town RV", churnDate: "2024-12-05", reason: "Switched to competitor", monthsActive: 14, lifetimeValue: 6300 },
    { name: "Hillside Camp", churnDate: "2024-11-28", reason: "Budget constraints", monthsActive: 6, lifetimeValue: 2700 },
  ],
  cohortRetention: [
    { cohort: "Q1 2023 (Founding)", month0: 100, month1: 100, month3: 98, month6: 95, month12: 91 },
    { cohort: "Q2 2023", month0: 100, month1: 95, month3: 88, month6: 82, month12: 76 },
    { cohort: "Q3 2023", month0: 100, month1: 92, month3: 85, month6: 78, month12: 72 },
    { cohort: "Q4 2023", month0: 100, month1: 90, month3: 82, month6: 75, month12: 68 },
    { cohort: "Q1 2024", month0: 100, month1: 93, month3: 86, month6: 79, month12: 0 },
    { cohort: "Q2 2024", month0: 100, month1: 91, month3: 84, month6: 0, month12: 0 },
  ],
};

const StatusBadge = ({ status }: { status: "active" | "churned" | "at_risk" }) => {
  const config = {
    active: { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: CheckCircle, label: "Active" },
    churned: { bg: "bg-red-500/20", text: "text-red-400", icon: XCircle, label: "Churned" },
    at_risk: { bg: "bg-amber-500/20", text: "text-amber-400", icon: AlertTriangle, label: "At Risk" },
  };
  const { bg, text, icon: Icon, label } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

export default function PlatformGrowthPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState<PlatformGrowthData>(mockGrowthData);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/growth?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          if (result.overview?.totalCampgrounds > 0) {
            setData(result);
            setIsUsingMockData(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch growth data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const foundingRetentionRate = Math.round((data.overview.foundingMembersActive / data.overview.foundingMembers) * 100);
  const overallRetentionRate = Math.round((data.overview.activeCampgrounds / data.overview.totalCampgrounds) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Platform Growth</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-slate-400 mt-1">
            Track campground signups, retention, and business health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Founding Members Highlight */}
      <Card className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-amber-700/50">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <Award className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Founding Members</h2>
                <p className="text-amber-200/70 text-sm">
                  Your original 45 campgrounds who believed in Camp Everyday from the start
                </p>
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-4xl font-bold text-amber-400">{data.overview.foundingMembersActive}</p>
                <p className="text-sm text-amber-200/60">Still Active</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-white">{data.overview.foundingMembers - data.overview.foundingMembersActive}</p>
                <p className="text-sm text-slate-400">Churned</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-emerald-400">{foundingRetentionRate}%</p>
                <p className="text-sm text-emerald-200/60">Retention Rate</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Campgrounds"
          value={data.overview.totalCampgrounds}
          format="number"
          loading={loading}
          icon={<Building2 className="h-5 w-5 text-blue-400" />}
        />
        <KpiCard
          title="Active Campgrounds"
          value={data.overview.activeCampgrounds}
          format="number"
          subtitle={`${overallRetentionRate}% retention`}
          loading={loading}
          icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
        />
        <KpiCard
          title="Signups This Month"
          value={data.overview.signupsThisMonth}
          format="number"
          loading={loading}
          icon={<UserPlus className="h-5 w-5 text-green-400" />}
        />
        <KpiCard
          title="Churn Rate"
          value={data.overview.churnRate}
          format="percent"
          subtitle={`${data.overview.churnedThisMonth} churned this month`}
          loading={loading}
          icon={<UserMinus className="h-5 w-5 text-red-400" />}
        />
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Monthly Recurring Revenue"
          value={data.overview.mrr}
          format="currency"
          change={data.overview.mrrGrowth}
          changeLabel="MoM"
          loading={loading}
          icon={<DollarSign className="h-5 w-5 text-green-400" />}
        />
        <KpiCard
          title="Annual Recurring Revenue"
          value={data.overview.arr}
          format="currency"
          loading={loading}
          icon={<Calendar className="h-5 w-5 text-purple-400" />}
        />
        <KpiCard
          title="Avg Customer Lifetime"
          value={data.overview.averageCustomerLifetime}
          format="number"
          subtitle="months"
          loading={loading}
          icon={<Clock className="h-5 w-5 text-amber-400" />}
        />
        <KpiCard
          title="Avg LTV"
          value={Math.round(data.overview.averageCustomerLifetime * (data.overview.mrr / data.overview.activeCampgrounds))}
          format="currency"
          subtitle="Lifetime Value"
          loading={loading}
          icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart
            title="Signup & Churn Trends"
            description="Monthly new signups vs churned campgrounds"
            data={data.signupTrends}
            dataKeys={[
              { key: "signups", color: "#10b981", name: "Signups" },
              { key: "churned", color: "#ef4444", name: "Churned" },
            ]}
            xAxisKey="month"
            type="bar"
            height={300}
            formatTooltip={(v) => (v ?? 0).toString()}
            loading={loading}
          />
        </div>
        <BreakdownPie
          title="Subscription Tiers"
          description="Active campgrounds by plan"
          data={data.subscriptionTiers}
          height={300}
          formatValue={(v) => `${v ?? 0} parks`}
          loading={loading}
        />
      </div>

      {/* Cumulative Growth Chart */}
      <TrendChart
        title="Cumulative Growth"
        description="Total active campgrounds over time"
        data={data.signupTrends}
        dataKeys={[
          { key: "cumulative", color: "#3b82f6", name: "Total Active" },
        ]}
        xAxisKey="month"
        type="area"
        height={250}
        formatTooltip={(v) => `${v ?? 0} campgrounds`}
        loading={loading}
      />

      {/* Founding Members Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            <CardTitle className="text-lg text-white">Founding Members Status</CardTitle>
          </div>
          <p className="text-sm text-slate-400">
            Tracking the 45 original campgrounds who joined during launch
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Campground</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Joined</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Months Active</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {data.foundingMembers.map((member, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4 text-sm text-white font-medium">{member.name}</td>
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {new Date(member.signupDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300 text-right">{member.monthsActive}</td>
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {new Date(member.lastActivity).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-4 text-center">
            Showing first 10 of {data.overview.foundingMembers} founding members
          </p>
        </CardContent>
      </Card>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <DataTable
          title="Recent Signups"
          description="New campgrounds joined"
          columns={[
            { key: "name", label: "Campground" },
            { key: "tier", label: "Plan" },
            { key: "state", label: "State", align: "center" },
            { key: "mrr", label: "MRR", align: "right", format: (v) => formatCurrency(v ?? 0) },
            { key: "signupDate", label: "Joined", align: "right", format: (v) => new Date(v).toLocaleDateString() },
          ]}
          data={data.recentSignups}
          loading={loading}
          maxRows={5}
        />

        {/* Recent Churn */}
        <DataTable
          title="Recent Churn"
          description="Campgrounds that left"
          columns={[
            { key: "name", label: "Campground" },
            { key: "reason", label: "Reason" },
            { key: "monthsActive", label: "Tenure", align: "right", format: (v) => `${v ?? 0} mo` },
            { key: "lifetimeValue", label: "LTV", align: "right", format: (v) => formatCurrency(v ?? 0) },
          ]}
          data={data.recentChurn}
          loading={loading}
          maxRows={5}
        />
      </div>

      {/* Cohort Retention Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Cohort Retention Analysis</CardTitle>
          <p className="text-sm text-slate-400">
            Retention rates by signup quarter
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Cohort</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Month 0</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Month 1</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Month 3</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Month 6</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Month 12</th>
                </tr>
              </thead>
              <tbody>
                {data.cohortRetention.map((cohort, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4 text-sm text-white font-medium">{cohort.cohort}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-emerald-400">{cohort.month0}%</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cohort.month1 >= 90 ? "text-emerald-400" : cohort.month1 >= 80 ? "text-amber-400" : "text-red-400"}>
                        {cohort.month1}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cohort.month3 >= 80 ? "text-emerald-400" : cohort.month3 >= 70 ? "text-amber-400" : cohort.month3 === 0 ? "text-slate-600" : "text-red-400"}>
                        {cohort.month3 === 0 ? "—" : `${cohort.month3}%`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cohort.month6 >= 75 ? "text-emerald-400" : cohort.month6 >= 65 ? "text-amber-400" : cohort.month6 === 0 ? "text-slate-600" : "text-red-400"}>
                        {cohort.month6 === 0 ? "—" : `${cohort.month6}%`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cohort.month12 >= 70 ? "text-emerald-400" : cohort.month12 >= 60 ? "text-amber-400" : cohort.month12 === 0 ? "text-slate-600" : "text-red-400"}>
                        {cohort.month12 === 0 ? "—" : `${cohort.month12}%`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-400/50" /> Good
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-400/50" /> Needs Attention
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-400/50" /> At Risk
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700">
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">{foundingRetentionRate}%</p>
          <p className="text-sm text-slate-400">Founding Retention</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{overallRetentionRate}%</p>
          <p className="text-sm text-slate-400">Overall Retention</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-400">
            {Math.round(data.overview.mrr / data.overview.activeCampgrounds)}
          </p>
          <p className="text-sm text-slate-400">ARPU ($/mo)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-400">
            {Math.round((data.overview.signupsThisMonth - data.overview.churnedThisMonth) / data.overview.activeCampgrounds * 100)}%
          </p>
          <p className="text-sm text-slate-400">Net Growth Rate</p>
        </div>
      </div>
    </div>
  );
}
