"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, XCircle, Zap, TrendingDown } from "lucide-react";
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

// Mock data
const mockBookingData = {
  overview: {
    totalBookings: 12450,
    averageLeadTime: 21.5,
    cancellationRate: 8.2,
    lastMinutePercentage: 15.3,
  },
  leadTimeAnalysis: {
    average: 21.5,
    median: 14,
    buckets: [
      { range: "Same day", count: 620, percentage: 5.0, averageOrderValue: 165 },
      { range: "1-3 days", count: 1245, percentage: 10.0, averageOrderValue: 185 },
      { range: "3-7 days", count: 1870, percentage: 15.0, averageOrderValue: 205 },
      { range: "1-2 weeks", count: 2490, percentage: 20.0, averageOrderValue: 225 },
      { range: "2-4 weeks", count: 2988, percentage: 24.0, averageOrderValue: 245 },
      { range: "1-3 months", count: 2490, percentage: 20.0, averageOrderValue: 265 },
      { range: "3+ months", count: 747, percentage: 6.0, averageOrderValue: 295 },
    ],
    trends: [
      { month: "Jan", averageLeadTime: 28.5 },
      { month: "Feb", averageLeadTime: 26.2 },
      { month: "Mar", averageLeadTime: 24.8 },
      { month: "Apr", averageLeadTime: 22.4 },
      { month: "May", averageLeadTime: 18.6 },
      { month: "Jun", averageLeadTime: 15.2 },
      { month: "Jul", averageLeadTime: 12.8 },
      { month: "Aug", averageLeadTime: 14.5 },
      { month: "Sep", averageLeadTime: 19.8 },
      { month: "Oct", averageLeadTime: 22.6 },
      { month: "Nov", averageLeadTime: 25.4 },
      { month: "Dec", averageLeadTime: 27.8 },
    ],
  },
  channelBreakdown: [
    { channel: "Direct Website", bookings: 6850, revenue: 1712500, percentage: 55.0, averageLeadTime: 24 },
    { channel: "Mobile App", bookings: 2490, revenue: 622500, percentage: 20.0, averageLeadTime: 18 },
    { channel: "Phone", bookings: 1494, revenue: 373500, percentage: 12.0, averageLeadTime: 32 },
    { channel: "Walk-in", bookings: 996, revenue: 249000, percentage: 8.0, averageLeadTime: 0 },
    { channel: "Third Party", bookings: 620, revenue: 155000, percentage: 5.0, averageLeadTime: 15 },
  ],
  cancellationAnalysis: {
    overallRate: 8.2,
    totalCancelled: 1021,
    lostRevenue: 234830,
    byAccommodationType: [
      { type: "rv", cancellationRate: 6.5, totalBookings: 6475, cancelled: 421 },
      { type: "tent", cancellationRate: 12.4, totalBookings: 3486, cancelled: 432 },
      { type: "cabin", cancellationRate: 5.8, totalBookings: 1868, cancelled: 108 },
      { type: "glamping", cancellationRate: 9.7, totalBookings: 621, cancelled: 60 },
    ],
    byLeadTime: [
      { bucket: "short (< 7 days)", cancellationRate: 3.2, totalBookings: 3735, cancelled: 120 },
      { bucket: "medium (7-30 days)", cancellationRate: 7.8, totalBookings: 5478, cancelled: 427 },
      { bucket: "long (30+ days)", cancellationRate: 14.6, totalBookings: 3237, cancelled: 473 },
    ],
  },
  bookingTrends: {
    byDayOfWeek: [
      { day: "Sunday", bookings: 1620, revenue: 405000 },
      { day: "Monday", bookings: 1245, revenue: 311250 },
      { day: "Tuesday", bookings: 1120, revenue: 280000 },
      { day: "Wednesday", bookings: 1180, revenue: 295000 },
      { day: "Thursday", bookings: 1494, revenue: 373500 },
      { day: "Friday", bookings: 2988, revenue: 747000 },
      { day: "Saturday", bookings: 2803, revenue: 700750 },
    ],
  },
};

export default function BookingBehaviorPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState(mockBookingData);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/booking?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          if (result.overview?.totalBookings > 0) {
            setData(result);
            setIsUsingMockData(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch booking data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const channelPieData = data.channelBreakdown.map((c) => ({
    name: c.channel,
    value: c.percentage,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Booking Behavior</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-slate-400 mt-1">
            Lead times, channels, and cancellation patterns
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Bookings"
          value={data.overview.totalBookings}
          format="number"
          loading={loading}
          icon={<Calendar className="h-5 w-5 text-blue-400" />}
        />
        <KpiCard
          title="Avg Lead Time"
          value={data.overview.averageLeadTime}
          format="days"
          loading={loading}
          icon={<Clock className="h-5 w-5 text-green-400" />}
        />
        <KpiCard
          title="Cancellation Rate"
          value={data.overview.cancellationRate}
          format="percent"
          loading={loading}
          icon={<XCircle className="h-5 w-5 text-red-400" />}
        />
        <KpiCard
          title="Last-Minute"
          value={data.overview.lastMinutePercentage}
          format="percent"
          loading={loading}
          subtitle="< 3 days lead time"
          icon={<Zap className="h-5 w-5 text-amber-400" />}
        />
      </div>

      {/* Lead Time Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          title="Lead Time Distribution"
          description="How far in advance guests book"
          data={data.leadTimeAnalysis.buckets}
          dataKeys={[
            { key: "count", color: "#3b82f6", name: "Bookings" },
          ]}
          xAxisKey="range"
          type="bar"
          height={300}
          formatTooltip={(v) => v.toLocaleString()}
          loading={loading}
          yAxisLabel="Bookings"
        />
        <TrendChart
          title="Lead Time Seasonality"
          description="Average booking window by month"
          data={data.leadTimeAnalysis.trends}
          dataKeys={[
            { key: "averageLeadTime", color: "#10b981", name: "Lead Time (days)" },
          ]}
          xAxisKey="month"
          type="line"
          height={300}
          formatYAxis={(v) => `${v}d`}
          formatTooltip={(v) => `${v.toFixed(1)} days`}
          loading={loading}
          yAxisLabel="Lead Time (days)"
        />
      </div>

      {/* Channel Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DataTable
            title="Booking Channels"
            description="Where guests are booking from"
            columns={[
              { key: "channel", label: "Channel" },
              { key: "bookings", label: "Bookings", align: "right", format: (v) => v.toLocaleString() },
              { key: "revenue", label: "Revenue", align: "right", format: (v) => formatCurrency(v) },
              { key: "percentage", label: "Share", align: "right", format: (v) => `${v.toFixed(1)}%` },
              { key: "averageLeadTime", label: "Avg Lead", align: "right", format: (v) => `${v}d` },
            ]}
            data={data.channelBreakdown}
            loading={loading}
          />
        </div>
        <BreakdownPie
          title="Channel Mix"
          data={channelPieData}
          height={300}
          formatValue={(v) => `${v.toFixed(1)}%`}
          loading={loading}
        />
      </div>

      {/* Cancellation Analysis */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-400" />
            Cancellation Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
              <p className="text-3xl font-bold text-white">{data.cancellationAnalysis.overallRate}%</p>
              <p className="text-sm text-slate-400">Overall Rate</p>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg text-center">
              <p className="text-3xl font-bold text-white">{data.cancellationAnalysis.totalCancelled.toLocaleString()}</p>
              <p className="text-sm text-slate-400">Total Cancelled</p>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg text-center">
              <p className="text-3xl font-bold text-white">{formatCurrency(data.cancellationAnalysis.lostRevenue)}</p>
              <p className="text-sm text-slate-400">Lost Revenue</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DataTable
              title="By Accommodation Type"
              columns={[
                { key: "type", label: "Type", format: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
                { key: "cancellationRate", label: "Rate", align: "right", format: (v) => `${v.toFixed(1)}%` },
                { key: "cancelled", label: "Cancelled", align: "right", format: (v) => v.toLocaleString() },
              ]}
              data={data.cancellationAnalysis.byAccommodationType}
              loading={loading}
            />
            <DataTable
              title="By Lead Time"
              columns={[
                { key: "bucket", label: "Lead Time" },
                { key: "cancellationRate", label: "Rate", align: "right", format: (v) => `${v.toFixed(1)}%` },
                { key: "cancelled", label: "Cancelled", align: "right", format: (v) => v.toLocaleString() },
              ]}
              data={data.cancellationAnalysis.byLeadTime}
              loading={loading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Day of Week Booking Trends */}
      <TrendChart
        title="Bookings by Day of Week"
        description="When guests are making reservations"
        data={data.bookingTrends.byDayOfWeek}
        dataKeys={[
          { key: "bookings", color: "#8b5cf6", name: "Bookings" },
        ]}
        xAxisKey="day"
        type="bar"
        height={250}
        formatTooltip={(v) => v.toLocaleString()}
        loading={loading}
        yAxisLabel="Bookings"
      />
    </div>
  );
}
