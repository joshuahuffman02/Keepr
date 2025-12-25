"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { registerBackgroundSync } from "@/lib/offline-queue";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

const providerOptions = ["Hipcamp", "Spot2Nite", "Outdoorsy", "Airbnb", "Other"];
const statusOptions = [
  { value: "disabled", label: "Disabled" },
  { value: "pull", label: "Pull bookings only" },
  { value: "two_way", label: "Two-way" }
];

export default function OtaSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [otaConfigDraft, setOtaConfigDraft] = useState({
    provider: "Hipcamp",
    externalAccountId: "",
    propertyId: "",
    apiKey: "",
    channelId: "",
    notes: ""
  });
  const [form, setForm] = useState({
    name: "",
    provider: "Hipcamp",
    status: "pull",
    defaultStatus: "confirmed",
    feeMode: "absorb",
    rateMultiplier: "1.00",
    sendEmailNotifications: false,
    ignoreSiteRestrictions: false,
    ignoreCategoryRestrictions: false
  });
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState({
    externalId: "",
    siteId: "",
    status: "mapped"
  });
  const [icalUrlDrafts, setIcalUrlDrafts] = useState<Record<string, string>>({});
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const otaConfigQuery = useQuery({
    queryKey: ["ota-config", campgroundId],
    queryFn: () => apiClient.getOtaConfig(campgroundId),
    enabled: !!campgroundId,
    staleTime: 15_000
  });

  const otaSyncStatusQuery = useQuery({
    queryKey: ["ota-sync-status", campgroundId],
    queryFn: () => apiClient.getOtaSyncStatus(campgroundId),
    enabled: !!campgroundId,
    staleTime: 15_000
  });

  useEffect(() => {
    if (otaConfigQuery.data) {
      setOtaConfigDraft({
        provider: otaConfigQuery.data.provider || "Hipcamp",
        externalAccountId: otaConfigQuery.data.externalAccountId ?? "",
        propertyId: otaConfigQuery.data.propertyId ?? "",
        apiKey: otaConfigQuery.data.apiKey ?? "",
        channelId: otaConfigQuery.data.channelId ?? "",
        notes: otaConfigQuery.data.notes ?? ""
      });
    }
  }, [otaConfigQuery.data]);

  const channelsQuery = useQuery({
    queryKey: ["ota-channels", campgroundId],
    queryFn: () => apiClient.listOtaChannels(campgroundId),
    enabled: !!campgroundId,
    staleTime: 30_000
  });

  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });

  const mappingsQuery = useQuery({
    queryKey: ["ota-mappings", selectedChannelId],
    queryFn: () => apiClient.listOtaMappings(selectedChannelId!),
    enabled: !!selectedChannelId
  });
  const importsQuery = useQuery({
    queryKey: ["ota-imports", selectedChannelId],
    queryFn: () => apiClient.listOtaImports(selectedChannelId!),
    enabled: !!selectedChannelId,
    staleTime: 15_000
  });
  const logsQuery = useQuery({
    queryKey: ["ota-logs", selectedChannelId],
    queryFn: () => apiClient.listOtaLogs(selectedChannelId!),
    enabled: !!selectedChannelId,
    staleTime: 15_000
  });

  const saveOtaConfig = useMutation({
    mutationFn: () => apiClient.saveOtaConfig(campgroundId, otaConfigDraft),
    onSuccess: (data) => {
      queryClient.setQueryData(["ota-config", campgroundId], data);
      queryClient.invalidateQueries({ queryKey: ["ota-sync-status", campgroundId] });
      toast({ title: "Saved", description: "OTA credentials stored locally (stubbed)." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const createChannel = useMutation({
    mutationFn: () =>
      apiClient.createOtaChannel(campgroundId, {
        name: form.name,
        provider: form.provider,
        status: form.status,
        defaultStatus: form.defaultStatus,
        feeMode: form.feeMode,
        rateMultiplier: parseFloat(form.rateMultiplier || "1") || 1,
        sendEmailNotifications: form.sendEmailNotifications,
        ignoreSiteRestrictions: form.ignoreSiteRestrictions,
        ignoreCategoryRestrictions: form.ignoreCategoryRestrictions
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ota-channels", campgroundId] });
      toast({ title: "Channel created", description: "OTA channel added." });
      setForm((f) => ({ ...f, name: "", rateMultiplier: "1.00" }));
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const upsertMapping = useMutation({
    mutationFn: () =>
      apiClient.upsertOtaMapping(selectedChannelId!, {
        externalId: mappingForm.externalId.trim(),
        siteId: mappingForm.siteId || undefined,
        status: mappingForm.status
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ota-mappings", selectedChannelId] });
      toast({ title: "Mapping saved", description: "Listing mapping updated." });
      setMappingForm({ externalId: "", siteId: "", status: "mapped" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const ensureIcalToken = useMutation({
    mutationFn: (mappingId: string) => apiClient.ensureOtaIcalToken(mappingId),
    onSuccess: (_, mappingId) => {
      queryClient.invalidateQueries({ queryKey: ["ota-mappings", selectedChannelId] });
      toast({ title: "Calendar ready", description: "iCal link generated." });
      setIcalUrlDrafts((prev) => ({ ...prev, [mappingId]: prev[mappingId] || "" }));
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const setIcalUrl = useMutation({
    mutationFn: (payload: { mappingId: string; url: string }) => apiClient.setOtaIcalUrl(payload.mappingId, payload.url),
    onSuccess: () => {
      toast({ title: "iCal URL saved", description: "Import feed saved for this mapping." });
      queryClient.invalidateQueries({ queryKey: ["ota-mappings", selectedChannelId] });
      void registerBackgroundSync();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const importIcal = useMutation({
    mutationFn: (mappingId: string) => apiClient.importOtaIcal(mappingId),
    onSuccess: (res) => {
      toast({ title: "Imported", description: `Imported ${res.imported} events.` });
      queryClient.invalidateQueries({ queryKey: ["ota-logs", selectedChannelId] });
      void registerBackgroundSync();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const selectedChannel = useMemo(
    () => channelsQuery.data?.find((c) => c.id === selectedChannelId) ?? null,
    [channelsQuery.data, selectedChannelId]
  );

  const syncStatus =
    otaSyncStatusQuery.data ??
    (otaConfigQuery.data
      ? {
          campgroundId: otaConfigQuery.data.campgroundId,
          lastSyncStatus: otaConfigQuery.data.lastSyncStatus || "not_started",
          lastSyncAt: otaConfigQuery.data.lastSyncAt ?? null,
          lastSyncMessage: otaConfigQuery.data.lastSyncMessage ?? "Not synced yet.",
          pendingSyncs: otaConfigQuery.data.pendingSyncs ?? 0
        }
      : {
          campgroundId,
          lastSyncStatus: "not_started",
          lastSyncAt: null,
          lastSyncMessage: "Not synced yet.",
          pendingSyncs: 0
        });

  const pushAvailability = useMutation({
    mutationFn: () => apiClient.pushOtaAvailability(selectedChannelId!),
    onSuccess: (res) => {
      toast({
        title: "Push queued",
        description: `Queued availability/pricing push for ${res.mappingCount ?? 0} mappings.`
      });
      queryClient.invalidateQueries({ queryKey: ["ota-logs", selectedChannelId] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const handleCreateChannel = () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Enter a channel name.", variant: "destructive" });
      return;
    }
    createChannel.mutate();
  };

  const handleMarkSyncChecked = () => {
    if (!campgroundId) {
      toast({ title: "Campground required", description: "Select a campground first.", variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    const updatedConfig = {
      campgroundId,
      ...otaConfigDraft,
      lastSyncStatus: "stubbed",
      lastSyncAt: now,
      lastSyncMessage: "Checked locally; no provider calls yet.",
      pendingSyncs: 0,
      lastUpdatedAt: otaConfigQuery.data?.lastUpdatedAt ?? now
    };
    queryClient.setQueryData(["ota-config", campgroundId], updatedConfig);
    queryClient.setQueryData(["ota-sync-status", campgroundId], {
      campgroundId,
      lastSyncStatus: "stubbed",
      lastSyncAt: now,
      lastSyncMessage: "Checked locally; no provider calls yet.",
      pendingSyncs: 0
    });
    toast({ title: "Sync status noted", description: "Recorded a stub sync check (no provider calls)." });
  };

  const renderStatusBadge = (status?: string) => {
    if (status === "two_way") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Two-way</Badge>;
    if (status === "pull") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Pull only</Badge>;
    return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Disabled</Badge>;
  };

  const renderSyncBadge = (status?: string) => {
    if (status === "ok" || status === "stubbed") return <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">Stubbed</Badge>;
    if (status === "error") return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Error</Badge>;
    return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Not started</Badge>;
  };

  const channelErrorCount = (ch: any) => (ch?.mappings ?? []).filter((m: any) => m?.lastError).length;

  return (
    <div>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4" data-testid="ota-header">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">OTA Channels</h1>
            <p className="text-slate-600 text-sm">Manage channel connections and map listings to your sites.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/pwa/sync-log">Sync log</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.serviceWorker?.controller?.postMessage({ type: "TRIGGER_SYNC" })}
              data-testid="ota-sync-trigger"
            >
              Sync now
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>OTA credentials (placeholder)</CardTitle>
              <CardDescription>Capture provider IDs/keys for a future channel manager. Stored locally only; no external calls are made.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Provider</Label>
                  <Select value={otaConfigDraft.provider} onValueChange={(v) => setOtaConfigDraft((f) => ({ ...f, provider: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerOptions.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>External account ID</Label>
                  <Input
                    value={otaConfigDraft.externalAccountId}
                    onChange={(e) => setOtaConfigDraft((f) => ({ ...f, externalAccountId: e.target.value }))}
                    placeholder="Partner account ID"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Property / listing ID</Label>
                  <Input
                    value={otaConfigDraft.propertyId}
                    onChange={(e) => setOtaConfigDraft((f) => ({ ...f, propertyId: e.target.value }))}
                    placeholder="Property or listing reference"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Channel reference</Label>
                  <Input
                    value={otaConfigDraft.channelId}
                    onChange={(e) => setOtaConfigDraft((f) => ({ ...f, channelId: e.target.value }))}
                    placeholder="Channel ID (optional)"
                  />
                </div>
                <div className="space-y-1">
                  <Label>API key (stub)</Label>
                  <Input
                    type="password"
                    value={otaConfigDraft.apiKey}
                    onChange={(e) => setOtaConfigDraft((f) => ({ ...f, apiKey: e.target.value }))}
                    placeholder="No external call is made"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={otaConfigDraft.notes}
                    onChange={(e) => setOtaConfigDraft((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Connection notes, sandbox hints, etc."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {otaConfigQuery.isLoading
                    ? "Loading config…"
                    : otaConfigQuery.data?.lastUpdatedAt
                      ? `Last updated ${new Date(otaConfigQuery.data.lastUpdatedAt).toLocaleString()}`
                      : "Not saved yet."}
                </p>
                <Button onClick={() => saveOtaConfig.mutate()} disabled={!campgroundId || saveOtaConfig.isPending}>
                  {saveOtaConfig.isPending ? "Saving…" : "Save OTA config"}
                </Button>
              </div>
              {!campgroundId && (
                <p className="text-xs text-amber-700">Select a campground to enable saving.</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="ota-sync-card">
            <CardHeader>
              <CardTitle>Sync status (stub)</CardTitle>
              <CardDescription>Local-only status for smoke testing the channel manager path.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div data-testid="ota-sync-status">{renderSyncBadge(syncStatus?.lastSyncStatus)}</div>
                <span className="text-sm text-slate-700 capitalize">
                  {syncStatus?.lastSyncStatus ?? "not started"}
                </span>
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Last check</span>
                  <span className="text-slate-600">
                    {syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : "Not yet"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pending pushes</span>
                  <span className="text-slate-600">{syncStatus?.pendingSyncs ?? 0}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600">{syncStatus?.lastSyncMessage ?? "No syncs recorded."}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => otaSyncStatusQuery.refetch()}
                  disabled={!campgroundId || otaSyncStatusQuery.isFetching}
                >
                  {otaSyncStatusQuery.isFetching ? "Refreshing…" : "Refresh status"}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleMarkSyncChecked} disabled={!campgroundId}>
                  Log stub sync
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Create channel</CardTitle>
              <CardDescription>Configure provider, status, and pricing multiplier.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Hipcamp, Airbnb…" />
              </div>
              <div className="space-y-1">
                <Label>Provider</Label>
                <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}>
                  <SelectTrigger data-testid="ota-provider-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Default booking status</Label>
                  <Select value={form.defaultStatus} onValueChange={(v) => setForm((f) => ({ ...f, defaultStatus: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="pending">Unconfirmed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Rate multiplier</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.rateMultiplier}
                    onChange={(e) => setForm((f) => ({ ...f, rateMultiplier: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fee mode</Label>
                  <Select value={form.feeMode} onValueChange={(v) => setForm((f) => ({ ...f, feeMode: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="absorb">Absorb fees</SelectItem>
                      <SelectItem value="pass_through">Pass-through fees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Email notifications</Label>
                  <Select
                    value={form.sendEmailNotifications ? "yes" : "no"}
                    onValueChange={(v) => setForm((f) => ({ ...f, sendEmailNotifications: v === "yes" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Ignore site restrictions</Label>
                  <Select
                    value={form.ignoreSiteRestrictions ? "yes" : "no"}
                    onValueChange={(v) => setForm((f) => ({ ...f, ignoreSiteRestrictions: v === "yes" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Ignore category restrictions</Label>
                  <Select
                    value={form.ignoreCategoryRestrictions ? "yes" : "no"}
                    onValueChange={(v) => setForm((f) => ({ ...f, ignoreCategoryRestrictions: v === "yes" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateChannel} disabled={!campgroundId || createChannel.isPending}>
                {createChannel.isPending ? "Saving…" : "Create channel"}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Channels</CardTitle>
              <CardDescription>Click a channel to view mappings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table data-testid="ota-channel-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rate x</TableHead>
                      <TableHead>Default booking</TableHead>
                      <TableHead>Last sync</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelsQuery.data?.length ? (
                      channelsQuery.data.map((ch) => {
                        const active = selectedChannelId === ch.id;
                        return (
                          <TableRow
                            key={ch.id}
                            className={active ? "bg-emerald-50" : ""}
                            onClick={() => setSelectedChannelId(ch.id)}
                            data-testid="ota-channel-row"
                          >
                            <TableCell className="font-medium">{ch.name}</TableCell>
                            <TableCell>{ch.provider}</TableCell>
                            <TableCell>{renderStatusBadge(ch.status)}</TableCell>
                            <TableCell>{ch.rateMultiplier?.toFixed?.(2) ?? ch.rateMultiplier}</TableCell>
                            <TableCell className="capitalize">{ch.defaultStatus}</TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {ch.lastSyncAt ? new Date(ch.lastSyncAt).toLocaleString() : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-rose-600">
                              {channelErrorCount(ch) || "0"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                          <div className="overflow-hidden rounded border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <tbody>
                                <tr>
                                  <td className="text-center text-sm text-slate-500 py-6">No channels yet.</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedChannel && (
            <Card data-testid="ota-mapping-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedChannel.name} mappings</CardTitle>
                  <CardDescription>Map OTA listing IDs to your sites.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {renderStatusBadge(selectedChannel.status)}
                  {channelErrorCount(selectedChannel) > 0 && (
                    <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                      {channelErrorCount(selectedChannel)} errors
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pushAvailability.mutate()}
                    disabled={pushAvailability.isPending}
                  >
                    {pushAvailability.isPending ? "Pushing…" : "Push availability"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1 md:col-span-2">
                  <Label>External listing ID</Label>
                  <Input
                    value={mappingForm.externalId}
                    onChange={(e) => setMappingForm((f) => ({ ...f, externalId: e.target.value }))}
                    placeholder="OTA listing ID"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Map to site</Label>
                  <Select value={mappingForm.siteId} onValueChange={(v) => setMappingForm((f) => ({ ...f, siteId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unmapped</SelectItem>
                      {sitesQuery.data?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={mappingForm.status} onValueChange={(v) => setMappingForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mapped">Mapped</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-4">
                  <Button
                    onClick={() => upsertMapping.mutate()}
                    disabled={!mappingForm.externalId || upsertMapping.isPending}
                    data-testid="ota-mapping-save"
                  >
                    {upsertMapping.isPending ? "Saving…" : "Save mapping"}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table data-testid="ota-mapping-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>External ID</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last sync</TableHead>
                      <TableHead>Last error</TableHead>
                      <TableHead>iCal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappingsQuery.data?.length ? (
                      mappingsQuery.data.map((m) => (
                        <TableRow key={m.id} data-testid="ota-mapping-row">
                          <TableCell className="font-mono text-xs">{m.externalId}</TableCell>
                          <TableCell>
                            {m.site?.name ? (
                              m.site.name
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Unmapped</Badge>
                            )}
                          </TableCell>
                          <TableCell className="capitalize">{m.status}</TableCell>
                          <TableCell>{m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString() : "—"}</TableCell>
                          <TableCell className="text-amber-700 text-sm">
                            {m.lastError ?? "—"}
                          </TableCell>
                          <TableCell className="space-y-2 text-xs">
                            <div className="flex gap-2 items-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => ensureIcalToken.mutate(m.id)}
                                disabled={ensureIcalToken.isPending}
                              >
                                {ensureIcalToken.isPending ? "Preparing…" : "Get iCal link"}
                              </Button>
                              {m.icalToken && (
                                <Input
                                  readOnly
                                  className="font-mono text-[11px]"
                                  value={`${apiBase}/ota/ical/${m.icalToken}`}
                                  onFocus={(e) => e.currentTarget.select()}
                                />
                              )}
                            </div>
                            <div className="flex gap-2 items-center">
                              <Input
                                placeholder="Remote iCal URL to import"
                                value={icalUrlDrafts[m.id] ?? m.icalUrl ?? ""}
                                onChange={(e) =>
                                  setIcalUrlDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                                }
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setIcalUrl.mutate({ mappingId: m.id, url: icalUrlDrafts[m.id] ?? m.icalUrl ?? "" })}
                                disabled={setIcalUrl.isPending}
                              >
                                Save URL
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => importIcal.mutate(m.id)}
                                disabled={importIcal.isPending}
                              >
                                Import now
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-slate-500">
                          <div className="overflow-hidden rounded border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <tbody>
                                    <tr>
                                      <td className="text-center text-sm text-slate-500 py-6">No mappings yet.</td>
                                    </tr>
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Recent imports</h3>
                    <Button variant="ghost" size="sm" onClick={() => importsQuery.refetch()}>
                      Refresh
                    </Button>
                  </div>
                  <div className="overflow-x-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>External Res ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reservation</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importsQuery.data?.length ? (
                          importsQuery.data.map((imp) => (
                            <TableRow key={imp.id}>
                              <TableCell className="font-mono text-xs">{imp.externalReservationId}</TableCell>
                              <TableCell className="capitalize">{imp.status}</TableCell>
                              <TableCell className="font-mono text-xs">{imp.reservationId ?? "—"}</TableCell>
                              <TableCell className="text-sm text-slate-700">{imp.message ?? "—"}</TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {imp.createdAt ? new Date(imp.createdAt).toLocaleString() : "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                              <div className="overflow-hidden rounded border border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                  <tbody>
                                    <tr>
                                      <td className="text-center text-sm text-slate-500 py-6">No imports yet.</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Sync logs</h3>
                    <Button variant="ghost" size="sm" onClick={() => logsQuery.refetch()}>
                      Refresh
                    </Button>
                  </div>
                  <div className="overflow-x-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Direction</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logsQuery.data?.length ? (
                          logsQuery.data.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="capitalize">{log.direction}</TableCell>
                              <TableCell className="capitalize">{log.eventType}</TableCell>
                              <TableCell className="capitalize">{log.status}</TableCell>
                              <TableCell className="text-sm text-slate-700">{log.message ?? "—"}</TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                              <div className="overflow-hidden rounded border border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                  <tbody>
                                    <tr>
                                      <td className="text-center text-sm text-slate-500 py-6">No logs yet.</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

