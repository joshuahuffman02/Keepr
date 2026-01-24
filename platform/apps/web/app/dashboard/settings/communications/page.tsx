"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { randomId } from "@/lib/random-id";
import type { NpsScheduleEntry } from "@keepr/shared";
import { TableEmpty } from "@/components/ui/table";

type ScheduleEntry = NpsScheduleEntry;

const buildEntry = (): ScheduleEntry => ({
  id: randomId(),
  anchor: "arrival",
  direction: "before",
  offset: 1,
  unit: "days",
  templateId: null,
  enabled: true,
});
const EMPTY_SELECT_VALUE = "__empty";

const scheduleDirections: ScheduleEntry["direction"][] = ["before", "after"];
const scheduleUnits: ScheduleEntry["unit"][] = ["days", "hours"];
const scheduleAnchors: ScheduleEntry["anchor"][] = ["arrival", "departure"];

const isScheduleDirection = (value: string): value is ScheduleEntry["direction"] =>
  scheduleDirections.some((direction) => direction === value);
const isScheduleUnit = (value: string): value is ScheduleEntry["unit"] =>
  scheduleUnits.some((unit) => unit === value);
const isScheduleAnchor = (value: string): value is ScheduleEntry["anchor"] =>
  scheduleAnchors.some((anchor) => anchor === value);

function computeSendTime(entry: ScheduleEntry, sendHour: number, arrival: Date, departure: Date) {
  const base = entry.anchor === "arrival" ? arrival : departure;
  const deltaMs =
    entry.unit === "hours" ? entry.offset * 60 * 60 * 1000 : entry.offset * 24 * 60 * 60 * 1000;
  const signed = entry.direction === "before" ? -deltaMs : deltaMs;
  const target = new Date(base.getTime() + signed);
  target.setHours(sendHour, 0, 0, 0);
  return target;
}

export default function CommunicationsSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const campgroundsQuery = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const campground = campgroundsQuery.data?.[0];
  const campgroundId = campground?.id;

  const templatesQuery = useQuery({
    queryKey: ["templates", campgroundId],
    queryFn: () => apiClient.listTemplates(campgroundId!, "approved"),
    enabled: !!campgroundId,
  });

  const [npsEnabled, setNpsEnabled] = useState(false);
  const [sendHour, setSendHour] = useState<number>(7);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);

  useEffect(() => {
    if (!campground) return;
    setNpsEnabled(!!campground.npsAutoSendEnabled);
    setSendHour(campground.npsSendHour ?? 7);
    setDefaultTemplateId(campground.npsTemplateId ?? null);
    setSchedule(campground.npsSchedule ?? []);
  }, [campground]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!campgroundId) throw new Error("Campground required");
      return apiClient.updateCampgroundNps(campgroundId, {
        npsAutoSendEnabled: npsEnabled,
        npsSendHour: sendHour,
        npsTemplateId: defaultTemplateId,
        npsSchedule: schedule,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campgrounds"] });
      toast({ title: "Saved", description: "NPS messaging schedule updated." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Try again";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    },
  });

  const templateOptions = templatesQuery.data ?? [];

  const preview = useMemo(() => {
    const now = new Date();
    const arrival = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const departure = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const defaultEntry: ScheduleEntry = {
      id: "nps-post-departure-default",
      anchor: "departure",
      direction: "after",
      offset: 1,
      unit: "days",
      templateId: defaultTemplateId,
      enabled: true,
    };
    const entries = [...(schedule || []), defaultEntry];
    return entries
      .filter((e) => e.enabled !== false)
      .map((entry) => ({
        id: entry.id,
        when: computeSendTime(entry, sendHour || 7, arrival, departure),
        anchor: entry.anchor,
        direction: entry.direction,
        offset: entry.offset,
        unit: entry.unit,
      }))
      .sort((a, b) => a.when.getTime() - b.when.getTime());
  }, [schedule, sendHour, defaultTemplateId]);

  if (!campgroundId) {
    return (
      <div>
        <div className="p-6 text-muted-foreground">
          Select or create a campground to manage communications.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Communications — NPS</h1>
          <p className="text-sm text-muted-foreground">
            Auto post-checkout NPS and flexible pre/post-arrival messaging.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Automation</CardTitle>
            <CardDescription>
              Toggle NPS auto-send and set the daily send hour (campground local time).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Auto send enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Enqueue NPS messages on the schedule below.
                </p>
              </div>
              <Switch checked={npsEnabled} onCheckedChange={setNpsEnabled} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Send hour</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={sendHour}
                  onChange={(e) => setSendHour(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Default template</Label>
                <Select
                  value={defaultTemplateId || EMPTY_SELECT_VALUE}
                  onValueChange={(value) =>
                    setDefaultTemplateId(value === EMPTY_SELECT_VALUE ? null : value)
                  }
                >
                  <SelectTrigger className="h-10 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT_VALUE}>(Use fallback copy)</SelectItem>
                    {templateOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} (v{t.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Templates with <code>{"{nps_link}"}</code> or <code>{"{npsLink}"}</code> will have
                  the NPS link injected.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>
              Offsets before/after arrival or departure, with per-entry template overrides.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {schedule.length === 0 && (
                <div className="overflow-hidden rounded border border-border bg-card">
                  <table className="w-full text-sm">
                    <tbody>
                      <TableEmpty>
                        No custom entries yet. The day-after departure send is always included.
                      </TableEmpty>
                    </tbody>
                  </table>
                </div>
              )}
              {schedule.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="grid gap-2 rounded border border-border p-3 md:grid-cols-7 md:items-center"
                >
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={entry.enabled !== false}
                      onCheckedChange={(v) => {
                        const next = [...schedule];
                        next[idx] = { ...entry, enabled: v };
                        setSchedule(next);
                      }}
                    />
                    <span className="text-sm text-foreground">On</span>
                  </div>
                  <Select
                    value={entry.direction}
                    onValueChange={(value) => {
                      if (!isScheduleDirection(value)) return;
                      const next = [...schedule];
                      next[idx] = { ...entry, direction: value };
                      setSchedule(next);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before</SelectItem>
                      <SelectItem value="after">After</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={entry.offset}
                    onChange={(e) => {
                      const next = [...schedule];
                      next[idx] = { ...entry, offset: Number(e.target.value) };
                      setSchedule(next);
                    }}
                  />
                  <Select
                    value={entry.unit}
                    onValueChange={(value) => {
                      if (!isScheduleUnit(value)) return;
                      const next = [...schedule];
                      next[idx] = { ...entry, unit: value };
                      setSchedule(next);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={entry.anchor}
                    onValueChange={(value) => {
                      if (!isScheduleAnchor(value)) return;
                      const next = [...schedule];
                      next[idx] = { ...entry, anchor: value };
                      setSchedule(next);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arrival">Arrival</SelectItem>
                      <SelectItem value="departure">Departure</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={entry.templateId || EMPTY_SELECT_VALUE}
                    onValueChange={(value) => {
                      const next = [...schedule];
                      next[idx] = {
                        ...entry,
                        templateId: value === EMPTY_SELECT_VALUE ? null : value,
                      };
                      setSchedule(next);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>Default</SelectItem>
                      {templateOptions.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} (v{t.version})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    className="text-sm text-red-600"
                    onClick={() => {
                      setSchedule(schedule.filter((_, i) => i !== idx));
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="secondary" onClick={() => setSchedule([...schedule, buildEntry()])}>
              Add schedule row
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview (example stay)</CardTitle>
            <CardDescription>
              Arrival in 3 days, departure in 5 days. Times use the selected send hour.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {preview.length === 0 && (
              <div className="text-sm text-muted-foreground">No sends configured.</div>
            )}
            {preview.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded border border-border px-3 py-2"
              >
                <div className="text-sm text-foreground">
                  {p.direction === "before" ? "-" : "+"}
                  {p.offset}
                  {p.unit === "days" ? "d" : "h"} • {p.anchor}
                </div>
                <div className="text-sm text-muted-foreground">{p.when.toLocaleString()}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
