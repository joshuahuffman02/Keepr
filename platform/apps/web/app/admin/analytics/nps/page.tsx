"use client";

import { useState, useEffect } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  Minus,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Building2,
  Users,
  Smile,
  Meh,
  Frown,
  UserPlus,
  Repeat,
  Sun,
  Snowflake,
  Leaf,
  Flower2,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KpiCard,
  TrendChart,
  BreakdownPie,
  DataTable,
  DateRangePicker,
  NpsGauge,
  DivergingBar,
} from "@/components/analytics";

// Mock data
const mockNpsData = {
  overview: {
    score: 42,
    totalResponses: 2847,
    promoters: 1538,
    passives: 712,
    detractors: 597,
    promoterPercentage: 54.0,
    passivePercentage: 25.0,
    detractorPercentage: 21.0,
    responseRate: 28.5,
    previousScore: 38,
    scoreTrend: 4,
    // YoY comparison
    yoyScore: 35,
    yoyChange: 7,
    yoyResponses: 2156,
    yoyResponsesChange: 32.1,
  },
  trends: [
    { period: "2024-01", score: 35, responses: 220, promoters: 110, passives: 55, detractors: 55 },
    { period: "2024-02", score: 36, responses: 235, promoters: 120, passives: 58, detractors: 57 },
    { period: "2024-03", score: 38, responses: 280, promoters: 145, passives: 70, detractors: 65 },
    { period: "2024-04", score: 40, responses: 320, promoters: 170, passives: 80, detractors: 70 },
    { period: "2024-05", score: 42, responses: 385, promoters: 210, passives: 95, detractors: 80 },
    { period: "2024-06", score: 44, responses: 420, promoters: 235, passives: 105, detractors: 80 },
    { period: "2024-07", score: 45, responses: 445, promoters: 250, passives: 110, detractors: 85 },
    { period: "2024-08", score: 43, responses: 430, promoters: 240, passives: 108, detractors: 82 },
    { period: "2024-09", score: 42, responses: 350, promoters: 190, passives: 88, detractors: 72 },
    { period: "2024-10", score: 41, responses: 290, promoters: 155, passives: 73, detractors: 62 },
    { period: "2024-11", score: 40, responses: 245, promoters: 130, passives: 62, detractors: 53 },
    { period: "2024-12", score: 42, responses: 227, promoters: 123, passives: 57, detractors: 47 },
  ],
  byAccommodationType: [
    { segment: "cabin", score: 58, responses: 520, promoters: 320, detractors: 85 },
    { segment: "glamping", score: 52, responses: 180, promoters: 105, detractors: 35 },
    { segment: "rv", score: 42, responses: 1650, promoters: 870, detractors: 365 },
    { segment: "tent", score: 28, responses: 497, promoters: 215, detractors: 150 },
  ],
  byCampground: [
    { campgroundId: "1", campgroundName: "Top Performer 1", score: 72, responses: 245, promoterPercentage: 78, detractorPercentage: 6 },
    { campgroundId: "2", campgroundName: "Top Performer 2", score: 65, responses: 198, promoterPercentage: 72, detractorPercentage: 7 },
    { campgroundId: "3", campgroundName: "Top Performer 3", score: 58, responses: 312, promoterPercentage: 65, detractorPercentage: 7 },
    { campgroundId: "4", campgroundName: "Top Performer 4", score: 52, responses: 425, promoterPercentage: 62, detractorPercentage: 10 },
    { campgroundId: "5", campgroundName: "Top Performer 5", score: 48, responses: 178, promoterPercentage: 58, detractorPercentage: 10 },
    { campgroundId: "6", campgroundName: "Top Performer 6", score: 42, responses: 287, promoterPercentage: 55, detractorPercentage: 13 },
    { campgroundId: "7", campgroundName: "Top Performer 7", score: 38, responses: 356, promoterPercentage: 52, detractorPercentage: 14 },
    { campgroundId: "8", campgroundName: "Top Performer 8", score: 32, responses: 234, promoterPercentage: 48, detractorPercentage: 16 },
  ],
  worstCampgrounds: [
    { campgroundId: "9", campgroundName: "Needs Attention 1", score: -12, responses: 156, promoterPercentage: 22, detractorPercentage: 34, topIssues: ["cleanliness", "facilities"] },
    { campgroundId: "10", campgroundName: "Needs Attention 2", score: -5, responses: 89, promoterPercentage: 28, detractorPercentage: 33, topIssues: ["noise", "management"] },
    { campgroundId: "11", campgroundName: "Needs Attention 3", score: 5, responses: 245, promoterPercentage: 32, detractorPercentage: 27, topIssues: ["amenities", "value"] },
    { campgroundId: "12", campgroundName: "Needs Attention 4", score: 12, responses: 178, promoterPercentage: 35, detractorPercentage: 23, topIssues: ["wifi", "sites"] },
    { campgroundId: "13", campgroundName: "Needs Attention 5", score: 18, responses: 312, promoterPercentage: 38, detractorPercentage: 20, topIssues: ["staff", "check-in"] },
    { campgroundId: "14", campgroundName: "Needs Attention 6", score: 22, responses: 134, promoterPercentage: 40, detractorPercentage: 18, topIssues: ["bathrooms", "maintenance"] },
  ],
  recentComments: [
    { id: "1", score: 10, category: "promoter", comment: "Amazing experience! The staff was incredibly helpful and the facilities were top-notch.", sentiment: "positive", tags: ["staff", "facilities"], createdAt: new Date("2024-12-15"), campgroundName: "Campground A" },
    { id: "2", score: 9, category: "promoter", comment: "Beautiful location and clean sites. Will definitely be back next summer!", sentiment: "positive", tags: ["location", "cleanliness"], createdAt: new Date("2024-12-14"), campgroundName: "Campground B" },
    { id: "3", score: 7, category: "passive", comment: "Good overall but the WiFi was spotty. Sites were nice though.", sentiment: "neutral", tags: ["wifi", "sites"], createdAt: new Date("2024-12-13"), campgroundName: "Campground C" },
    { id: "4", score: 4, category: "detractor", comment: "Bathrooms were not clean and the noise from neighbors was excessive.", sentiment: "negative", tags: ["cleanliness", "noise"], createdAt: new Date("2024-12-12"), campgroundName: "Campground D" },
    { id: "5", score: 10, category: "promoter", comment: "Perfect family vacation! Kids loved the pool and playground.", sentiment: "positive", tags: ["family", "amenities"], createdAt: new Date("2024-12-11"), campgroundName: "Campground E" },
    { id: "6", score: 8, category: "passive", comment: "Nice campground but a bit pricey for what you get.", sentiment: "neutral", tags: ["value", "pricing"], createdAt: new Date("2024-12-10"), campgroundName: "Campground F" },
  ],
  tagAnalysis: [
    { tag: "staff", count: 425, avgScore: 8.5, sentiment: "positive" },
    { tag: "cleanliness", count: 380, avgScore: 7.2, sentiment: "neutral" },
    { tag: "location", count: 345, avgScore: 8.8, sentiment: "positive" },
    { tag: "amenities", count: 298, avgScore: 7.8, sentiment: "neutral" },
    { tag: "value", count: 256, avgScore: 6.5, sentiment: "neutral" },
    { tag: "wifi", count: 212, avgScore: 5.2, sentiment: "negative" },
    { tag: "noise", count: 178, avgScore: 4.8, sentiment: "negative" },
    { tag: "sites", count: 165, avgScore: 7.5, sentiment: "neutral" },
  ],
  byGuestType: [
    { guestType: "first_time", score: 38, responses: 1523, promoters: 720, passives: 410, detractors: 393 },
    { guestType: "repeat", score: 52, responses: 1324, promoters: 818, passives: 302, detractors: 204 },
  ],
  bySeason: [
    { season: "Spring", score: 45, responses: 580, promoters: 310, passives: 145, detractors: 125 },
    { season: "Summer", score: 38, responses: 1250, promoters: 625, passives: 312, detractors: 313 },
    { season: "Fall", score: 48, responses: 620, promoters: 350, passives: 155, detractors: 115 },
    { season: "Winter", score: 44, responses: 397, promoters: 210, passives: 100, detractors: 87 },
  ],
  detractorFollowUps: [
    { id: "d1", score: 2, comment: "Terrible experience. Site was dirty and staff was rude.", campgroundName: "Needs Attention 1", guestEmail: "guest1@example.com", createdAt: new Date("2024-12-15"), followedUp: false, resolved: false },
    { id: "d2", score: 4, comment: "WiFi didn't work at all. Very disappointing.", campgroundName: "Needs Attention 2", guestEmail: "guest2@example.com", createdAt: new Date("2024-12-14"), followedUp: true, followUpAt: new Date("2024-12-15"), resolved: false },
    { id: "d3", score: 3, comment: "Noisy neighbors all night. No quiet hours enforced.", campgroundName: "Needs Attention 3", guestEmail: "guest3@example.com", createdAt: new Date("2024-12-13"), followedUp: true, followUpAt: new Date("2024-12-14"), followUpNote: "Offered refund", resolved: true },
    { id: "d4", score: 5, comment: "Bathrooms were in poor condition.", campgroundName: "Needs Attention 4", guestEmail: "guest4@example.com", createdAt: new Date("2024-12-12"), followedUp: false, resolved: false },
    { id: "d5", score: 1, comment: "Complete waste of money. Nothing as advertised.", campgroundName: "Needs Attention 5", guestEmail: "guest5@example.com", createdAt: new Date("2024-12-11"), followedUp: false, resolved: false },
  ],
};

function getNpsColor(score: number): string {
  if (score >= 50) return "text-green-400";
  if (score >= 0) return "text-amber-400";
  return "text-red-400";
}

function getNpsBgColor(score: number): string {
  if (score >= 50) return "bg-green-500/20 border-green-500/50";
  if (score >= 0) return "bg-amber-500/20 border-amber-500/50";
  return "bg-red-500/20 border-red-500/50";
}

function getNpsLabel(score: number): string {
  if (score >= 70) return "Excellent";
  if (score >= 50) return "Great";
  if (score >= 30) return "Good";
  if (score >= 0) return "Needs Work";
  return "Critical";
}

export default function NpsAnalyticsPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState(mockNpsData);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/nps?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          if (result.overview?.totalResponses > 0) {
            setData(result);
            setIsUsingMockData(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch NPS data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const distributionData = [
    { name: "Promoters (9-10)", value: data.overview.promoterPercentage, color: "#22c55e" },
    { name: "Passives (7-8)", value: data.overview.passivePercentage, color: "#f59e0b" },
    { name: "Detractors (0-6)", value: data.overview.detractorPercentage, color: "#ef4444" },
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "promoter":
        return <Smile className="h-4 w-4 text-green-400" />;
      case "passive":
        return <Meh className="h-4 w-4 text-amber-400" />;
      case "detractor":
        return <Frown className="h-4 w-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <Badge className="bg-green-500/20 text-green-400 border-0">Positive</Badge>;
      case "negative":
        return <Badge className="bg-red-500/20 text-red-400 border-0">Negative</Badge>;
      default:
        return <Badge className="bg-muted0/20 text-muted-foreground border-0">Neutral</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">NPS Analytics</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-100 text-amber-700 border border-amber-300">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Net Promoter Score tracking and guest sentiment analysis
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Main NPS Score Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <NpsGauge
          score={data.overview.score}
          scoreTrend={data.overview.scoreTrend}
          yoyScore={data.overview.yoyScore}
          yoyChange={data.overview.yoyChange}
          loading={loading}
        />

        <Card className="border-border">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ThumbsUp className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-green-600">{data.overview.promoters}</p>
                <p className="text-xs text-muted-foreground">Promoters</p>
                <p className="text-sm text-green-600">{data.overview.promoterPercentage.toFixed(0)}%</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Minus className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-amber-600">{data.overview.passives}</p>
                <p className="text-xs text-muted-foreground">Passives</p>
                <p className="text-sm text-amber-600">{data.overview.passivePercentage.toFixed(0)}%</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ThumbsDown className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold text-red-600">{data.overview.detractors}</p>
                <p className="text-xs text-muted-foreground">Detractors</p>
                <p className="text-sm text-red-600">{data.overview.detractorPercentage.toFixed(0)}%</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Responses</span>
                <span className="text-foreground font-medium">{data.overview.totalResponses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Response Rate</span>
                <span className="text-foreground font-medium">{data.overview.responseRate.toFixed(1)}%</span>
              </div>
              {data.overview.yoyResponses !== null && data.overview.yoyResponses !== undefined && (
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">YoY Response Growth</span>
                  <span className={data.overview.yoyResponsesChange !== null && data.overview.yoyResponsesChange >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {data.overview.yoyResponsesChange !== null && data.overview.yoyResponsesChange > 0 ? "+" : ""}{data.overview.yoyResponsesChange?.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <BreakdownPie
          title="Score Distribution"
          data={distributionData}
          height={250}
          formatValue={(v) => `${v.toFixed(0)}%`}
          loading={loading}
        />
      </div>

      {/* NPS Trend */}
      <TrendChart
        title="NPS Score Over Time"
        description="Monthly NPS trend"
        data={data.trends}
        dataKeys={[
          { key: "score", color: "#3b82f6", name: "NPS Score" },
        ]}
        xAxisKey="period"
        type="area"
        height={300}
        formatYAxis={(v) => `${v}`}
        formatTooltip={(v) => `${v}`}
        loading={loading}
        yAxisLabel="NPS Score"
      />

      {/* By Segment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataTable
          title="NPS by Accommodation Type"
          description="How satisfaction varies by site type"
          columns={[
            {
              key: "segment",
              label: "Type",
              format: (v) => <span className="capitalize">{v}</span>,
            },
            {
              key: "score",
              label: "NPS",
              align: "right",
              format: (v) => <span className={getNpsColor(v)}>{v}</span>,
            },
            { key: "responses", label: "Responses", align: "right", format: (v) => v.toLocaleString() },
            {
              key: "promoters",
              label: "Promoters",
              align: "right",
              format: (v) => <span className="text-green-400">{v}</span>,
            },
            {
              key: "detractors",
              label: "Detractors",
              align: "right",
              format: (v) => <span className="text-red-400">{v}</span>,
            },
          ]}
          data={data.byAccommodationType}
          loading={loading}
        />

        <DataTable
          title="Top Performing Campgrounds"
          description="Ranked by NPS score"
          columns={[
            { key: "campgroundName", label: "Campground" },
            {
              key: "score",
              label: "NPS",
              align: "right",
              format: (v) => <span className={getNpsColor(v)}>{v}</span>,
            },
            { key: "responses", label: "Responses", align: "right", format: (v) => v.toLocaleString() },
            {
              key: "promoterPercentage",
              label: "Promoters",
              align: "right",
              format: (v) => <span className="text-green-400">{v.toFixed(0)}%</span>,
            },
          ]}
          data={data.byCampground}
          loading={loading}
          maxRows={8}
        />
      </div>

      {/* NPS by Accommodation Type - Diverging Bar */}
      <DivergingBar
        title="NPS Breakdown by Accommodation Type"
        description="Compare promoter vs detractor percentages across site types"
        data={data.byAccommodationType.map(item => ({
          label: item.segment.charAt(0).toUpperCase() + item.segment.slice(1),
          positive: Math.round((item.promoters / item.responses) * 100),
          negative: Math.round((item.detractors / item.responses) * 100),
          neutral: Math.round(((item.responses - item.promoters - item.detractors) / item.responses) * 100),
          score: item.score,
        }))}
        loading={loading}
        maxValue={100}
      />

      {/* Needs Attention - Worst Performing */}
      {data.worstCampgrounds && data.worstCampgrounds.length > 0 && (
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Frown className="h-5 w-5 text-red-500" />
              <CardTitle className="text-lg text-foreground">Needs Attention</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Campgrounds with lowest NPS scores - prioritize for improvement
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-red-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Campground</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">NPS</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Responses</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Detractors</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Top Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {data.worstCampgrounds.map((cg, idx) => (
                    <tr key={cg.campgroundId} className={idx % 2 === 0 ? "bg-red-100/50" : ""}>
                      <td className="py-3 px-4 text-sm text-foreground">{cg.campgroundName}</td>
                      <td className={`py-3 px-4 text-sm text-right font-semibold ${getNpsColor(cg.score)}`}>
                        {cg.score}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-foreground">
                        {cg.responses.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-red-600 font-medium">
                        {cg.detractorPercentage}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {cg.topIssues?.map((issue, i) => (
                            <Badge
                              key={i}
                              className="bg-red-100 text-red-700 border-red-300 text-xs"
                            >
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Guest Type & Seasonal Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NPS by Guest Type */}
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              NPS by Guest Type
            </CardTitle>
            <p className="text-sm text-muted-foreground">First-time vs returning guests</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {data.byGuestType?.map((gt) => (
                <div
                  key={gt.guestType}
                  className={`p-4 rounded-lg border ${
                    gt.guestType === "repeat"
                      ? "bg-blue-500/10 border-blue-500/30"
                      : "bg-muted/50 border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {gt.guestType === "first_time" ? (
                      <UserPlus className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Repeat className="h-5 w-5 text-blue-400" />
                    )}
                    <span className="font-medium text-foreground">
                      {gt.guestType === "first_time" ? "First-Time" : "Repeat"}
                    </span>
                  </div>
                  <p className={`text-3xl font-bold ${getNpsColor(gt.score)}`}>{gt.score}</p>
                  <p className="text-sm text-muted-foreground mt-1">{gt.responses.toLocaleString()} responses</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-green-400">{gt.promoters} promoters</span>
                    <span className="text-red-400">{gt.detractors} detractors</span>
                  </div>
                </div>
              ))}
            </div>
            {data.byGuestType && data.byGuestType.length === 2 && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-300">
                  <strong>Insight:</strong> Repeat guests score{" "}
                  <span className="font-bold">
                    {Math.abs(data.byGuestType[1].score - data.byGuestType[0].score)} points
                  </span>{" "}
                  {data.byGuestType[1].score > data.byGuestType[0].score ? "higher" : "lower"} than first-time guests
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* NPS by Season */}
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Sun className="h-5 w-5 text-amber-400" />
              NPS by Season
            </CardTitle>
            <p className="text-sm text-muted-foreground">How satisfaction varies throughout the year</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {data.bySeason?.map((s) => {
                const SeasonIcon =
                  s.season === "Summer" ? Sun :
                  s.season === "Winter" ? Snowflake :
                  s.season === "Fall" ? Leaf : Flower2;
                const seasonColor =
                  s.season === "Summer" ? "text-amber-400" :
                  s.season === "Winter" ? "text-blue-300" :
                  s.season === "Fall" ? "text-orange-400" : "text-pink-400";
                return (
                  <div key={s.season} className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <SeasonIcon className={`h-4 w-4 ${seasonColor}`} />
                        <span className="font-medium text-foreground">{s.season}</span>
                      </div>
                      <span className={`text-xl font-bold ${getNpsColor(s.score)}`}>{s.score}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.responses.toLocaleString()} responses</p>
                  </div>
                );
              })}
            </div>
            {data.bySeason && data.bySeason.length > 0 && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Peak Season Impact:</strong> Summer has the most responses but{" "}
                  {data.bySeason.find(s => s.season === "Summer")?.score || 0 <
                   Math.max(...data.bySeason.map(s => s.score))
                    ? "lower NPS—high volume may strain quality"
                    : "maintains strong NPS"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detractor Follow-ups */}
      {data.detractorFollowUps && data.detractorFollowUps.length > 0 && (
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                  Detractor Follow-ups
                </CardTitle>
                <p className="text-sm text-muted-foreground">Track outreach to unhappy guests</p>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded">
                  {data.detractorFollowUps.filter(d => !d.followedUp).length} Pending
                </span>
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded">
                  {data.detractorFollowUps.filter(d => d.followedUp && !d.resolved).length} In Progress
                </span>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                  {data.detractorFollowUps.filter(d => d.resolved).length} Resolved
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.detractorFollowUps.map((d) => (
                <div
                  key={d.id}
                  className={`p-4 rounded-lg border ${
                    d.resolved
                      ? "bg-green-500/5 border-green-500/20"
                      : d.followedUp
                        ? "bg-amber-500/5 border-amber-500/20"
                        : "bg-red-500/5 border-red-500/20"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-red-400">{d.score}</span>
                        <span className="text-muted-foreground">{d.campgroundName}</span>
                        {d.resolved ? (
                          <Badge className="bg-green-500/20 text-green-400 border-0">
                            <CheckCircle className="h-3 w-3 mr-1" /> Resolved
                          </Badge>
                        ) : d.followedUp ? (
                          <Badge className="bg-amber-500/20 text-amber-400 border-0">
                            <Clock className="h-3 w-3 mr-1" /> Contacted
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-0">
                            <AlertCircle className="h-3 w-3 mr-1" /> Needs Follow-up
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">{d.comment}</p>
                      {d.followUpNote && (
                        <p className="text-xs text-muted-foreground mt-2 italic">Note: {d.followUpNote}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{new Date(d.createdAt).toLocaleDateString()}</p>
                      {d.guestEmail && (
                        <div className="flex items-center gap-1 mt-1 text-blue-400">
                          <Mail className="h-3 w-3" />
                          <span>{d.guestEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tag Analysis */}
      <Card className="bg-muted/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Feedback Themes</CardTitle>
          <p className="text-sm text-muted-foreground">Common topics mentioned in NPS feedback</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.tagAnalysis.map((tag, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  tag.sentiment === "positive"
                    ? "bg-green-500/10 border-green-500/30"
                    : tag.sentiment === "negative"
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground capitalize">{tag.tag}</span>
                  {getSentimentBadge(tag.sentiment)}
                </div>
                <p className="text-2xl font-bold text-foreground">{tag.count}</p>
                <p className="text-xs text-muted-foreground">
                  Avg score: <span className={getNpsColor(tag.avgScore * 10 - 50)}>{tag.avgScore.toFixed(1)}</span>
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Comments */}
      <Card className="bg-muted/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-400" />
            Recent Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recentComments.map((comment) => (
              <div
                key={comment.id}
                className={`p-4 rounded-lg border ${
                  comment.category === "promoter"
                    ? "bg-green-500/5 border-green-500/20"
                    : comment.category === "detractor"
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-muted/30 border-border"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getCategoryIcon(comment.category)}
                    <span
                      className={`text-lg font-bold ${
                        comment.score >= 9
                          ? "text-green-400"
                          : comment.score >= 7
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {comment.score}
                    </span>
                    <span className="text-muted-foreground text-sm">{comment.campgroundName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-muted-foreground">{comment.comment}</p>
                {comment.tags.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {comment.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs border-border">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* NPS Explanation */}
      <Card className="bg-muted/50 border-border">
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Understanding NPS</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <ThumbsUp className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Promoters (9-10)</p>
                <p className="text-sm text-muted-foreground">Loyal enthusiasts who will keep booking and refer others</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Minus className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Passives (7-8)</p>
                <p className="text-sm text-muted-foreground">Satisfied but unenthusiastic, vulnerable to competitors</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <ThumbsDown className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Detractors (0-6)</p>
                <p className="text-sm text-muted-foreground">Unhappy guests who can damage reputation through negative word-of-mouth</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-muted-foreground">
              <strong className="text-foreground">NPS = % Promoters - % Detractors</strong>
              <span className="block text-sm mt-1">Scores range from -100 to +100. Above 0 is good, above 50 is excellent.</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
