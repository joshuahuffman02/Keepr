"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  AlertTriangle,
  TrendingDown,
  Lightbulb,
  CheckCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/analytics";

interface Suggestion {
  priority: "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  expectedImpact: string;
  estimatedEffort: "low" | "medium" | "high";
}

interface CampgroundSuggestion {
  campgroundId: string;
  campgroundName: string;
  npsScore: number;
  primaryIssues: string[];
  suggestions: Suggestion[];
  detractorCount: number;
  topComplaints: string[];
}

interface Anomaly {
  id: string;
  type: string;
  severity: "warning" | "critical";
  campgroundName?: string;
  message: string;
  currentValue: number;
  expectedValue: number;
  deviationPercent: number;
  recommendations: string[];
}

// Mock data - to be replaced with real AI-generated insights
const mockSuggestions: CampgroundSuggestion[] = [
  {
    campgroundId: "1",
    campgroundName: "Needs Attention 1",
    npsScore: -12,
    primaryIssues: ["cleanliness", "facilities", "staff"],
    suggestions: [
      {
        priority: "high",
        category: "Leadership",
        title: "Conduct Emergency Service Review",
        description: "With negative NPS, immediate intervention is required. Schedule on-site management review, mystery guest evaluation, and staff meeting to address core issues.",
        expectedImpact: "Foundation for all other improvements",
        estimatedEffort: "low",
      },
      {
        priority: "high",
        category: "Operations",
        title: "Implement Daily Cleanliness Audits",
        description: "Establish a daily inspection checklist for restrooms, common areas, and sites. Assign accountability to specific staff members.",
        expectedImpact: "Can improve NPS by 10-15 points",
        estimatedEffort: "low",
      },
      {
        priority: "high",
        category: "Maintenance",
        title: "Facilities Maintenance Program",
        description: "Create a preventive maintenance schedule for all facilities. Address repair requests within 24 hours.",
        expectedImpact: "Can improve NPS by 6-10 points",
        estimatedEffort: "medium",
      },
      {
        priority: "high",
        category: "Training",
        title: "Customer Service Training Program",
        description: "Implement monthly customer service training sessions focusing on guest interactions, problem resolution, and proactive service.",
        expectedImpact: "Can improve NPS by 8-12 points",
        estimatedEffort: "medium",
      },
    ],
    detractorCount: 53,
    topComplaints: [
      "Bathrooms were disgusting and never cleaned",
      "Staff was rude when I asked about checkout",
      "Sites were not level and drainage was terrible",
      "Nobody answered the phone when I called",
    ],
  },
  {
    campgroundId: "2",
    campgroundName: "Needs Attention 2",
    npsScore: -5,
    primaryIssues: ["noise", "management", "wifi"],
    suggestions: [
      {
        priority: "high",
        category: "Policies",
        title: "Enforce Quiet Hours",
        description: "Clearly communicate quiet hours (10 PM - 8 AM) at check-in and via signage. Train staff on diplomatic enforcement procedures.",
        expectedImpact: "Can improve NPS by 8-10 points",
        estimatedEffort: "low",
      },
      {
        priority: "high",
        category: "Leadership",
        title: "Management Responsiveness Training",
        description: "Ensure management is visible and accessible. Implement a system for escalating and resolving guest concerns within 2 hours.",
        expectedImpact: "Can improve NPS by 8-12 points",
        estimatedEffort: "low",
      },
      {
        priority: "medium",
        category: "Infrastructure",
        title: "Upgrade WiFi Infrastructure",
        description: "Assess current WiFi coverage and bandwidth. Consider mesh network systems or additional access points for better coverage.",
        expectedImpact: "Can improve NPS by 5-8 points",
        estimatedEffort: "medium",
      },
    ],
    detractorCount: 29,
    topComplaints: [
      "Loud parties until 2am and no one did anything",
      "Manager was never available",
      "WiFi didn't work at all",
    ],
  },
  {
    campgroundId: "3",
    campgroundName: "Needs Attention 3",
    npsScore: 5,
    primaryIssues: ["amenities", "value", "sites"],
    suggestions: [
      {
        priority: "medium",
        category: "Guest Experience",
        title: "Amenity Audit and Enhancement",
        description: "Survey guests on desired amenities. Prioritize additions that have highest demand and ROI (e.g., dog park, playground equipment).",
        expectedImpact: "Can improve NPS by 5-10 points",
        estimatedEffort: "high",
      },
      {
        priority: "medium",
        category: "Pricing",
        title: "Value Enhancement Strategy",
        description: "Review pricing against local competitors. Consider adding value through complimentary amenities (coffee, firewood) rather than price cuts.",
        expectedImpact: "Can improve NPS by 5-8 points",
        estimatedEffort: "low",
      },
      {
        priority: "medium",
        category: "Infrastructure",
        title: "Site Quality Improvements",
        description: "Address drainage issues, level pads, and ensure adequate spacing between sites. Consider site-specific upgrades for premium pricing.",
        expectedImpact: "Can improve NPS by 5-10 points",
        estimatedEffort: "high",
      },
    ],
    detractorCount: 67,
    topComplaints: [
      "Not worth the price",
      "Bare bones amenities",
      "Sites were too close together",
    ],
  },
];

const mockAnomalies: Anomaly[] = [
  {
    id: "1",
    type: "nps_drop",
    severity: "critical",
    campgroundName: "Needs Attention 1",
    message: "NPS dropped 25 points in the last 30 days",
    currentValue: -12,
    expectedValue: 13,
    deviationPercent: 192,
    recommendations: [
      "Review recent negative feedback for common themes",
      "Schedule manager check-in with front-line staff",
      "Consider targeted outreach to recent detractors",
    ],
  },
  {
    id: "2",
    type: "cancellation_spike",
    severity: "warning",
    message: "Platform cancellation rate increased to 8.5%",
    currentValue: 8.5,
    expectedValue: 5.2,
    deviationPercent: 63,
    recommendations: [
      "Analyze cancellation reasons in booking data",
      "Review recent pricing or policy changes",
      "Check for external factors (weather, events)",
    ],
  },
];

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "medium":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "low":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default:
      return "bg-muted0/20 text-muted-foreground";
  }
}

function getEffortBadge(effort: string) {
  const colors: Record<string, string> = {
    low: "bg-green-500/20 text-green-400",
    medium: "bg-amber-500/20 text-amber-400",
    high: "bg-red-500/20 text-red-400",
  };
  return <Badge className={colors[effort]}>{effort} effort</Badge>;
}

function getNpsColor(nps: number): string {
  if (nps >= 50) return "text-green-400";
  if (nps >= 0) return "text-amber-400";
  return "text-red-400";
}

// Helper to round long decimals in message strings
function formatMessage(message: string): string {
  return message.replace(/(\d+\.\d{2,})/g, (match) => {
    const num = parseFloat(match);
    return (Math.round(num * 10) / 10).toString();
  });
}

export default function AiInsightsPage() {
  const [dateRange, setDateRange] = useState("last_30_days");
  const [suggestions, setSuggestions] = useState(mockSuggestions);
  const [anomalies, setAnomalies] = useState(mockAnomalies);
  const [expandedCampground, setExpandedCampground] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [suggestionsRes, anomaliesRes] = await Promise.all([
          fetch(`/api/admin/platform-analytics/ai/suggestions?range=${dateRange}`),
          fetch(`/api/admin/platform-analytics/ai/anomalies?range=${dateRange}`),
        ]);
        if (suggestionsRes.ok) {
          const data = await suggestionsRes.json();
          if (data.length > 0) {
            setSuggestions(data);
            setIsUsingMockData(false);
          }
        }
        if (anomaliesRes.ok) {
          const data = await anomaliesRes.json();
          if (data.length > 0) {
            setAnomalies(data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch AI data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const totalSuggestions = suggestions.reduce((sum, s) => sum + s.suggestions.length, 0);
  const highPrioritySuggestions = suggestions.reduce(
    (sum, s) => sum + s.suggestions.filter((sg) => sg.priority === "high").length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">AI Insights</h1>
            <Badge className="bg-purple-600/20 text-purple-400 border border-purple-600/50">
              <Sparkles className="h-3 w-3 mr-1" /> AI-Powered
            </Badge>
            {isUsingMockData && (
              <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">AI-generated improvement recommendations and anomaly detection</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Lightbulb className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalSuggestions}</p>
                <p className="text-sm text-muted-foreground">Total Suggestions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Target className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{highPrioritySuggestions}</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Building2 className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{suggestions.length}</p>
                <p className="text-sm text-muted-foreground">Parks Need Help</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{anomalies.length}</p>
                <p className="text-sm text-muted-foreground">Anomalies Detected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Anomalies Detected
            </CardTitle>
            <p className="text-sm text-muted-foreground">Unusual patterns that require attention</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className={`p-4 rounded-lg border ${
                    anomaly.severity === "critical"
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-amber-500/10 border-amber-500/30"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={anomaly.severity === "critical" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}>
                          {anomaly.severity}
                        </Badge>
                        {anomaly.campgroundName && (
                          <span className="text-muted-foreground">{anomaly.campgroundName}</span>
                        )}
                      </div>
                      <p className="font-medium text-foreground">{formatMessage(anomaly.message)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-400">
                        {typeof anomaly.currentValue === 'number' ? Math.round(anomaly.currentValue * 10) / 10 : anomaly.currentValue}
                        {anomaly.type === "cancellation_spike" ? "%" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expected: {typeof anomaly.expectedValue === 'number' ? Math.round(anomaly.expectedValue * 10) / 10 : anomaly.expectedValue}{anomaly.type === "cancellation_spike" ? "%" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Recommendations:</p>
                    <ul className="space-y-1">
                      {anomaly.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Improvement Suggestions by Campground */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400" />
          Improvement Plans by Campground
        </h2>
        {suggestions.map((cg) => (
          <Card key={cg.campgroundId} className="bg-muted/50 border-border">
            <CardHeader
              className="cursor-pointer"
              onClick={() =>
                setExpandedCampground(expandedCampground === cg.campgroundId ? null : cg.campgroundId)
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className={`text-3xl font-bold ${getNpsColor(cg.npsScore)}`}>{cg.npsScore}</p>
                    <p className="text-xs text-muted-foreground">NPS</p>
                  </div>
                  <div>
                    <CardTitle className="text-foreground">{cg.campgroundName}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">{cg.detractorCount} detractors</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">{cg.suggestions.length} suggestions</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {cg.primaryIssues.slice(0, 3).map((issue, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs border-border">
                        {issue}
                      </Badge>
                    ))}
                  </div>
                  {expandedCampground === cg.campgroundId ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
            {expandedCampground === cg.campgroundId && (
              <CardContent className="border-t border-border">
                {/* Top Complaints */}
                {cg.topComplaints.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Recent Complaints</h4>
                    <div className="space-y-2">
                      {cg.topComplaints.map((complaint, idx) => (
                        <p key={idx} className="text-sm text-muted-foreground italic pl-4 border-l-2 border-red-500/50">
                          "{complaint}"
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Recommended Actions</h4>
                  <div className="space-y-3">
                    {cg.suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${getPriorityColor(suggestion.priority)}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getPriorityColor(suggestion.priority)}>
                              {suggestion.priority} priority
                            </Badge>
                            <Badge variant="outline" className="border-border">
                              {suggestion.category}
                            </Badge>
                          </div>
                          {getEffortBadge(suggestion.estimatedEffort)}
                        </div>
                        <h5 className="font-medium text-foreground mb-1">{suggestion.title}</h5>
                        <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
                        <p className="text-xs text-green-400">
                          <Zap className="h-3 w-3 inline mr-1" />
                          Expected Impact: {suggestion.expectedImpact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
