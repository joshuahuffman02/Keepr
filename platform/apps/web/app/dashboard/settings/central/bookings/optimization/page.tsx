"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Activity,
  ArrowRight,
  Calendar,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Info,
} from "lucide-react";
import { OptimizationCard } from "@/components/settings/optimization";
import { cn } from "@/lib/utils";

// Mock site classes
const siteClasses = [
  { id: "1", name: "Full Hookup", siteCount: 25 },
  { id: "2", name: "Partial Hookup", siteCount: 15 },
  { id: "3", name: "Tent Sites", siteCount: 20 },
  { id: "4", name: "Cabins", siteCount: 8 },
];

// Mock optimization log
const optimizationLog = [
  {
    id: "1",
    timestamp: new Date("2025-12-25T02:00:00"),
    reservationsOptimized: 12,
    revenueGain: 245,
    gapsFilled: 3,
    moves: [
      {
        reservationId: "R-1234",
        guestName: "Smith Family",
        fromSite: "A-12",
        toSite: "A-08",
        reason: "Consolidate to fill gap",
        arrivalDate: "2025-12-28",
      },
      {
        reservationId: "R-1235",
        guestName: "Johnson",
        fromSite: "B-05",
        toSite: "A-15",
        reason: "Upgrade to premium site",
        arrivalDate: "2025-12-29",
      },
    ],
  },
  {
    id: "2",
    timestamp: new Date("2025-12-24T02:00:00"),
    reservationsOptimized: 8,
    revenueGain: 180,
    gapsFilled: 2,
    moves: [],
  },
  {
    id: "3",
    timestamp: new Date("2025-12-23T02:00:00"),
    reservationsOptimized: 15,
    revenueGain: 320,
    gapsFilled: 5,
    moves: [],
  },
];

export default function OptimizationPage() {
  const [settings, setSettings] = useState({
    enabled: false,
    previewMode: true,
    daysBeforeArrival: 3,
    selectedSiteClasses: ["1", "2"],
    optimizeForRevenue: true,
    optimizeForOccupancy: false,
    fillGaps: true,
    respectGuestPreferences: true,
    respectAccessibility: true,
  });

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedLogEntry, setSelectedLogEntry] = useState<typeof optimizationLog[0] | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const handleSettingsChange = useCallback((updates: Partial<typeof settings>) => {
    setSettings((prev) => {
      const newSettings = { ...prev, ...updates };

      // Show celebration on first enable
      if (updates.enabled && !prev.enabled) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }

      return newSettings;
    });
  }, []);

  const handleViewLog = useCallback(() => {
    setIsLogOpen(true);
  }, []);

  const viewLogDetails = (entry: typeof optimizationLog[0]) => {
    setSelectedLogEntry(entry);
  };

  // Calculate stats from log
  const totalRevenueGain = optimizationLog.reduce((sum, log) => sum + log.revenueGain, 0);
  const totalMoves = optimizationLog.reduce((sum, log) => sum + log.reservationsOptimized, 0);
  const totalGapsFilled = optimizationLog.reduce((sum, log) => sum + log.gapsFilled, 0);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Grid Optimization</h2>
        <p className="text-slate-500 mt-1">
          Automatically optimize site assignments to maximize revenue and occupancy
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Grid optimization runs nightly at 2 AM. It analyzes upcoming reservations
          and moves them to better sites when possible, filling gaps and maximizing revenue
          while respecting all guest preferences and requirements.
        </AlertDescription>
      </Alert>

      {/* Main Optimization Card */}
      <OptimizationCard
        settings={settings}
        siteClasses={siteClasses}
        lastRunAt={optimizationLog[0]?.timestamp}
        onSettingsChange={handleSettingsChange}
        onViewLog={handleViewLog}
      />

      {/* Stats Cards (only show when enabled) */}
      {settings.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-status-success/15">
                  <TrendingUp className="h-5 w-5 text-status-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900">
                    ${totalRevenueGain}
                  </p>
                  <p className="text-sm text-green-700">Revenue gained (30 days)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Activity className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalMoves}</p>
                  <p className="text-sm text-slate-500">Reservations optimized</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalGapsFilled}</p>
                  <p className="text-sm text-slate-500">Gaps filled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Celebration Modal */}
      {showCelebration && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 mb-4">
              <Sparkles className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Optimization Enabled!</h3>
            <p className="text-slate-500 mt-2">
              Your first optimization will run tonight at 2 AM
            </p>
          </div>
        </div>
      )}

      {/* Optimization Log Dialog */}
      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Optimization Log
            </DialogTitle>
            <DialogDescription>
              Recent optimization runs and their results
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            {selectedLogEntry ? (
              // Log Entry Detail View
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLogEntry(null)}
                  className="mb-2"
                >
                  ← Back to log
                </Button>

                <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50">
                  <div>
                    <p className="text-sm text-slate-500">Run date</p>
                    <p className="font-medium">
                      {selectedLogEntry.timestamp.toLocaleDateString()} at{" "}
                      {selectedLogEntry.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div>
                    <p className="text-sm text-slate-500">Optimized</p>
                    <p className="font-medium">{selectedLogEntry.reservationsOptimized} reservations</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div>
                    <p className="text-sm text-slate-500">Revenue gain</p>
                    <p className="font-medium text-emerald-600">+${selectedLogEntry.revenueGain}</p>
                  </div>
                </div>

                <h4 className="font-medium text-slate-900">Moves made</h4>

                {selectedLogEntry.moves.length > 0 ? (
                  <div className="space-y-2">
                    {selectedLogEntry.moves.map((move, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-4 rounded-lg border bg-white"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="font-medium">{move.guestName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {move.reservationId}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-600">{move.fromSite}</span>
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-purple-600">{move.toSite}</span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{move.reason}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Calendar className="h-4 w-4" />
                            {move.arrivalDate}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No detailed move data available for this run.</p>
                )}
              </div>
            ) : (
              // Log List View
              <div className="space-y-2">
                {optimizationLog.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => viewLogDetails(entry)}
                    className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-purple-100">
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {entry.timestamp.toLocaleDateString()}
                        </p>
                        <p className="text-sm text-slate-500">
                          {entry.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-medium text-slate-900">
                          {entry.reservationsOptimized} moves
                        </p>
                        <p className="text-sm text-slate-500">
                          {entry.gapsFilled} gaps filled
                        </p>
                      </div>
                      <Badge className="bg-status-success/15 text-status-success">
                        +${entry.revenueGain}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
