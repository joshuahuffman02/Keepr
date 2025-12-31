"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, RefreshCw, Heart, TrendingUp, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KpiCard,
  TrendChart,
  BreakdownPie,
  DataTable,
  DateRangePicker,
  formatCurrency,
  SankeyDiagram,
} from "@/components/analytics";

export default function GuestJourneyPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/guests/journey?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Failed to fetch guest data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const ltvPieData = data?.lifetimeValue?.tiers?.map((tier: any) => ({
    name: tier.tier,
    value: tier.guestCount,
  })) || [];

  const hasData = data && data.overview && data.overview.totalGuests > 0;

  if (!loading && !hasData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Guest Journey Analytics</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Understand guest behavior, progression, and lifetime value
            </p>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-16 w-16 text-slate-400 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Guest Data Available</h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-md">
            There is no guest data for the selected time period. Data will appear here once guests make reservations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Guest Journey Analytics</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Understand guest behavior, progression, and lifetime value
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Guests"
          value={data?.overview?.totalGuests || 0}
          format="number"
          loading={loading}
          icon={<Users className="h-5 w-5 text-blue-400" />}
        />
        <KpiCard
          title="New Guests"
          value={data?.overview?.newGuests || 0}
          format="number"
          loading={loading}
          icon={<UserPlus className="h-5 w-5 text-green-400" />}
        />
        <KpiCard
          title="Returning Guests"
          value={data?.overview?.returningGuests || 0}
          format="number"
          loading={loading}
          icon={<RefreshCw className="h-5 w-5 text-purple-400" />}
        />
        <KpiCard
          title="Return Rate"
          value={data?.overview?.returnRate || 0}
          format="percent"
          loading={loading}
          icon={<Heart className="h-5 w-5 text-red-400" />}
        />
        <KpiCard
          title="Avg Stays/Guest"
          value={data?.overview?.averageStaysPerGuest || 0}
          format="number"
          loading={loading}
        />
      </div>

      {/* Accommodation Progression Sankey */}
      <SankeyDiagram
        title="Accommodation Progression"
        description="How guests flow between accommodation types over their journey"
        nodes={[
          { id: "tent", label: "Tent" },
          { id: "rv", label: "RV" },
          { id: "cabin", label: "Cabin" },
          { id: "glamping", label: "Glamping" },
          { id: "tent-return", label: "Tent" },
          { id: "rv-return", label: "RV" },
          { id: "cabin-return", label: "Cabin" },
          { id: "glamping-return", label: "Glamping" },
        ]}
        links={
          data?.accommodationProgression?.progressions?.map((prog: any) => ({
            source: prog.fromType,
            target: `${prog.toType}-return`,
            value: prog.count,
          })) || [
            { source: "tent", target: "tent-return", value: 450 },
            { source: "tent", target: "rv-return", value: 180 },
            { source: "tent", target: "cabin-return", value: 120 },
            { source: "rv", target: "rv-return", value: 680 },
            { source: "rv", target: "cabin-return", value: 95 },
            { source: "rv", target: "glamping-return", value: 45 },
            { source: "cabin", target: "cabin-return", value: 320 },
            { source: "cabin", target: "glamping-return", value: 85 },
            { source: "glamping", target: "glamping-return", value: 150 },
            { source: "glamping", target: "cabin-return", value: 35 },
          ]
        }
        loading={loading}
        formatValue={(v) => `${v.toLocaleString()} guests`}
      />

      {/* Upgrade/Downgrade Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-green-500/10 dark:bg-green-500/10 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Upgrade Rate</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {data?.accommodationProgression?.upgradeRate?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Guests moving to higher-tier accommodations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 dark:bg-red-500/10 border-red-500/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <ArrowRight className="h-6 w-6 text-red-500 rotate-90" />
              </div>
              <div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Downgrade Rate</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {data?.accommodationProgression?.downgradeRate?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Guests moving to lower-tier accommodations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LTV Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DataTable
            title="Lifetime Value by Tier"
            description="Guest distribution across value segments"
            columns={[
              { key: "tier", label: "LTV Tier" },
              { key: "guestCount", label: "Guests", align: "right", format: (v) => v.toLocaleString() },
              { key: "totalRevenue", label: "Total Revenue", align: "right", format: (v) => formatCurrency(v) },
              { key: "averageLtv", label: "Avg LTV", align: "right", format: (v) => formatCurrency(v) },
              { key: "averageStays", label: "Avg Stays", align: "right", format: (v) => v.toFixed(1) },
            ]}
            data={data?.lifetimeValue?.tiers || []}
            loading={loading}
          />
        </div>
        <div className="space-y-4">
          <KpiCard
            title="Average LTV"
            value={data?.lifetimeValue?.averageLtv || 0}
            format="currency"
            loading={loading}
          />
          <KpiCard
            title="Top 10% LTV"
            value={data?.lifetimeValue?.topPercentileLtv || 0}
            format="currency"
            loading={loading}
            subtitle="90th percentile guest value"
          />
          <BreakdownPie
            title="Guests by LTV Tier"
            data={ltvPieData}
            height={200}
            showLegend={false}
            loading={loading}
          />
        </div>
      </div>

      {/* Retention Cohorts */}
      <DataTable
        title="Retention Cohorts"
        description="Track how guest cohorts return over time"
        columns={[
          { key: "cohortMonth", label: "Cohort" },
          { key: "totalGuests", label: "Guests", align: "right", format: (v) => v.toLocaleString() },
          { key: "retention30", label: "30-Day", align: "right", format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
          { key: "retention90", label: "90-Day", align: "right", format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
          { key: "retention180", label: "180-Day", align: "right", format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
        ]}
        data={data?.retentionCohorts || []}
        loading={loading}
      />
    </div>
  );
}
