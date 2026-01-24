"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Clock,
  Repeat,
  CalendarDays,
  CalendarRange,
  Loader2,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { format, addDays, addWeeks } from "date-fns";

type PatternType = "none" | "daily" | "weekly" | "biweekly" | "monthly";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string;
  activityName: string;
  activityDuration: number;
  onComplete: () => void;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PATTERN_OPTIONS: Array<{
  value: PatternType;
  label: string;
  icon: LucideIcon;
  description: string;
}> = [
  { value: "daily", label: "Daily", icon: CalendarDays, description: "Every day at the same time" },
  { value: "weekly", label: "Weekly", icon: Repeat, description: "Same days each week" },
  { value: "biweekly", label: "Bi-weekly", icon: CalendarRange, description: "Every other week" },
];

const QUICK_DURATIONS = [
  { label: "2 weeks", weeks: 2 },
  { label: "4 weeks", weeks: 4 },
  { label: "8 weeks", weeks: 8 },
  { label: "3 months", weeks: 12 },
];

export function SessionScheduleWizard({
  open,
  onOpenChange,
  activityId,
  activityName,
  activityDuration,
  onComplete,
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<"pattern" | "days" | "time" | "preview">("pattern");

  // Form state - initialize with empty strings to avoid hydration mismatch
  const [patternType, setPatternType] = useState<PatternType>("weekly");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri
  const [startTime, setStartTime] = useState("09:00");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [savePattern, setSavePattern] = useState(true);

  // Set initial dates on mount to avoid hydration mismatch
  useEffect(() => {
    if (!startDate) {
      setStartDate(format(new Date(), "yyyy-MM-dd"));
    }
    if (!endDate) {
      setEndDate(format(addWeeks(new Date(), 4), "yyyy-MM-dd"));
    }
  }, [startDate, endDate]);

  // Preview state
  const [preview, setPreview] = useState<{
    sessions: Array<{ startTime: string; endTime: string; dayOfWeek: string; isWeekend: boolean }>;
    totalCount: number;
    patternDescription: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Calculate end time based on activity duration
  const calculateEndTime = () => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + activityDuration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;
  };

  // Toggle day selection
  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  // Apply quick duration
  const applyQuickDuration = (weeks: number) => {
    setEndDate(format(addWeeks(new Date(startDate), weeks), "yyyy-MM-dd"));
  };

  // Fetch preview
  const fetchPreview = async () => {
    if (patternType === "none") return;
    if ((patternType === "weekly" || patternType === "biweekly") && selectedDays.length === 0) {
      toast({ title: "Select at least one day", variant: "destructive" });
      return;
    }

    setPreviewLoading(true);
    try {
      const result = await apiClient.previewGeneratedSessions(activityId, {
        patternType,
        daysOfWeek: selectedDays,
        startTime,
        startDate,
        endDate,
      });
      setPreview(result);
      setStep("preview");
    } catch (err) {
      toast({ title: "Failed to generate preview", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Generate sessions mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiClient.generateSessions(activityId, {
        patternType,
        daysOfWeek: selectedDays,
        startTime,
        startDate,
        endDate,
        savePattern,
      });
    },
    onSuccess: (result) => {
      toast({
        title: `${result.created} sessions created!`,
        description: "Your activity schedule is ready.",
      });
      onComplete();
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create sessions", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setStep("pattern");
    setPatternType("weekly");
    setSelectedDays([1, 3, 5]);
    setStartTime("09:00");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate(format(addWeeks(new Date(), 4), "yyyy-MM-dd"));
    setSavePattern(true);
    setPreview(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const getStepNumber = () => {
    switch (step) {
      case "pattern":
        return 1;
      case "days":
        return 2;
      case "time":
        return 3;
      case "preview":
        return 4;
    }
  };

  const canProceed = () => {
    switch (step) {
      case "pattern":
        return patternType !== "none";
      case "days":
        return patternType === "daily" || selectedDays.length > 0;
      case "time":
        return startTime && startDate && endDate;
      case "preview":
        return preview && preview.totalCount > 0;
    }
  };

  const handleNext = () => {
    switch (step) {
      case "pattern":
        if (patternType === "daily") {
          setStep("time");
        } else {
          setStep("days");
        }
        break;
      case "days":
        setStep("time");
        break;
      case "time":
        fetchPreview();
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case "days":
        setStep("pattern");
        break;
      case "time":
        if (patternType === "daily") {
          setStep("pattern");
        } else {
          setStep("days");
        }
        break;
      case "preview":
        setStep("time");
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-600" />
            Schedule Sessions for {activityName}
          </DialogTitle>
          <DialogDescription>
            Set up a recurring schedule to automatically create sessions
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4].map((num) => (
            <div
              key={num}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                getStepNumber() >= num
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {getStepNumber() > num ? <CheckCircle2 className="h-4 w-4" /> : num}
            </div>
          ))}
        </div>

        {/* Step 1: Pattern Selection */}
        {step === "pattern" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">How often should this activity occur?</p>
            <div className="grid gap-3">
              {PATTERN_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setPatternType(option.value)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all",
                      patternType === option.value
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-border hover:border-emerald-300",
                    )}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-full",
                        patternType === option.value
                          ? "bg-emerald-600 text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    {patternType === option.value && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Day Selection (for weekly/biweekly) */}
        {step === "days" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Which days should this activity occur?</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {DAY_NAMES.map((day, index) => (
                <button
                  key={day}
                  onClick={() => toggleDay(index)}
                  className={cn(
                    "w-14 h-14 rounded-full font-medium transition-all",
                    selectedDays.includes(index)
                      ? "bg-emerald-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground",
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDays.length > 0 && (
              <p className="text-center text-sm text-emerald-600 font-medium">
                {selectedDays.map((d) => FULL_DAY_NAMES[d]).join(", ")}
              </p>
            )}
            {selectedDays.length === 0 && (
              <p className="text-center text-sm text-amber-600 flex items-center justify-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Select at least one day
              </p>
            )}
          </div>
        )}

        {/* Step 3: Time & Duration */}
        {step === "time" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={calculateEndTime()} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  Based on {activityDuration} min duration
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Date Range</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                    From
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date" className="text-xs text-muted-foreground">
                    Until
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick Duration</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_DURATIONS.map((duration) => (
                  <Button
                    key={duration.weeks}
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickDuration(duration.weeks)}
                  >
                    {duration.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="save-pattern">Save as recurring pattern</Label>
                <p className="text-xs text-muted-foreground">
                  Easily extend this schedule in the future
                </p>
              </div>
              <Switch id="save-pattern" checked={savePattern} onCheckedChange={setSavePattern} />
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="bg-emerald-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-emerald-700">{preview.totalCount}</p>
              <p className="text-sm text-emerald-600">sessions will be created</p>
              <p className="text-xs text-muted-foreground mt-1">{preview.patternDescription}</p>
            </div>

            <div className="max-h-48 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Day</th>
                    <th className="text-left p-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sessions.slice(0, 20).map((session, i) => (
                    <tr key={i} className={cn("border-t", session.isWeekend && "bg-amber-50")}>
                      <td className="p-2">{format(new Date(session.startTime), "MMM d, yyyy")}</td>
                      <td className="p-2">
                        <Badge variant={session.isWeekend ? "secondary" : "outline"}>
                          {session.dayOfWeek}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {format(new Date(session.startTime), "h:mm a")} -{" "}
                        {format(new Date(session.endTime), "h:mm a")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.totalCount > 20 && (
                <p className="text-center text-sm text-muted-foreground p-2 bg-muted">
                  +{preview.totalCount - 20} more sessions
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          {step !== "pattern" ? (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          ) : (
            <div />
          )}

          {step === "preview" ? (
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create {preview?.totalCount} Sessions
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || previewLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {previewLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
