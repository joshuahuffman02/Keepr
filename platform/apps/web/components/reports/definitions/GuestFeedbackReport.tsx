import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "@/components/charts/recharts";
import { Star } from "lucide-react";

interface GuestFeedbackReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#15803d"];

export function GuestFeedbackReport({ campgroundId, dateRange }: GuestFeedbackReportProps) {
  const {
    data: reviews,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-reviews", campgroundId],
    queryFn: () => apiClient.getAdminReviews(campgroundId),
  });

  const reportData = useMemo(() => {
    if (!reviews) return null;

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    // Filter reviews in date range
    const filtered = reviews.filter((r) => {
      if (!r.createdAt) return false;
      const date = new Date(r.createdAt);
      return date >= start && date <= end;
    });

    if (filtered.length === 0) return null;

    // Calculate average rating
    const totalRating = filtered.reduce((acc, r) => acc + r.rating, 0);
    const avgRating = (totalRating / filtered.length).toFixed(1);

    // Rating distribution
    const ratingCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const isRating = (value: number): value is 1 | 2 | 3 | 4 | 5 => value >= 1 && value <= 5;
    filtered.forEach((r) => {
      const rating = Math.round(r.rating);
      if (isRating(rating)) {
        ratingCounts[rating]++;
      }
    });

    const ratingData = [
      { name: "1 Star", value: ratingCounts[1] },
      { name: "2 Stars", value: ratingCounts[2] },
      { name: "3 Stars", value: ratingCounts[3] },
      { name: "4 Stars", value: ratingCounts[4] },
      { name: "5 Stars", value: ratingCounts[5] },
    ];

    // Sentiment analysis (mock logic based on rating if sentiment not present)
    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    filtered.forEach((r) => {
      if (r.rating >= 4) sentimentCounts.positive++;
      else if (r.rating === 3) sentimentCounts.neutral++;
      else sentimentCounts.negative++;
    });

    const sentimentData = [
      { name: "Positive", value: sentimentCounts.positive, color: "#22c55e" },
      { name: "Neutral", value: sentimentCounts.neutral, color: "#eab308" },
      { name: "Negative", value: sentimentCounts.negative, color: "#ef4444" },
    ].filter((d) => d.value > 0);

    // NPS Calculation (Proxy using 5-star rating)
    // Promoters: 5, Passives: 4, Detractors: 1-3
    const promoters = ratingCounts[5];
    const detractors = ratingCounts[1] + ratingCounts[2] + ratingCounts[3];
    const nps =
      filtered.length > 0 ? Math.round(((promoters - detractors) / filtered.length) * 100) : 0;

    return {
      totalReviews: filtered.length,
      avgRating,
      nps,
      ratingData,
      sentimentData,
    };
  }, [reviews, dateRange]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading feedback data...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">Failed to load review data.</div>;
  }

  if (!reportData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-muted rounded-lg border border-border">
        <div className="text-muted-foreground mb-2">No reviews found</div>
        <p className="text-xs text-muted-foreground">Try adjusting the date range.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{reportData.avgRating}</div>
              <div className="text-sm text-muted-foreground">/ 5.0</div>
            </div>
            <div className="flex mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= Math.round(Number(reportData.avgRating))
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Promoter Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                reportData.nps > 0
                  ? "text-green-600"
                  : reportData.nps < 0
                    ? "text-red-600"
                    : "text-muted-foreground"
              }`}
            >
              {reportData.nps > 0 ? "+" : ""}
              {reportData.nps}
            </div>
            <p className="text-xs text-muted-foreground">Based on rating proxy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalReviews}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
          </CardHeader>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.ratingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {reportData.ratingData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <CardHeader>
            <CardTitle>Sentiment Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Estimated from review scores</p>
          </CardHeader>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reportData.sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                >
                  {reportData.sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
