"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Brain, Shield, Zap, BarChart3, TrendingUp, MessageSquare, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AiPartnerPanel } from "@/components/ai/AiPartnerPanel";

interface AiSettings {
    id: string;
    name: string;
    aiEnabled: boolean;
    aiReplyAssistEnabled: boolean;
    aiBookingAssistEnabled: boolean;
    aiAnalyticsEnabled: boolean;
    aiForecastingEnabled: boolean;
    aiAnonymizationLevel: string;
    aiProvider: string;
    aiApiKey: string | null;
    hasCustomApiKey: boolean;
    aiMonthlyBudgetCents: number | null;
    aiTotalTokensUsed: number;
}

interface UsageStats {
    period: { days: number; since: string };
    byFeature: { feature: string; interactions: number; tokensUsed: number; costCents: number; avgLatencyMs: number }[];
    totals: { interactions: number; tokensUsed: number; costCents: number };
}

export default function AiSettingsPage() {
    const params = useParams();
    const campgroundId = params.campgroundId as string;
    const queryClient = useQueryClient();

    const { data: campground } = useQuery({
        queryKey: ["campground", campgroundId],
        queryFn: () => apiClient.getCampground(campgroundId),
        enabled: !!campgroundId,
    });

    const { data: settings, isLoading, error } = useQuery({
        queryKey: ["ai-settings", campgroundId],
        queryFn: () => apiClient.getAiSettings(campgroundId),
        enabled: !!campgroundId,
        retry: false,
    });

    const { data: usage } = useQuery({
        queryKey: ["ai-usage", campgroundId],
        queryFn: () => apiClient.getAiUsage(campgroundId),
        enabled: !!campgroundId && !!settings?.aiEnabled,
    });

    const mutation = useMutation({
        mutationFn: (updates: Partial<AiSettings>) => apiClient.updateAiSettings(campgroundId, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ai-settings", campgroundId] });
        },
        onError: (err) => {
            console.error("Failed to update AI settings:", err);
        },
    });

    const handleToggle = (field: keyof AiSettings) => {
        if (!settings) return;
        mutation.mutate({ [field]: !settings[field] } as Partial<AiSettings>);
    };

    const handleAnonymizationChange = (level: string) => {
        mutation.mutate({ aiAnonymizationLevel: level } as Partial<AiSettings>);
    };

    if (isLoading) {
        return (
            <DashboardShell>
                <div className="p-8">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-muted rounded w-1/3" />
                        <div className="h-64 bg-muted rounded" />
                    </div>
                </div>
            </DashboardShell>
        );
    }

    if (error) {
        return (
            <DashboardShell>
                <div className="p-8">
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="py-6">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                                <div>
                                    <h3 className="font-semibold text-red-900">Unable to load AI settings</h3>
                                    <p className="text-sm text-red-700 mt-1">
                                        {(error as Error)?.message || "An error occurred. Please try again."}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-6">
                <Breadcrumbs
                    items={[
                        { label: "Campgrounds", href: "/campgrounds?all=true" },
                        { label: campground?.name || "Campground", href: `/campgrounds/${campgroundId}` },
                        { label: "AI Settings" }
                    ]}
                />

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Brain className="w-7 h-7 text-violet-600" />
                            AI Settings
                        </h1>
                        <p className="text-muted-foreground mt-1">Configure AI features for {campground?.name || "this campground"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">AI Features</span>
                        <Switch
                            checked={settings?.aiEnabled ?? false}
                            onCheckedChange={() => handleToggle("aiEnabled")}
                        />
                    </div>
                </div>

                {!settings?.aiEnabled && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="py-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <Zap className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-amber-900">Enable AI to unlock intelligent features</h3>
                                    <p className="text-sm text-amber-700 mt-1">
                                        AI helps your staff respond faster, provides booking assistance to guests, and surfaces insights from your data.
                                        All data is anonymized before AI processing.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {settings?.aiEnabled && (
                    <>
                        {/* Privacy Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Shield className="w-5 h-5 text-emerald-600" />
                                    Privacy & Security
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground">Anonymization Level</label>
                                    <p className="text-xs text-muted-foreground mb-2">Controls how much data is stripped before AI sees it</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { value: "strict", label: "Strict", desc: "Maximum privacy" },
                                            { value: "moderate", label: "Moderate", desc: "Better context" },
                                            { value: "minimal", label: "Minimal", desc: "Best accuracy" },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => handleAnonymizationChange(option.value)}
                                                className={`p-3 rounded-lg border text-left transition-all ${settings.aiAnonymizationLevel === option.value
                                                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                                                    : "border-border hover:border-border"
                                                    }`}
                                            >
                                                <div className="font-medium text-sm">{option.label}</div>
                                                <div className="text-xs text-muted-foreground">{option.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                                    <strong>AI powered by Keepr.</strong> We use OpenAI's GPT-4 to provide AI features.
                                    Your data is anonymized before processing and never used to train models.
                                </div>
                            </CardContent>
                        </Card>

                        {/* Features Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">AI Features</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <MessageSquare className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="font-medium">Reply Assist</div>
                                            <div className="text-sm text-muted-foreground">AI-generated reply suggestions for staff</div>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={settings.aiReplyAssistEnabled}
                                        onCheckedChange={() => handleToggle("aiReplyAssistEnabled")}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <div className="font-medium">Booking Assistant</div>
                                            <div className="text-sm text-muted-foreground">Help guests find the right site</div>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={settings.aiBookingAssistEnabled}
                                        onCheckedChange={() => handleToggle("aiBookingAssistEnabled")}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                                            <BarChart3 className="w-5 h-5 text-violet-600" />
                                        </div>
                                        <div>
                                            <div className="font-medium">AI Analytics</div>
                                            <div className="text-sm text-muted-foreground">Natural language queries and insights</div>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={settings.aiAnalyticsEnabled}
                                        onCheckedChange={() => handleToggle("aiAnalyticsEnabled")}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                            <TrendingUp className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <div className="font-medium">Demand Forecasting</div>
                                            <div className="text-sm text-muted-foreground">Predict occupancy and optimize pricing</div>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={settings.aiForecastingEnabled}
                                        onCheckedChange={() => handleToggle("aiForecastingEnabled")}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Usage Section */}
                        {usage && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Usage (Last 30 Days)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="p-4 rounded-lg bg-muted">
                                            <div className="text-2xl font-bold text-foreground">
                                                {usage.totals.interactions.toLocaleString()}
                                            </div>
                                            <div className="text-sm text-muted-foreground">Total Interactions</div>
                                        </div>
                                        <div className="p-4 rounded-lg bg-muted">
                                            <div className="text-2xl font-bold text-foreground">
                                                {(usage.totals.tokensUsed / 1000).toFixed(1)}K
                                            </div>
                                            <div className="text-sm text-muted-foreground">Tokens Used</div>
                                        </div>
                                        <div className="p-4 rounded-lg bg-muted">
                                            <div className="text-2xl font-bold text-foreground">
                                                ${((usage.totals.costCents || 0) / 100).toFixed(2)}
                                            </div>
                                            <div className="text-sm text-muted-foreground">Estimated Cost</div>
                                        </div>
                                    </div>

                                    {usage.byFeature.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-foreground">By Feature</div>
                                            {usage.byFeature.map((feat) => (
                                                <div key={feat.feature} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                                    <span className="text-sm text-muted-foreground capitalize">{feat.feature.replace(/_/g, " ")}</span>
                                                    <span className="text-sm font-medium">{feat.interactions} requests</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <AiPartnerPanel campgroundId={campgroundId} enabled={settings.aiReplyAssistEnabled} />
                    </>
                )}
            </div>
        </DashboardShell>
    );
}
