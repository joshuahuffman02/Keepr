"use client";

import { useState, useEffect } from "react";
import { Wifi, Droplets, Zap, Trees, ShowerHead, Dog, Waves, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KpiCard,
  TrendChart,
  DataTable,
  DateRangePicker,
  formatCurrency,
} from "@/components/analytics";

// Mock data
const mockAmenityData = {
  topSiteAmenities: [
    { amenity: "WiFi", siteCount: 980, reservations: 8450, revenue: 2112500, averageRate: 68.50, occupancyRate: 72.5 },
    { amenity: "Full Hookups", siteCount: 650, reservations: 5890, revenue: 1620750, averageRate: 75.20, occupancyRate: 78.4 },
    { amenity: "Water/Electric", siteCount: 450, reservations: 3780, revenue: 907200, averageRate: 55.80, occupancyRate: 65.2 },
    { amenity: "Fire Pit", siteCount: 820, reservations: 6120, revenue: 1468800, averageRate: 52.40, occupancyRate: 62.8 },
    { amenity: "Picnic Table", siteCount: 1100, reservations: 8920, revenue: 2051600, averageRate: 48.50, occupancyRate: 58.6 },
    { amenity: "Shade", siteCount: 680, reservations: 5440, revenue: 1360000, averageRate: 62.30, occupancyRate: 68.4 },
    { amenity: "Pull-Through", siteCount: 420, reservations: 3780, revenue: 1021500, averageRate: 72.80, occupancyRate: 74.2 },
    { amenity: "Pet Friendly", siteCount: 890, reservations: 7120, revenue: 1780000, averageRate: 58.90, occupancyRate: 64.5 },
  ],
  hookupAnalysis: [
    { hookupType: "Full Hookups (W/E/S)", siteCount: 520, reservations: 4680, revenue: 1287000, averageNightlyRate: 75.20 },
    { hookupType: "Water & Electric", siteCount: 380, reservations: 3040, revenue: 729600, averageNightlyRate: 55.80 },
    { hookupType: "Electric Only", siteCount: 180, reservations: 1260, revenue: 264600, averageNightlyRate: 42.50 },
    { hookupType: "No Hookups (Dry)", siteCount: 170, reservations: 1020, revenue: 173400, averageNightlyRate: 28.90 },
  ],
  revenueCorrelation: [
    { amenity: "Pull-Through", sitesWithAmenity: 420, avgRateWithAmenity: 72.80, avgRateWithoutAmenity: 52.40, revenueImpactPercent: 38.9 },
    { amenity: "Full Hookups", sitesWithAmenity: 520, avgRateWithAmenity: 75.20, avgRateWithoutAmenity: 55.80, revenueImpactPercent: 34.8 },
    { amenity: "WiFi", sitesWithAmenity: 980, avgRateWithAmenity: 68.50, avgRateWithoutAmenity: 52.40, revenueImpactPercent: 30.7 },
    { amenity: "Shade", sitesWithAmenity: 680, avgRateWithAmenity: 62.30, avgRateWithoutAmenity: 48.50, revenueImpactPercent: 28.5 },
    { amenity: "Pet Friendly", sitesWithAmenity: 890, avgRateWithAmenity: 58.90, avgRateWithoutAmenity: 48.50, revenueImpactPercent: 21.4 },
    { amenity: "Fire Pit", sitesWithAmenity: 820, avgRateWithAmenity: 52.40, avgRateWithoutAmenity: 48.50, revenueImpactPercent: 8.0 },
  ],
  campgroundAmenities: [
    { amenity: "Restrooms", campgroundCount: 48, totalRevenue: 2650000, totalBookings: 11200 },
    { amenity: "Showers", campgroundCount: 45, totalRevenue: 2480000, totalBookings: 10500 },
    { amenity: "Laundry", campgroundCount: 38, totalRevenue: 2120000, totalBookings: 8900 },
    { amenity: "Camp Store", campgroundCount: 35, totalRevenue: 1980000, totalBookings: 8200 },
    { amenity: "Pool", campgroundCount: 28, totalRevenue: 1750000, totalBookings: 7100 },
    { amenity: "Playground", campgroundCount: 32, totalRevenue: 1620000, totalBookings: 6800 },
    { amenity: "Dog Park", campgroundCount: 22, totalRevenue: 1380000, totalBookings: 5600 },
    { amenity: "Fishing", campgroundCount: 18, totalRevenue: 1120000, totalBookings: 4500 },
  ],
};

export default function AmenitiesPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState(mockAmenityData);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/amenities?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          if (result.topSiteAmenities?.length > 0) {
            setData(result);
            setIsUsingMockData(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch amenity data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const amenityIcons: Record<string, React.ReactNode> = {
    WiFi: <Wifi className="h-4 w-4" />,
    "Full Hookups": <Droplets className="h-4 w-4" />,
    "Water/Electric": <Zap className="h-4 w-4" />,
    Shade: <Trees className="h-4 w-4" />,
    Showers: <ShowerHead className="h-4 w-4" />,
    "Pet Friendly": <Dog className="h-4 w-4" />,
    Pool: <Waves className="h-4 w-4" />,
    "Fire Pit": <Flame className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Amenity Analytics</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Site and campground amenity performance analysis
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          title="Top Site Amenity"
          value="WiFi"
          loading={loading}
          subtitle="Highest demand"
          icon={<Wifi className="h-5 w-5 text-blue-400" />}
        />
        <KpiCard
          title="Revenue Impact Leader"
          value="Pull-Through"
          loading={loading}
          subtitle="+38.9% rate premium"
        />
        <KpiCard
          title="Most Common Hookup"
          value="Full Hookups"
          loading={loading}
          subtitle="520 sites"
          icon={<Droplets className="h-5 w-5 text-cyan-400" />}
        />
        <KpiCard
          title="Top Camp Amenity"
          value="Restrooms"
          loading={loading}
          subtitle="48 campgrounds"
        />
      </div>

      {/* Hookup Analysis */}
      <Card className="bg-muted/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Droplets className="h-5 w-5 text-cyan-400" />
            Hookup Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Performance by hookup configuration
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.hookupAnalysis.map((hookup, idx) => (
              <div key={idx} className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{hookup.hookupType}</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(hookup.averageNightlyRate)}</p>
                <p className="text-xs text-muted-foreground">/night avg</p>
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">{hookup.siteCount} sites</p>
                  <p className="text-xs text-muted-foreground">{hookup.reservations.toLocaleString()} reservations</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Correlation */}
      <Card className="bg-muted/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Amenity Revenue Impact</CardTitle>
          <p className="text-sm text-muted-foreground">
            How amenities affect nightly rates (sorted by impact)
          </p>
        </CardHeader>
        <CardContent>
          <TrendChart
            title=""
            data={data.revenueCorrelation}
            dataKeys={[
              { key: "revenueImpactPercent", color: "#10b981", name: "Revenue Impact %" },
            ]}
            xAxisKey="amenity"
            type="bar"
            height={250}
            formatYAxis={(v) => `+${v}%`}
            formatTooltip={(v) => `+${v.toFixed(1)}%`}
            loading={loading}
            showLegend={false}
          />
        </CardContent>
      </Card>

      {/* Site Amenities Table */}
      <DataTable
        title="Site Amenity Performance"
        description="Detailed metrics for site-level amenities"
        columns={[
          {
            key: "amenity",
            label: "Amenity",
            format: (v) => (
              <div className="flex items-center gap-2">
                {amenityIcons[v] || <div className="w-4 h-4" />}
                <span>{v}</span>
              </div>
            ),
          },
          { key: "siteCount", label: "Sites", align: "right", format: (v) => v.toLocaleString() },
          { key: "reservations", label: "Reservations", align: "right", format: (v) => v.toLocaleString() },
          { key: "revenue", label: "Revenue", align: "right", format: (v) => formatCurrency(v) },
          { key: "averageRate", label: "Avg Rate", align: "right", format: (v) => formatCurrency(v) },
          { key: "occupancyRate", label: "Occupancy", align: "right", format: (v) => `${v.toFixed(1)}%` },
        ]}
        data={data.topSiteAmenities}
        loading={loading}
      />

      {/* Campground Amenities Table */}
      <DataTable
        title="Campground Amenity Distribution"
        description="Facility-level amenities and their impact"
        columns={[
          { key: "amenity", label: "Amenity" },
          { key: "campgroundCount", label: "Campgrounds", align: "right", format: (v) => v.toLocaleString() },
          { key: "totalBookings", label: "Bookings", align: "right", format: (v) => v.toLocaleString() },
          { key: "totalRevenue", label: "Revenue", align: "right", format: (v) => formatCurrency(v) },
        ]}
        data={data.campgroundAmenities}
        loading={loading}
      />
    </div>
  );
}
