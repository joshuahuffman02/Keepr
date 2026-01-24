import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "./ai-provider.service";
import { AiFeatureGateService } from "./ai-feature-gate.service";
import { AiFeatureType } from "@prisma/client";
import { getReportCatalog, getReportSpec } from "../reports/report.registry";

interface ReportQueryInput {
  reportId: string;
  dimensions?: string[];
  filters?: Record<string, unknown>;
  timeRange?: {
    preset?: string;
    start?: string;
    end?: string;
  };
  limit?: number;
}

export interface ParsedQuery {
  reportId: string;
  reportName: string;
  dimensions?: string[];
  filters?: Record<string, unknown>;
  timeRange?: {
    preset?: string;
    start?: string;
    end?: string;
  };
  interpretation: string;
  confidence: number;
}

export interface ReportNarrative {
  summary: string;
  keyFindings: string[];
  trends?: string[];
  recommendations?: string[];
}

@Injectable()
export class AiReportQueryService {
  private readonly logger = new Logger(AiReportQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly gate: AiFeatureGateService,
  ) {}

  /**
   * Parse a natural language query into report parameters
   */
  async parseQuery(campgroundId: string, query: string, userId?: string): Promise<ParsedQuery> {
    await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.analytics);

    // Get available reports for context
    const catalog = getReportCatalog({ includeHeavy: false });
    const reportSummary = catalog.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      dimensions: r.dimensions,
      metrics: r.metrics,
    }));

    const systemPrompt = `You are a report query parser for a campground management system.
Your job is to convert natural language questions into structured report queries.

Available reports:
${JSON.stringify(reportSummary, null, 2)}

Time range presets available:
- "today", "yesterday", "this_week", "last_week", "this_month", "last_month"
- "last_7_days", "last_30_days", "last_90_days", "last_12_months"
- "this_quarter", "last_quarter", "this_year", "last_year"
- "ytd" (year to date), "mtd" (month to date)

Parse the user's question and return a JSON object with:
{
  "reportId": "the most appropriate report ID from the catalog",
  "reportName": "human readable name of the report",
  "dimensions": ["optional array of dimension IDs to group by"],
  "filters": {"optional object of filters"},
  "timeRange": {"preset": "time preset" OR "start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},
  "interpretation": "brief explanation of how you interpreted the query",
  "confidence": 0.0 to 1.0 confidence score
}

If the query doesn't match any report well, still pick the closest match but set confidence low.
If the query is ambiguous about time, default to "last_30_days".
If asking about "today" or "now", use "today" preset.`;

    const userPrompt = `Parse this report query: "${query}"`;

    try {
      const response = await this.provider.getCompletion({
        campgroundId,
        featureType: AiFeatureType.analytics,
        systemPrompt,
        userPrompt,
        userId,
        maxTokens: 500,
        temperature: 0.2,
      });

      // Parse the JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          reportId: parsed.reportId || "bookings.daily_bookings",
          reportName: parsed.reportName || "Daily Bookings",
          dimensions: parsed.dimensions,
          filters: parsed.filters,
          timeRange: parsed.timeRange || { preset: "last_30_days" },
          interpretation: parsed.interpretation || "Showing default report",
          confidence: parsed.confidence || 0.5,
        };
      }

      // Fallback if parsing fails
      return this.fallbackParse(query);
    } catch (error) {
      this.logger.warn(`AI report query parsing failed: ${error}`);
      return this.fallbackParse(query);
    }
  }

  /**
   * Rule-based fallback parser
   */
  private fallbackParse(query: string): ParsedQuery {
    const q = query.toLowerCase();

    // Detect time range
    let timeRange: ParsedQuery["timeRange"] = { preset: "last_30_days" };
    if (q.includes("today")) timeRange = { preset: "today" };
    else if (q.includes("yesterday")) timeRange = { preset: "yesterday" };
    else if (q.includes("this week")) timeRange = { preset: "this_week" };
    else if (q.includes("last week")) timeRange = { preset: "last_week" };
    else if (q.includes("this month")) timeRange = { preset: "this_month" };
    else if (q.includes("last month")) timeRange = { preset: "last_month" };
    else if (q.includes("7 day") || q.includes("week")) timeRange = { preset: "last_7_days" };
    else if (q.includes("90 day") || q.includes("quarter")) timeRange = { preset: "last_90_days" };
    else if (q.includes("year") || q.includes("12 month")) timeRange = { preset: "last_12_months" };

    // Detect report type
    let reportId = "bookings.daily_bookings";
    let reportName = "Daily Bookings";

    if (q.includes("revenue") || q.includes("money") || q.includes("income")) {
      if (q.includes("month")) {
        reportId = "bookings.monthly_revenue";
        reportName = "Monthly Revenue";
      } else if (q.includes("week")) {
        reportId = "bookings.weekly_revenue";
        reportName = "Weekly Revenue";
      } else {
        reportId = "bookings.daily_bookings";
        reportName = "Daily Revenue";
      }
    } else if (q.includes("occupancy")) {
      reportId = "inventory.status_mix";
      reportName = "Occupancy Status Mix";
    } else if (q.includes("payment") || q.includes("cash")) {
      reportId = "payments.daily_cashflow";
      reportName = "Daily Cashflow";
    } else if (q.includes("cancel")) {
      reportId = "bookings.cancellation_rate";
      reportName = "Cancellation Rate";
    } else if (q.includes("source") || q.includes("channel")) {
      reportId = "bookings.channel_mix";
      reportName = "Booking Channel Mix";
    } else if (q.includes("arrival")) {
      reportId = "inventory.arrival_load";
      reportName = "Arrival Load";
    } else if (q.includes("promo") || q.includes("discount")) {
      reportId = "bookings.promo_performance";
      reportName = "Promo Performance";
    } else if (q.includes("pos") || q.includes("store") || q.includes("sale")) {
      reportId = "pos.daily_sales";
      reportName = "Daily POS Sales";
    }

    return {
      reportId,
      reportName,
      timeRange,
      interpretation: `Matched "${reportName}" based on keywords`,
      confidence: 0.6,
    };
  }

  /**
   * Generate a narrative summary of report results
   */
  async generateNarrative(
    campgroundId: string,
    reportName: string,
    data: {
      rows: Record<string, unknown>[];
      metrics: string[];
      dimensions: string[];
      timeRange?: { start?: string; end?: string; preset?: string };
    },
    userId?: string,
  ): Promise<ReportNarrative> {
    await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.analytics);

    // Summarize data for context
    const rowCount = data.rows.length;
    const sampleRows = data.rows.slice(0, 10);

    // Calculate basic stats for numeric columns
    const stats: Record<string, { min: number; max: number; sum: number; avg: number }> = {};
    for (const metric of data.metrics) {
      const values = data.rows
        .map((r) => r[metric])
        .filter((v): v is number => typeof v === "number");

      if (values.length > 0) {
        stats[metric] = {
          min: Math.min(...values),
          max: Math.max(...values),
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
        };
      }
    }

    const systemPrompt = `You are a business analyst for a campground management system.
Generate a brief narrative summary of report results that a campground owner would find useful.

Focus on:
1. Key takeaways (what's the main story?)
2. Notable trends or patterns
3. Actionable recommendations if appropriate

Keep it concise - 2-3 sentences for summary, 2-4 bullet points for findings.
Use specific numbers from the data.`;

    const userPrompt = `Report: ${reportName}
Time Period: ${data.timeRange?.preset || `${data.timeRange?.start} to ${data.timeRange?.end}`}
Total Rows: ${rowCount}
Dimensions: ${data.dimensions.join(", ")}
Metrics: ${data.metrics.join(", ")}

Statistics:
${JSON.stringify(stats, null, 2)}

Sample Data (first ${sampleRows.length} rows):
${JSON.stringify(sampleRows, null, 2)}

Generate a narrative summary.`;

    try {
      const response = await this.provider.getCompletion({
        campgroundId,
        featureType: AiFeatureType.analytics,
        systemPrompt,
        userPrompt,
        userId,
        maxTokens: 600,
        temperature: 0.4,
      });

      return this.parseNarrative(response.content);
    } catch (error) {
      this.logger.warn(`Narrative generation failed: ${error}`);
      return this.fallbackNarrative(reportName, stats);
    }
  }

  /**
   * Parse AI response into structured narrative
   */
  private parseNarrative(content: string): ReportNarrative {
    const lines = content.split("\n").filter((l) => l.trim());

    // Look for structured sections
    const summary =
      lines.find((l) => !l.startsWith("-") && !l.startsWith("*") && l.length > 20) ||
      lines[0] ||
      "Report generated successfully.";

    const findings: string[] = [];
    const trends: string[] = [];
    const recommendations: string[] = [];

    let currentSection = "findings";

    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s*/, "").trim();
      if (!cleaned || cleaned === summary) continue;

      if (line.toLowerCase().includes("trend")) {
        currentSection = "trends";
      } else if (
        line.toLowerCase().includes("recommend") ||
        line.toLowerCase().includes("action") ||
        line.toLowerCase().includes("suggest")
      ) {
        currentSection = "recommendations";
      }

      if (line.startsWith("-") || line.startsWith("*")) {
        switch (currentSection) {
          case "trends":
            trends.push(cleaned);
            break;
          case "recommendations":
            recommendations.push(cleaned);
            break;
          default:
            findings.push(cleaned);
        }
      }
    }

    // If no bullet points found, split the content
    if (findings.length === 0 && lines.length > 1) {
      findings.push(...lines.slice(1, 4).map((l) => l.replace(/^[-*]\s*/, "").trim()));
    }

    return {
      summary,
      keyFindings: findings.slice(0, 5),
      trends: trends.length > 0 ? trends.slice(0, 3) : undefined,
      recommendations: recommendations.length > 0 ? recommendations.slice(0, 3) : undefined,
    };
  }

  /**
   * Fallback narrative when AI fails
   */
  private fallbackNarrative(
    reportName: string,
    stats: Record<string, { min: number; max: number; sum: number; avg: number }>,
  ): ReportNarrative {
    const findings: string[] = [];

    for (const [metric, s] of Object.entries(stats)) {
      const label = metric.replace(/_/g, " ");
      if (metric.includes("amount") || metric.includes("revenue") || metric.includes("cents")) {
        findings.push(`Total ${label}: $${(s.sum / 100).toLocaleString()}`);
      } else {
        findings.push(`${label}: ${s.sum.toLocaleString()} total, ${s.avg.toFixed(1)} average`);
      }
    }

    return {
      summary: `${reportName} data processed successfully.`,
      keyFindings: findings.length > 0 ? findings : ["Report completed with no notable findings."],
    };
  }

  /**
   * Get suggested queries based on category
   */
  getSuggestedQueries(category?: string): string[] {
    const suggestions: Record<string, string[]> = {
      bookings: [
        "Show me daily bookings for the last 30 days",
        "What's our revenue by booking source this month?",
        "Which promo codes performed best this quarter?",
        "Show cancellation trends over the past year",
      ],
      inventory: [
        "What's our current occupancy breakdown?",
        "Show arrival load for next week",
        "Which site types are most popular?",
      ],
      payments: [
        "Show me daily cashflow this month",
        "What payment methods do guests prefer?",
        "Show refund trends for the quarter",
      ],
      operations: [
        "How are we doing on task SLAs?",
        "Show support ticket volume by day",
        "Which task types take longest to complete?",
      ],
      pos: [
        "Show POS sales by category this week",
        "What are our best-selling products?",
        "Show sales trends by hour of day",
      ],
      general: [
        "How did we do last month?",
        "Show me a revenue summary for this year",
        "Compare bookings week over week",
        "What's trending with our guests?",
      ],
    };

    if (category && suggestions[category]) {
      return suggestions[category];
    }

    return suggestions.general;
  }

  /**
   * Get available report categories for the AI
   */
  getReportCategories(): { id: string; name: string; description: string }[] {
    return [
      { id: "bookings", name: "Bookings", description: "Reservation and booking analytics" },
      { id: "inventory", name: "Inventory", description: "Site availability and occupancy" },
      { id: "payments", name: "Payments", description: "Financial transactions and cashflow" },
      { id: "operations", name: "Operations", description: "Tasks, support, and daily operations" },
      { id: "marketing", name: "Marketing", description: "Campaigns and channel performance" },
      { id: "pos", name: "Point of Sale", description: "Store and retail analytics" },
    ];
  }
}
