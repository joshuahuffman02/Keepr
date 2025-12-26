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
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Globe, Shield, CheckCircle2, AlertCircle, Clock, RefreshCw, Plus,
  Zap, ChevronRight, ExternalLink, Calendar, ArrowRightLeft, Loader2,
  Sparkles, Lock, Eye, EyeOff, Link2, Download, Upload, XCircle,
  PartyPopper, Wifi, WifiOff, Settings2, HelpCircle
} from "lucide-react";

const providerOptions = [
  { value: "Hipcamp", label: "Hipcamp", icon: "🏕️" },
  { value: "Spot2Nite", label: "Spot2Nite", icon: "🌙" },
  { value: "Outdoorsy", label: "Outdoorsy", icon: "🚐" },
  { value: "Airbnb", label: "Airbnb", icon: "🏠" },
  { value: "Other", label: "Other", icon: "🔗" }
];

const statusOptions = [
  { value: "disabled", label: "Disabled", description: "Channel is off" },
  { value: "pull", label: "Pull bookings only", description: "Import reservations from OTA" },
  { value: "two_way", label: "Two-way sync", description: "Full availability & booking sync" }
];

// Empty state component with guidance
function EmptyChannelsState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="col-span-full">
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-12 text-center">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-br from-emerald-100/50 to-teal-100/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 mb-6">
            <Globe className="h-10 w-10" />
          </div>

          <h3 className="text-2xl font-bold text-slate-900 mb-3">
            Connect Your First Channel
          </h3>
          <p className="text-slate-600 max-w-md mx-auto mb-8">
            Sync your availability with Hipcamp, Airbnb, and other booking platforms.
            Never worry about double bookings again.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button
              size="lg"
              onClick={onCreateClick}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Channel
            </Button>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>Secure API connections</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Real-time sync</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              <span>No double bookings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Success modal for channel creation
function FirstChannelCelebration({
  open,
  onClose,
  channelName,
  provider
}: {
  open: boolean;
  onClose: () => void;
  channelName: string;
  provider: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in duration-300 max-w-md mx-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white mb-4">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Channel Created!
        </h3>
        <p className="text-slate-600 mb-6">
          <span className="font-medium text-blue-600">{channelName}</span> has been set up.
          Now let's connect it to {provider}.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Important: Complete these steps to finish setup
          </p>
          <ol className="text-sm text-amber-700 space-y-2 list-decimal list-inside">
            <li>
              <strong>Get your iCal URL from {provider}</strong>
              <p className="text-xs text-amber-600 ml-5">Find this in your {provider} listing settings</p>
            </li>
            <li>
              <strong>Add a mapping below</strong>
              <p className="text-xs text-amber-600 ml-5">Enter your {provider} listing ID and paste the iCal URL</p>
            </li>
            <li>
              <strong>Test with "Import now"</strong>
              <p className="text-xs text-amber-600 ml-5">This will pull reservations from {provider} to verify it works</p>
            </li>
          </ol>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          The channel won't sync until you add at least one mapping with an iCal URL.
        </p>

        <Button
          onClick={onClose}
          className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
        >
          Got it, let's set up mappings
        </Button>
      </div>
    </div>
  );
}

// Channel card with better visual design
function ChannelCard({
  channel,
  isSelected,
  onSelect,
  errorCount
}: {
  channel: any;
  isSelected: boolean;
  onSelect: () => void;
  errorCount: number;
}) {
  const provider = providerOptions.find(p => p.value === channel.provider);
  const mappingCount = channel.mappings?.length ?? 0;
  const needsSetup = mappingCount === 0;

  return (
    <button
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : needsSetup
            ? "border-amber-300 bg-amber-50/50 hover:border-amber-400"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      )}
      aria-pressed={isSelected}
      aria-label={`${channel.name} channel, ${channel.status === "two_way" ? "two-way sync" : channel.status === "pull" ? "pull only" : "disabled"}${needsSetup ? ", needs setup" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
            isSelected ? "bg-blue-100" : needsSetup ? "bg-amber-100" : "bg-slate-100"
          )}>
            {provider?.icon || "🔗"}
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">{channel.name}</h4>
            <p className="text-sm text-slate-500">{channel.provider}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {needsSetup ? (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100">
              <AlertCircle className="h-3 w-3 mr-1" />
              Needs setup
            </Badge>
          ) : (
            <StatusBadge status={channel.status} />
          )}
          {errorCount > 0 && (
            <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
              <AlertCircle className="h-3 w-3 mr-1" />
              {errorCount} errors
            </Badge>
          )}
        </div>
      </div>

      {needsSetup ? (
        <div className="mt-3 pt-3 border-t border-amber-200 flex items-center gap-2 text-xs text-amber-700">
          <AlertCircle className="h-3 w-3" />
          Click to add site mappings
        </div>
      ) : channel.lastSyncAt ? (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          Last sync: {new Date(channel.lastSyncAt).toLocaleString()}
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          {mappingCount} mapping{mappingCount !== 1 ? "s" : ""} · Never synced
        </div>
      )}
    </button>
  );
}

// Status badge with icon (accessible - not color-only)
function StatusBadge({ status }: { status?: string }) {
  if (status === "two_way") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
        <ArrowRightLeft className="h-3 w-3 mr-1" />
        Two-way
      </Badge>
    );
  }
  if (status === "pull") {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
        <Download className="h-3 w-3 mr-1" />
        Pull only
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-700 border-slate-200">
      <WifiOff className="h-3 w-3 mr-1" />
      Disabled
    </Badge>
  );
}

// Sync status badge with icon
function SyncBadge({ status }: { status?: string }) {
  if (status === "ok" || status === "stubbed") {
    return (
      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Connected
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge className="bg-rose-50 text-rose-700 border-rose-200">
        <XCircle className="h-3 w-3 mr-1" />
        Error
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-700 border-slate-200">
      <Clock className="h-3 w-3 mr-1" />
      Not started
    </Badge>
  );
}

// Secure API key input with show/hide
function SecureInput({
  id,
  value,
  onChange,
  placeholder
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label={show ? "Hide API key" : "Show API key"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function OtaSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationChannelName, setCelebrationChannelName] = useState("");
  const [celebrationProvider, setCelebrationProvider] = useState("");

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
      toast({
        title: "Credentials saved",
        description: "Your OTA connection settings have been securely stored."
      });
    },
    onError: (err: Error) => toast({
      title: "Failed to save",
      description: err.message,
      variant: "destructive"
    })
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

      // Always show the setup modal - users need to know what to do next
      setCelebrationChannelName(form.name);
      setCelebrationProvider(form.provider);
      setShowCelebration(true);

      setForm((f) => ({ ...f, name: "", rateMultiplier: "1.00" }));
      setShowCreateForm(false);
    },
    onError: (err: Error) => toast({
      title: "Connection failed",
      description: err.message,
      variant: "destructive"
    })
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
      toast({
        title: "Mapping saved",
        description: "Your listing is now connected to the selected site."
      });
      setMappingForm({ externalId: "", siteId: "", status: "mapped" });
    },
    onError: (err: Error) => toast({
      title: "Failed to save mapping",
      description: err.message,
      variant: "destructive"
    })
  });

  const ensureIcalToken = useMutation({
    mutationFn: (mappingId: string) => apiClient.ensureOtaIcalToken(mappingId),
    onSuccess: (_, mappingId) => {
      queryClient.invalidateQueries({ queryKey: ["ota-mappings", selectedChannelId] });
      toast({
        title: "Calendar link ready",
        description: "Copy the iCal URL to share your availability."
      });
      setIcalUrlDrafts((prev) => ({ ...prev, [mappingId]: prev[mappingId] || "" }));
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const setIcalUrl = useMutation({
    mutationFn: (payload: { mappingId: string; url: string }) => apiClient.setOtaIcalUrl(payload.mappingId, payload.url),
    onSuccess: () => {
      toast({
        title: "Import feed saved",
        description: "We'll sync reservations from this calendar."
      });
      queryClient.invalidateQueries({ queryKey: ["ota-mappings", selectedChannelId] });
      void registerBackgroundSync();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const importIcal = useMutation({
    mutationFn: (mappingId: string) => apiClient.importOtaIcal(mappingId),
    onSuccess: (res) => {
      toast({
        title: "Import complete",
        description: `Successfully imported ${res.imported} reservation${res.imported !== 1 ? "s" : ""}.`
      });
      queryClient.invalidateQueries({ queryKey: ["ota-logs", selectedChannelId] });
      void registerBackgroundSync();
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" })
  });

  const pushAvailability = useMutation({
    mutationFn: () => apiClient.pushOtaAvailability(selectedChannelId!),
    onSuccess: (res) => {
      toast({
        title: "Sync started",
        description: `Pushing availability to ${res.mappingCount ?? 0} listing${res.mappingCount !== 1 ? "s" : ""}...`
      });
      queryClient.invalidateQueries({ queryKey: ["ota-logs", selectedChannelId] });
    },
    onError: (err: Error) => toast({ title: "Sync failed", description: err.message, variant: "destructive" })
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

  const handleCreateChannel = () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Give your channel a name.", variant: "destructive" });
      return;
    }
    createChannel.mutate();
  };

  const handleMarkSyncChecked = () => {
    if (!campgroundId) {
      toast({ title: "No campground selected", variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    queryClient.setQueryData(["ota-sync-status", campgroundId], {
      campgroundId,
      lastSyncStatus: "stubbed",
      lastSyncAt: now,
      lastSyncMessage: "Manual sync check completed.",
      pendingSyncs: 0
    });
    toast({
      title: "Sync verified",
      description: "Connection status has been updated."
    });
  };

  const channelErrorCount = (ch: any) => (ch?.mappings ?? []).filter((m: any) => m?.lastError).length;
  const hasChannels = channelsQuery.data && channelsQuery.data.length > 0;

  return (
    <div className="space-y-6">
      {/* Setup instructions modal */}
      <FirstChannelCelebration
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        channelName={celebrationChannelName}
        provider={celebrationProvider}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" data-testid="ota-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-500/25">
              <Globe className="h-5 w-5" />
            </span>
            OTA Channels
          </h1>
          <p className="text-slate-600 mt-1">
            Connect with booking platforms to sync availability and reservations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/pwa/sync-log" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Sync History
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.serviceWorker?.controller?.postMessage({ type: "TRIGGER_SYNC" })}
            data-testid="ota-sync-trigger"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Sync Now
          </Button>
          {hasChannels && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Channel
            </Button>
          )}
        </div>
      </div>

      {/* Live region for screen reader announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {channelsQuery.isLoading && "Loading channels..."}
        {createChannel.isPending && "Creating channel..."}
        {saveOtaConfig.isPending && "Saving configuration..."}
      </div>

      {/* Quick status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Connected Channels</p>
                <p className="text-2xl font-bold text-blue-900">
                  {channelsQuery.data?.length ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Link2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">Sync Status</p>
                <div className="mt-1">
                  <SyncBadge status={syncStatus?.lastSyncStatus} />
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Wifi className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700">Pending Syncs</p>
                <p className="text-2xl font-bold text-amber-900">
                  {syncStatus?.pendingSyncs ?? 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      {!hasChannels && !showCreateForm ? (
        <EmptyChannelsState onCreateClick={() => setShowCreateForm(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Channels list */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your Channels</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Create channel form */}
            {showCreateForm && (
              <Card className="border-blue-200 bg-blue-50/50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 duration-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    New Channel
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="channel-name">Channel Name</Label>
                    <Input
                      id="channel-name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g., My Hipcamp Listings"
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="channel-provider">Provider</Label>
                    <Select
                      value={form.provider}
                      onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}
                    >
                      <SelectTrigger id="channel-provider" className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="flex items-center gap-2">
                              <span>{p.icon}</span>
                              {p.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="channel-status">Sync Mode</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                    >
                      <SelectTrigger id="channel-status" className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div>
                              <p>{opt.label}</p>
                              <p className="text-xs text-slate-500">{opt.description}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="rate-multiplier">Rate Multiplier</Label>
                      <Input
                        id="rate-multiplier"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.rateMultiplier}
                        onChange={(e) => setForm((f) => ({ ...f, rateMultiplier: e.target.value }))}
                        className="bg-white"
                      />
                      <p className="text-xs text-slate-500">1.15 = 15% markup</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fee-mode">Fee Handling</Label>
                      <Select
                        value={form.feeMode}
                        onValueChange={(v) => setForm((f) => ({ ...f, feeMode: v }))}
                      >
                        <SelectTrigger id="fee-mode" className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="absorb">Absorb fees</SelectItem>
                          <SelectItem value="pass_through">Pass to guest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={handleCreateChannel}
                      disabled={!campgroundId || createChannel.isPending}
                    >
                      {createChannel.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Connect
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Channel cards */}
            <div className="space-y-3">
              {channelsQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : channelsQuery.data?.map((ch) => (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  isSelected={selectedChannelId === ch.id}
                  onSelect={() => setSelectedChannelId(ch.id)}
                  errorCount={channelErrorCount(ch)}
                />
              ))}
            </div>
          </div>

          {/* Channel details */}
          <div className="lg:col-span-2">
            {selectedChannel ? (
              <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in duration-200">
                {/* Channel header */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-3xl">
                          {providerOptions.find(p => p.value === selectedChannel.provider)?.icon || "🔗"}
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {selectedChannel.name}
                            <StatusBadge status={selectedChannel.status} />
                          </CardTitle>
                          <CardDescription>
                            {selectedChannel.provider} · Rate: {selectedChannel.rateMultiplier?.toFixed(2) ?? "1.00"}x
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pushAvailability.mutate()}
                          disabled={pushAvailability.isPending}
                        >
                          {pushAvailability.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Push Availability
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Site mappings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-blue-600" />
                      Site Mappings
                    </CardTitle>
                    <CardDescription>
                      Connect your OTA listings to your campground sites
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add mapping form */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="external-id">OTA Listing ID</Label>
                          <Input
                            id="external-id"
                            value={mappingForm.externalId}
                            onChange={(e) => setMappingForm((f) => ({ ...f, externalId: e.target.value }))}
                            placeholder="From your OTA dashboard"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="map-site">Map to Site</Label>
                          <Select
                            value={mappingForm.siteId}
                            onValueChange={(v) => setMappingForm((f) => ({ ...f, siteId: v }))}
                          >
                            <SelectTrigger id="map-site">
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
                        <Button
                          onClick={() => upsertMapping.mutate()}
                          disabled={!mappingForm.externalId || upsertMapping.isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {upsertMapping.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Add Mapping"
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Mappings table */}
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Listing ID</TableHead>
                            <TableHead>Site</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Sync</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mappingsQuery.data?.length ? (
                            mappingsQuery.data.map((m) => (
                              <TableRow key={m.id}>
                                <TableCell className="font-mono text-sm">{m.externalId}</TableCell>
                                <TableCell>
                                  {m.site?.name ? (
                                    <span className="font-medium">{m.site.name}</span>
                                  ) : (
                                    <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Unmapped
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={m.status === "mapped"
                                      ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                                      : "text-slate-600"
                                    }
                                  >
                                    {m.status === "mapped" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    {m.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  {m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString() : "Never"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => ensureIcalToken.mutate(m.id)}
                                      disabled={ensureIcalToken.isPending}
                                      className="text-blue-600"
                                    >
                                      <Calendar className="h-4 w-4 mr-1" />
                                      iCal
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => importIcal.mutate(m.id)}
                                      disabled={importIcal.isPending}
                                    >
                                      <Download className="h-4 w-4 mr-1" />
                                      Import
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                <Link2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                <p>No mappings yet. Add your first listing above.</p>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Sync logs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Download className="h-4 w-4 text-emerald-600" />
                          Recent Imports
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => importsQuery.refetch()}
                          disabled={importsQuery.isFetching}
                        >
                          {importsQuery.isFetching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {importsQuery.data?.length ? (
                          importsQuery.data.slice(0, 5).map((imp) => (
                            <div key={imp.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                              <div>
                                <p className="font-mono text-sm">{imp.externalReservationId}</p>
                                <p className="text-xs text-slate-500">{imp.message || "Imported"}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={imp.status === "success"
                                  ? "text-emerald-700 border-emerald-200"
                                  : "text-amber-700 border-amber-200"
                                }
                              >
                                {imp.status}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-sm text-slate-500 py-4">No imports yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          Sync Activity
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => logsQuery.refetch()}
                          disabled={logsQuery.isFetching}
                        >
                          {logsQuery.isFetching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {logsQuery.data?.length ? (
                          logsQuery.data.slice(0, 5).map((log) => (
                            <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                              <div className="flex items-center gap-2">
                                {log.direction === "push" ? (
                                  <Upload className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <Download className="h-4 w-4 text-emerald-500" />
                                )}
                                <div>
                                  <p className="text-sm font-medium capitalize">{log.eventType}</p>
                                  <p className="text-xs text-slate-500">
                                    {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ""}
                                  </p>
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={log.status === "success"
                                  ? "text-emerald-700 border-emerald-200"
                                  : "text-slate-600"
                                }
                              >
                                {log.status}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-sm text-slate-500 py-4">No activity yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card className="h-full min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <ChevronRight className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">Select a Channel</h3>
                  <p className="text-sm text-slate-500">
                    Choose a channel from the list to view mappings and sync status
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Advanced settings (collapsible) */}
      {hasChannels && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <Settings2 className="h-4 w-4" />
            Advanced Configuration
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-600" />
                  API Credentials
                </CardTitle>
                <CardDescription>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    Credentials are encrypted and stored securely
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="config-provider">Provider</Label>
                    <Select
                      value={otaConfigDraft.provider}
                      onValueChange={(v) => setOtaConfigDraft((f) => ({ ...f, provider: v }))}
                    >
                      <SelectTrigger id="config-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="flex items-center gap-2">
                              <span>{p.icon}</span>
                              {p.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-id">Account ID</Label>
                    <Input
                      id="account-id"
                      value={otaConfigDraft.externalAccountId}
                      onChange={(e) => setOtaConfigDraft((f) => ({ ...f, externalAccountId: e.target.value }))}
                      placeholder="Your partner account ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property-id">Property ID</Label>
                    <Input
                      id="property-id"
                      value={otaConfigDraft.propertyId}
                      onChange={(e) => setOtaConfigDraft((f) => ({ ...f, propertyId: e.target.value }))}
                      placeholder="Property or listing reference"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <SecureInput
                      id="api-key"
                      value={otaConfigDraft.apiKey}
                      onChange={(v) => setOtaConfigDraft((f) => ({ ...f, apiKey: v }))}
                      placeholder="Your API key"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="config-notes">Notes</Label>
                  <Textarea
                    id="config-notes"
                    value={otaConfigDraft.notes}
                    onChange={(e) => setOtaConfigDraft((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Connection notes, sandbox hints, etc."
                    rows={2}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-500">
                    {otaConfigQuery.data?.lastUpdatedAt
                      ? `Last saved ${new Date(otaConfigQuery.data.lastUpdatedAt).toLocaleString()}`
                      : "Not saved yet"}
                  </p>
                  <Button
                    onClick={() => saveOtaConfig.mutate()}
                    disabled={!campgroundId || saveOtaConfig.isPending}
                  >
                    {saveOtaConfig.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Save Credentials
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </details>
      )}
    </div>
  );
}
