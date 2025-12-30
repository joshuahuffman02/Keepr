"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarDays, Printer, Check } from "lucide-react";

interface CalendarSettings {
  defaultDayCount: number;
  colorScheme: "status" | "source" | "siteType" | "custom";
  showWeekends: boolean;
  showBlackouts: boolean;
  showMaintenance: boolean;
  showOccupancy: boolean;
  startOfWeek: "sunday" | "monday";
  autoRefreshInterval: number; // seconds, 0 = off
  compactMode: boolean;
  showPricing: boolean;
  groupBySiteClass: boolean;
}

const DEFAULT_SETTINGS: CalendarSettings = {
  defaultDayCount: 14,
  colorScheme: "status",
  showWeekends: true,
  showBlackouts: true,
  showMaintenance: true,
  showOccupancy: true,
  startOfWeek: "sunday",
  autoRefreshInterval: 60,
  compactMode: false,
  showPricing: false,
  groupBySiteClass: false,
};

const COLOR_SCHEMES = [
  { value: "status", label: "By Status", desc: "Color by reservation status (confirmed, checked-in, etc.)" },
  { value: "source", label: "By Source", desc: "Color by booking channel (online, phone, OTA)" },
  { value: "siteType", label: "By Site Type", desc: "Color by site category (RV, tent, cabin)" },
  { value: "custom", label: "Custom", desc: "Define your own color rules" },
];

const DAY_COUNTS = [7, 14, 21, 28, 30, 60, 90];
const REFRESH_INTERVALS = [
  { value: 0, label: "Off" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
];

export default function CalendarSettingsPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);

    // Load settings from localStorage
    const savedSettings = localStorage.getItem("campreserv:calendarSettings");
    if (savedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      } catch {
        // ignore
      }
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem("campreserv:calendarSettings", JSON.stringify(settings));
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 300);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem("campreserv:calendarSettings");
  };

  return (
    <DashboardShell>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/calendar" className="text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to Calendar
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Calendar Settings</h1>
            <p className="text-slate-500 mt-1">Customize your calendar view and behavior</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-status-success text-white rounded-lg hover:bg-status-success/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : saved ? <span className="flex items-center gap-1"><Check className="h-4 w-4" /> Saved</span> : "Save Settings"}
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Display Settings */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Display Settings</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Default Day Range
                  </label>
                  <select
                    value={settings.defaultDayCount}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultDayCount: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    {DAY_COUNTS.map((n) => (
                      <option key={n} value={n}>
                        {n} days
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Week Starts On
                  </label>
                  <select
                    value={settings.startOfWeek}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        startOfWeek: e.target.value as "sunday" | "monday",
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="sunday">Sunday</option>
                    <option value="monday">Monday</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <ToggleOption
                  label="Highlight weekends"
                  checked={settings.showWeekends}
                  onChange={(v) => setSettings({ ...settings, showWeekends: v })}
                />
                <ToggleOption
                  label="Show blackouts"
                  checked={settings.showBlackouts}
                  onChange={(v) => setSettings({ ...settings, showBlackouts: v })}
                />
                <ToggleOption
                  label="Show maintenance"
                  checked={settings.showMaintenance}
                  onChange={(v) => setSettings({ ...settings, showMaintenance: v })}
                />
                <ToggleOption
                  label="Show occupancy bar"
                  checked={settings.showOccupancy}
                  onChange={(v) => setSettings({ ...settings, showOccupancy: v })}
                />
                <ToggleOption
                  label="Compact mode"
                  checked={settings.compactMode}
                  onChange={(v) => setSettings({ ...settings, compactMode: v })}
                />
                <ToggleOption
                  label="Show pricing"
                  checked={settings.showPricing}
                  onChange={(v) => setSettings({ ...settings, showPricing: v })}
                />
                <ToggleOption
                  label="Group by site class"
                  checked={settings.groupBySiteClass}
                  onChange={(v) => setSettings({ ...settings, groupBySiteClass: v })}
                />
              </div>
            </div>
          </section>

          {/* Color Scheme */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Color Scheme</h2>
            <div className="grid grid-cols-2 gap-3">
              {COLOR_SCHEMES.map((scheme) => (
                <button
                  key={scheme.value}
                  onClick={() =>
                    setSettings({ ...settings, colorScheme: scheme.value as CalendarSettings["colorScheme"] })
                  }
                  className={`p-4 rounded-xl border text-left transition-all ${settings.colorScheme === scheme.value
                    ? "border-status-success bg-status-success/15 ring-2 ring-status-success/30"
                    : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                  <div className="font-medium text-slate-900">{scheme.label}</div>
                  <div className="text-sm text-slate-500">{scheme.desc}</div>
                </button>
              ))}
            </div>

            {/* Color Legend */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Color Legend</h3>
              <div className="flex flex-wrap gap-3">
                {settings.colorScheme === "status" && (
                  <>
                    <ColorChip color="bg-emerald-500" label="Confirmed" />
                    <ColorChip color="bg-blue-500" label="Checked In" />
                    <ColorChip color="bg-amber-500" label="Pending" />
                    <ColorChip color="bg-slate-400" label="Cancelled" />
                    <ColorChip color="bg-purple-500" label="Checked Out" />
                  </>
                )}
                {settings.colorScheme === "source" && (
                  <>
                    <ColorChip color="bg-blue-500" label="Online" />
                    <ColorChip color="bg-emerald-500" label="Phone" />
                    <ColorChip color="bg-orange-500" label="OTA" />
                    <ColorChip color="bg-slate-500" label="Walk-in" />
                  </>
                )}
                {settings.colorScheme === "siteType" && (
                  <>
                    <ColorChip color="bg-amber-500" label="RV" />
                    <ColorChip color="bg-emerald-500" label="Tent" />
                    <ColorChip color="bg-blue-500" label="Cabin" />
                    <ColorChip color="bg-purple-500" label="Glamping" />
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Auto-Refresh */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Auto-Refresh</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Refresh Interval
              </label>
              <select
                value={settings.autoRefreshInterval}
                onChange={(e) =>
                  setSettings({ ...settings, autoRefreshInterval: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                {REFRESH_INTERVALS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-slate-500 mt-2">
                Calendar will automatically refresh to show new reservations and changes.
              </p>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Keyboard Shortcuts</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <ShortcutRow keys={["←", "→"]} desc="Navigate days" />
              <ShortcutRow keys={["T"]} desc="Jump to today" />
              <ShortcutRow keys={["N"]} desc="New reservation" />
              <ShortcutRow keys={["R"]} desc="Refresh" />
              <ShortcutRow keys={["/"]} desc="Search" />
              <ShortcutRow keys={["Esc"]} desc="Clear selection" />
              <ShortcutRow keys={["1-9"]} desc="Set day range" />
              <ShortcutRow keys={["?"]} desc="Show shortcuts" />
            </div>
          </section>

          {/* Export Options */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Export</h2>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Export current view as CSV
                  alert("Export functionality - would download CSV of current view");
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Export CSV</div>
              </button>
              <button
                onClick={() => {
                  // Export as iCal
                  alert("Export functionality - would download iCal file");
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Export iCal</div>
              </button>
              <button
                onClick={() => {
                  // Print view
                  window.print();
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <div className="flex items-center gap-2"><Printer className="h-4 w-4" /> Print</div>
              </button>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}

function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 text-emerald-600"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

function ColorChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{desc}</span>
      <div className="flex gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

