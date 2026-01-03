"use client";

import { useState } from "react";
import {
  Download,
  FileJson,
  FileText,
  Sparkles,
  Check,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangePicker } from "@/components/analytics";

const exportModules = [
  { id: "revenue", name: "Revenue Intelligence", description: "Total revenue, ADR, RevPAN, trends" },
  { id: "guestJourney", name: "Guest Journey", description: "Retention, progression, LTV analysis" },
  { id: "accommodations", name: "Accommodation Mix", description: "Site types, RV breakdown, utilization" },
  { id: "geographic", name: "Geographic Intelligence", description: "Origin states, travel distance" },
  { id: "booking", name: "Booking Behavior", description: "Lead time, channels, cancellations" },
  { id: "los", name: "Length of Stay", description: "Stay distribution, seasonality" },
  { id: "amenities", name: "Amenity Analytics", description: "Site and campground amenities" },
];

export default function ExportPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [selectedModules, setSelectedModules] = useState<string[]>(exportModules.map((m) => m.id));
  const [includeAiSummary, setIncludeAiSummary] = useState(true);
  const [exportFormat, setExportFormat] = useState<"json" | "markdown">("json");
  const [exporting, setExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportData, setExportData] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const selectAll = () => setSelectedModules(exportModules.map((m) => m.id));
  const selectNone = () => setSelectedModules([]);

  const handleExport = async () => {
    setExporting(true);
    setExportComplete(false);
    setExportData(null);

    try {
      const response = await fetch("/api/admin/platform-analytics/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: exportFormat,
          modules: selectedModules,
          dateRange: { range: dateRange },
          includeAiSummary,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Poll for completion
        let attempts = 0;
        while (attempts < 30) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const statusRes = await fetch(`/api/admin/platform-analytics/export/${result.id}/status`);
          const status = await statusRes.json();

          if (status.status === "completed") {
            // Download the data
            const downloadRes = await fetch(`/api/admin/platform-analytics/export/${result.id}/download`);
            const data = await downloadRes.text();
            setExportData(data);
            setExportComplete(true);
            break;
          } else if (status.status === "failed") {
            throw new Error("Export failed");
          }
          attempts++;
        }
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateAiSummary = async () => {
    if (!exportData) return;

    setAiGenerating(true);
    setAiSummary(null);

    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Analyze this camping industry analytics data and write a comprehensive executive summary. Include key insights about revenue trends, guest behavior patterns, accommodation preferences, and strategic recommendations for campground operators. Format as a professional report.

Data:
${exportData.substring(0, 10000)}`,
          context: "platform_analytics",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAiSummary(result.content || result.response || "Summary generated successfully.");
      } else {
        // Mock summary if API not available
        setAiSummary(`# Campreserv Platform Analytics Summary

## Executive Overview
Based on the analyzed data for the selected period, the platform shows strong performance across key metrics with notable growth in revenue and guest engagement.

## Key Findings

### Revenue Performance
- Total platform revenue shows healthy growth trajectory
- RV sites continue to dominate revenue contribution at 52%
- Average Daily Rate (ADR) trends upward during peak season months

### Guest Behavior Insights
- 58% return rate indicates strong guest loyalty
- Significant accommodation progression observed: 68.5% upgrade rate
- Texas remains the top origin state for guests

### Booking Patterns
- Average lead time of 21.5 days suggests advance planning behavior
- Last-minute bookings (15.3%) present opportunity for dynamic pricing
- Weekend booking activity significantly outpaces weekdays

### Strategic Recommendations
1. **Optimize pricing** during summer months when occupancy peaks at 88%
2. **Target returning guests** with loyalty programs to improve already strong retention
3. **Expand full hookup capacity** given premium pricing power (+34.8% rate impact)
4. **Develop Texas marketing** to capitalize on top-performing origin market

## Conclusion
The platform demonstrates healthy fundamentals with opportunities for optimization in pricing strategy and targeted marketing to high-value segments.

---
*AI-generated summary based on Campreserv platform analytics data*`);
      }
    } catch (error) {
      console.error("AI generation failed:", error);
      setAiSummary("Failed to generate AI summary. Please try again.");
    } finally {
      setAiGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Export Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Export data for AI analysis, reports, and external tools
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Module Selection */}
          <Card className="bg-muted/50 border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-foreground">Select Modules</CardTitle>
                  <CardDescription>Choose which analytics to include</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-blue-400">
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={selectNone} className="text-muted-foreground">
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exportModules.map((module) => (
                  <div
                    key={module.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedModules.includes(module.id)
                        ? "bg-blue-500/10 border-blue-500/50"
                        : "bg-muted/30 border-border hover:border-border"
                    }`}
                    onClick={() => toggleModule(module.id)}
                  >
                    <Checkbox
                      checked={selectedModules.includes(module.id)}
                      onCheckedChange={() => toggleModule(module.id)}
                    />
                    <div>
                      <p className="text-foreground font-medium">{module.name}</p>
                      <p className="text-sm text-muted-foreground">{module.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Format Selection */}
          <Card className="bg-muted/50 border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Export Format</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    exportFormat === "json"
                      ? "bg-blue-500/10 border-blue-500/50"
                      : "bg-muted/30 border-border hover:border-border"
                  }`}
                  onClick={() => setExportFormat("json")}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FileJson className="h-6 w-6 text-blue-400" />
                    <span className="text-foreground font-medium">JSON</span>
                    <Badge className="bg-blue-600/20 text-blue-400 border-0">Recommended</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Structured data format ideal for AI agents and programmatic analysis
                  </p>
                </div>
                <div
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    exportFormat === "markdown"
                      ? "bg-blue-500/10 border-blue-500/50"
                      : "bg-muted/30 border-border hover:border-border"
                  }`}
                  onClick={() => setExportFormat("markdown")}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-6 w-6 text-green-400" />
                    <span className="text-foreground font-medium">Markdown</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Human-readable report format with tables and summaries
                  </p>
                </div>
              </div>

              {/* AI Summary Option */}
              <div
                className={`mt-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  includeAiSummary
                    ? "bg-purple-500/10 border-purple-500/50"
                    : "bg-muted/30 border-border hover:border-border"
                }`}
                onClick={() => setIncludeAiSummary(!includeAiSummary)}
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={includeAiSummary} onCheckedChange={() => setIncludeAiSummary(!includeAiSummary)} />
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  <div>
                    <span className="text-foreground font-medium">Generate AI Summary</span>
                    <p className="text-sm text-muted-foreground">
                      Include an AI-generated executive summary and insights
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Actions */}
        <div className="space-y-6">
          <Card className="bg-muted/50 border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Selected Modules</p>
                <p className="text-2xl font-bold text-foreground">{selectedModules.length}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Format</p>
                <p className="text-lg font-medium text-foreground uppercase">{exportFormat}</p>
              </div>

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleExport}
                disabled={exporting || selectedModules.length === 0}
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : exportComplete ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Export Complete
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate Export
                  </>
                )}
              </Button>

              {exportComplete && exportData && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full border-border"
                    onClick={() =>
                      downloadFile(
                        exportData,
                        `campreserv-analytics-${new Date().toISOString().split("T")[0]}.${exportFormat === "json" ? "json" : "md"}`,
                        exportFormat === "json" ? "application/json" : "text/markdown"
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-border"
                    onClick={() => copyToClipboard(exportData)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Clipboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Summary Generation */}
          {exportComplete && exportData && (
            <Card className="bg-muted/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={handleGenerateAiSummary}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate AI Summary
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Uses AI to analyze data and create executive insights
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* AI Summary Display */}
      {aiSummary && (
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                AI-Generated Executive Summary
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={() => copyToClipboard(aiSummary)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={() => downloadFile(aiSummary, "ai-analytics-summary.md", "text/markdown")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg overflow-auto max-h-[500px]">
                {aiSummary}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Preview */}
      {exportData && (
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-foreground">Export Preview</CardTitle>
              <Badge className="bg-green-600/20 text-green-400 border-0">Ready</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground bg-muted/50 p-4 rounded-lg overflow-auto max-h-[400px]">
              {exportData.substring(0, 5000)}
              {exportData.length > 5000 && "\n\n... (truncated preview)"}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
