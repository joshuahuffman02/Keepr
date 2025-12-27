"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Palette, Calendar, Info, Loader2, Trash2, X } from "lucide-react";
import { RateGroupRow, type RateGroup } from "@/components/settings/rate-groups";
import { ColorPicker, PRESET_COLORS } from "@/components/settings/rate-groups";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiClient } from "@/lib/api-client";

type SeasonalRate = {
  id: string;
  campgroundId: string;
  siteClassId: string | null;
  name: string;
  rateType: "nightly" | "weekly" | "monthly" | "seasonal";
  amount: number;
  minNights: number | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  color?: string;
};

// Helper to calculate days between dates
function calculateDays(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

// Convert SeasonalRate to RateGroup format for display
function seasonalRateToRateGroup(rate: SeasonalRate): RateGroup {
  const days = calculateDays(rate.startDate, rate.endDate);
  return {
    id: rate.id,
    name: rate.name,
    color: rate.color || PRESET_COLORS[0],
    dateRanges: rate.startDate && rate.endDate
      ? [{ startDate: rate.startDate.split("T")[0], endDate: rate.endDate.split("T")[0] }]
      : [],
    totalDays: days,
    isActive: rate.isActive,
  };
}

export default function RateGroupsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [seasonalRates, setSeasonalRates] = useState<SeasonalRate[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<SeasonalRate | null>(null);

  // New group form state
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(PRESET_COLORS[0]);
  const [newGroupRateType, setNewGroupRateType] = useState<"nightly" | "weekly" | "monthly" | "seasonal">("nightly");
  const [newGroupAmount, setNewGroupAmount] = useState("");

  // Date editing form state
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    apiClient.getSeasonalRates(id)
      .then((rates) => {
        // Assign colors to rates (API doesn't return color, so we assign from preset)
        const ratesWithColors = rates.map((rate, index) => ({
          ...rate,
          color: PRESET_COLORS[index % PRESET_COLORS.length],
        }));
        setSeasonalRates(ratesWithColors);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load seasonal rates:", err);
        setLoading(false);
      });
  }, []);

  const handleAddGroup = useCallback(async () => {
    if (!newGroupName.trim() || !campgroundId) return;

    setSaving(true);
    try {
      await apiClient.createSeasonalRate({
        campgroundId,
        name: newGroupName.trim(),
        rateType: newGroupRateType,
        amount: Math.round(parseFloat(newGroupAmount || "0") * 100),
        isActive: true,
      });

      // Reload rates
      const rates = await apiClient.getSeasonalRates(campgroundId);
      const ratesWithColors = rates.map((rate, index) => ({
        ...rate,
        color: rate.color || PRESET_COLORS[index % PRESET_COLORS.length],
      }));
      setSeasonalRates(ratesWithColors);

      setNewGroupName("");
      setNewGroupColor(PRESET_COLORS[0]);
      setNewGroupAmount("");
      setIsAddDialogOpen(false);
    } catch (err) {
      console.error("Failed to create rate group:", err);
      alert("Failed to create rate group. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [newGroupName, newGroupColor, newGroupRateType, newGroupAmount, campgroundId]);

  const handleUpdateGroup = useCallback(async (id: string, updates: Partial<RateGroup>) => {
    if (!campgroundId) return;

    setSaving(true);
    try {
      await apiClient.updateSeasonalRate(id, {
        name: updates.name,
        isActive: updates.isActive,
      });

      // Reload rates
      const rates = await apiClient.getSeasonalRates(campgroundId);
      const ratesWithColors = rates.map((rate, index) => ({
        ...rate,
        color: rate.color || PRESET_COLORS[index % PRESET_COLORS.length],
      }));
      setSeasonalRates(ratesWithColors);
    } catch (err) {
      console.error("Failed to update rate group:", err);
    } finally {
      setSaving(false);
    }
  }, [campgroundId]);

  const handleDeleteGroup = useCallback(async (id: string) => {
    if (!campgroundId) return;
    if (!confirm("Are you sure you want to delete this rate group?")) return;

    setSaving(true);
    try {
      await apiClient.deleteSeasonalRate(id);

      // Reload rates
      const rates = await apiClient.getSeasonalRates(campgroundId);
      const ratesWithColors = rates.map((rate, index) => ({
        ...rate,
        color: rate.color || PRESET_COLORS[index % PRESET_COLORS.length],
      }));
      setSeasonalRates(ratesWithColors);
    } catch (err) {
      console.error("Failed to delete rate group:", err);
    } finally {
      setSaving(false);
    }
  }, [campgroundId]);

  const handleDuplicateGroup = useCallback(async (id: string) => {
    if (!campgroundId) return;

    const rate = seasonalRates.find((r) => r.id === id);
    if (!rate) return;

    setSaving(true);
    try {
      await apiClient.createSeasonalRate({
        campgroundId,
        name: `${rate.name} (Copy)`,
        rateType: rate.rateType,
        amount: rate.amount,
        minNights: rate.minNights ?? undefined,
        startDate: rate.startDate ?? undefined,
        endDate: rate.endDate ?? undefined,
        isActive: rate.isActive,
      });

      // Reload rates
      const rates = await apiClient.getSeasonalRates(campgroundId);
      const ratesWithColors = rates.map((r, index) => ({
        ...r,
        color: r.color || PRESET_COLORS[index % PRESET_COLORS.length],
      }));
      setSeasonalRates(ratesWithColors);
    } catch (err) {
      console.error("Failed to duplicate rate group:", err);
    } finally {
      setSaving(false);
    }
  }, [campgroundId, seasonalRates]);

  const handleEditDates = useCallback((id: string) => {
    const rate = seasonalRates.find((r) => r.id === id);
    if (!rate) return;

    setEditingRate(rate);
    setEditStartDate(rate.startDate?.split("T")[0] || "");
    setEditEndDate(rate.endDate?.split("T")[0] || "");
    setIsDateDialogOpen(true);
  }, [seasonalRates]);

  const handleSaveDates = useCallback(async () => {
    if (!editingRate || !campgroundId) return;

    setSaving(true);
    try {
      await apiClient.updateSeasonalRate(editingRate.id, {
        startDate: editStartDate || undefined,
        endDate: editEndDate || undefined,
      });

      // Reload rates
      const rates = await apiClient.getSeasonalRates(campgroundId);
      const ratesWithColors = rates.map((rate, index) => ({
        ...rate,
        color: rate.color || PRESET_COLORS[index % PRESET_COLORS.length],
      }));
      setSeasonalRates(ratesWithColors);

      setIsDateDialogOpen(false);
      setEditingRate(null);
    } catch (err) {
      console.error("Failed to update dates:", err);
      alert("Failed to update dates. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [editingRate, editStartDate, editEndDate, campgroundId]);

  // Convert to RateGroup format for display
  const rateGroups = seasonalRates.map(seasonalRateToRateGroup);
  const activeGroups = rateGroups.filter((g) => g.isActive);
  const inactiveGroups = rateGroups.filter((g) => !g.isActive);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rate Groups</h2>
          <p className="text-slate-500 mt-1">
            Define rate periods with colors for your calendar
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!campgroundId) {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rate Groups</h2>
          <p className="text-slate-500 mt-1">
            Define rate periods with colors for your calendar
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <Info className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-slate-600">Please select a campground first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rate Groups</h2>
          <p className="text-slate-500 mt-1">
            Define rate periods with colors for your calendar
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} disabled={saving}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rate Group
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Rate groups help you organize your pricing calendar. Each group gets a color
          that appears on the reservation calendar, making it easy to see which rates
          apply to which dates.
        </AlertDescription>
      </Alert>

      {/* Calendar Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-slate-500" />
            Calendar Preview
          </CardTitle>
          <CardDescription>
            How your rate groups will appear on the calendar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {activeGroups.map((group) => (
              <div
                key={group.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: group.color }}
              >
                <span>{group.name}</span>
                <span className="opacity-75">({group.totalDays} days)</span>
              </div>
            ))}
            {activeGroups.length === 0 && (
              <p className="text-slate-500 text-sm">
                No active rate groups. Add one to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Rate Groups */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
          <Palette className="h-4 w-4 text-slate-500" />
          Active Rate Groups ({activeGroups.length})
        </h3>
        {activeGroups.length > 0 ? (
          <div className="space-y-2">
            {activeGroups.map((group) => (
              <RateGroupRow
                key={group.id}
                group={group}
                onUpdate={handleUpdateGroup}
                onDelete={handleDeleteGroup}
                onDuplicate={handleDuplicateGroup}
                onEditDates={handleEditDates}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Palette className="h-10 w-10 mx-auto text-slate-400" />
              <h4 className="mt-3 font-medium text-slate-900">No active rate groups</h4>
              <p className="text-sm text-slate-500 mt-1">
                Create rate groups to organize your seasonal pricing
              </p>
              <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add your first rate group
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Inactive Rate Groups */}
      {inactiveGroups.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-500">
            Inactive ({inactiveGroups.length})
          </h3>
          <div className="space-y-2">
            {inactiveGroups.map((group) => (
              <RateGroupRow
                key={group.id}
                group={group}
                onUpdate={handleUpdateGroup}
                onDelete={handleDeleteGroup}
                onDuplicate={handleDuplicateGroup}
                onEditDates={handleEditDates}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Rate Group Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Rate Group</DialogTitle>
            <DialogDescription>
              Create a new rate group for your pricing calendar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                placeholder="e.g., Peak Summer, Holiday Weekend"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Rate Type</Label>
              <Select value={newGroupRateType} onValueChange={(v: any) => setNewGroupRateType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nightly">Nightly Rate</SelectItem>
                  <SelectItem value="weekly">Weekly Rate</SelectItem>
                  <SelectItem value="monthly">Monthly Rate</SelectItem>
                  <SelectItem value="seasonal">Seasonal Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-amount">Base Rate ($)</Label>
              <Input
                id="group-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 45.00"
                value={newGroupAmount}
                onChange={(e) => setNewGroupAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <ColorPicker
                  value={newGroupColor}
                  onChange={setNewGroupColor}
                  className="h-10 w-10"
                />
                <div
                  className="flex-1 h-10 rounded-lg flex items-center justify-center text-white font-medium text-sm"
                  style={{ backgroundColor: newGroupColor }}
                >
                  {newGroupName || "Preview"}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGroup} disabled={!newGroupName.trim() || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Add Rate Group"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dates Dialog */}
      <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Date Ranges</DialogTitle>
            <DialogDescription>
              Define when "{editingRate?.name}" applies
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>

            {editStartDate && editEndDate && (
              <div className="p-4 rounded-lg bg-slate-50 border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Duration:</span>
                  <span className="font-semibold text-slate-900">
                    {calculateDays(editStartDate, editEndDate)} days
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-slate-600">Period:</span>
                  <span className="text-sm text-slate-700">
                    {new Date(editStartDate).toLocaleDateString()} - {new Date(editEndDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}

            <Alert className="bg-amber-50 border-amber-200">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                For multiple date ranges (e.g., holiday weekends), create separate rate groups
                or use the advanced Pricing Rules page.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDates} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Dates"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
