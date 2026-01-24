"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sparkles,
  Shield,
  Clock,
  Activity,
  Settings,
  ChevronRight,
  Info,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteClass {
  id: string;
  name: string;
  siteCount: number;
}

interface OptimizationSettings {
  enabled: boolean;
  previewMode: boolean;
  daysBeforeArrival: number;
  selectedSiteClasses: string[];
  optimizeForRevenue: boolean;
  optimizeForOccupancy: boolean;
  fillGaps: boolean;
  respectGuestPreferences: boolean;
  respectAccessibility: boolean;
}

interface OptimizationCardProps {
  settings: OptimizationSettings;
  siteClasses: SiteClass[];
  lastRunAt?: Date;
  onSettingsChange: (settings: Partial<OptimizationSettings>) => void;
  onViewLog: () => void;
  className?: string;
}

export function OptimizationCard({
  settings,
  siteClasses,
  lastRunAt,
  onSettingsChange,
  onViewLog,
  className,
}: OptimizationCardProps) {
  const [isExpanded, setIsExpanded] = useState(settings.enabled);

  const handleToggleEnabled = (enabled: boolean) => {
    onSettingsChange({ enabled });
    setIsExpanded(enabled);
  };

  const toggleSiteClass = (siteClassId: string) => {
    const current = settings.selectedSiteClasses;
    const updated = current.includes(siteClassId)
      ? current.filter((id) => id !== siteClassId)
      : [...current, siteClassId];
    onSettingsChange({ selectedSiteClasses: updated });
  };

  return (
    <Card
      className={cn(
        "transition-all duration-300",
        settings.enabled ? "border-status-info-border bg-status-info-bg" : "border-dashed",
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn("p-2 rounded-lg", settings.enabled ? "bg-status-info-bg" : "bg-muted")}
            >
              <Sparkles
                className={cn(
                  "h-5 w-5",
                  settings.enabled ? "text-status-info" : "text-muted-foreground",
                )}
              />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Grid Optimization
                <Badge
                  variant="secondary"
                  className="text-xs bg-status-info-bg text-status-info-text"
                >
                  Smart
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Automatically optimize site assignments to maximize revenue
              </CardDescription>
            </div>
          </div>

          <Switch
            checked={settings.enabled}
            onCheckedChange={handleToggleEnabled}
            aria-describedby="optimization-description"
          />
        </div>
      </CardHeader>

      {(isExpanded || settings.enabled) && (
        <CardContent className="space-y-6 pt-0">
          {/* Trust-building message */}
          <Alert className="bg-status-info-bg border-status-info-border">
            <Shield className="h-4 w-4 text-status-info" />
            <AlertTitle className="text-foreground">You're always in control</AlertTitle>
            <AlertDescription className="text-status-info-text">
              Optimization respects guest preferences, accessibility requirements, and locked sites.
              Enable preview mode to review changes before they're applied.
            </AlertDescription>
          </Alert>

          {/* Preview Mode Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Preview Mode</p>
                <p className="text-sm text-muted-foreground">
                  See suggested changes without applying them
                </p>
              </div>
            </div>
            <Switch
              checked={settings.previewMode}
              onCheckedChange={(previewMode) => onSettingsChange({ previewMode })}
            />
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Configuration</h4>

            {/* Days Buffer */}
            <div className="space-y-2">
              <Label htmlFor="days-buffer">Stop optimizing reservations</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="days-buffer"
                  type="number"
                  min={0}
                  max={30}
                  value={settings.daysBeforeArrival}
                  onChange={(e) =>
                    onSettingsChange({ daysBeforeArrival: parseInt(e.target.value) || 0 })
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days before arrival</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Reservations within this window won't be moved
              </p>
            </div>

            {/* Site Classes */}
            <div className="space-y-2">
              <Label>Optimize these site types</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {siteClasses.map((sc) => {
                  const isSelected = settings.selectedSiteClasses.includes(sc.id);
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => toggleSiteClass(sc.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                        isSelected
                          ? "bg-status-info-bg border-status-info-border text-status-info-text"
                          : "bg-card border-border text-muted-foreground hover:border-border",
                      )}
                    >
                      {sc.name}
                      <span className="ml-1 text-xs opacity-70">({sc.siteCount})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optimization Goals */}
            <div className="space-y-3">
              <Label>Optimization goals</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={settings.optimizeForRevenue}
                    onChange={(e) => onSettingsChange({ optimizeForRevenue: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-action-primary focus:ring-action-primary/60"
                  />
                  <div>
                    <p className="font-medium text-foreground">Maximize revenue</p>
                    <p className="text-sm text-muted-foreground">
                      Move reservations to premium sites when possible
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={settings.fillGaps}
                    onChange={(e) => onSettingsChange({ fillGaps: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-action-primary focus:ring-action-primary/60"
                  />
                  <div>
                    <p className="font-medium text-foreground">Fill gaps</p>
                    <p className="text-sm text-muted-foreground">
                      Consolidate reservations to eliminate 1-night gaps
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Constraints */}
            <div className="space-y-3">
              <Label>Always respect (cannot be changed)</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                  <CheckCircle2 className="h-4 w-4 text-status-success" />
                  <span className="text-sm text-foreground">Accessibility requirements</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                  <CheckCircle2 className="h-4 w-4 text-status-success" />
                  <span className="text-sm text-foreground">Guest-locked sites</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                  <CheckCircle2 className="h-4 w-4 text-status-success" />
                  <span className="text-sm text-foreground">RV length requirements</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Log Link */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {lastRunAt ? (
                <span>
                  Last run: {lastRunAt.toLocaleDateString()} at {lastRunAt.toLocaleTimeString()}
                </span>
              ) : (
                <span>Never run</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewLog}
              className="text-action-primary hover:text-action-primary-hover hover:bg-action-primary/10"
            >
              <Activity className="h-4 w-4 mr-2" />
              View optimization log
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
