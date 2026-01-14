"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCampground } from "@/contexts/CampgroundContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Calendar,
  XCircle,
  Info,
  Pencil,
  Trash2,
  MoreHorizontal,
  Wrench,
  Snowflake,
  PartyPopper,
  AlertTriangle,
  MapPin,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsTable } from "@/components/settings/tables";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface SiteClosure {
  id: string;
  name: string;
  reason: "maintenance" | "seasonal" | "event" | "emergency" | "other";
  sites: string[];
  siteClasses: string[];
  startDate: string;
  endDate: string;
  notes: string;
  isActive: boolean;
}

const closureReasons: SiteClosure["reason"][] = [
  "maintenance",
  "seasonal",
  "event",
  "emergency",
  "other",
];
const closureReasonSet = new Set<string>(closureReasons);
const isClosureReason = (value: string): value is SiteClosure["reason"] =>
  closureReasonSet.has(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const getBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const reasonConfig = {
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    color: "bg-status-warning/15 text-status-warning",
  },
  seasonal: {
    label: "Seasonal",
    icon: Snowflake,
    color: "bg-status-info/15 text-status-info",
  },
  event: {
    label: "Special Event",
    icon: PartyPopper,
    color: "bg-purple-100 text-purple-800",
  },
  emergency: {
    label: "Emergency",
    icon: AlertTriangle,
    color: "bg-status-error/15 text-status-error",
  },
  other: {
    label: "Other",
    icon: XCircle,
    color: "bg-muted text-foreground",
  },
};

async function fetchClosures(campgroundId: string): Promise<SiteClosure[]> {
  const response = await fetch(`${API_BASE}/blackouts/campgrounds/${campgroundId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch closures");
  }
  // Transform blackout data to closure format
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((blackout: unknown): SiteClosure | null => {
      if (!isRecord(blackout)) return null;
      const id = getString(blackout.id);
      if (!id) return null;
      const reasonValue = getString(blackout.reason);
      const reason = reasonValue && isClosureReason(reasonValue) ? reasonValue : "other";
      const name = getString(blackout.name) || reasonValue || "Site Closure";
      const startDate = getString(blackout.startDate) ?? "";
      const endDate = getString(blackout.endDate) ?? "";
      return {
        id,
        name,
        reason,
        sites: getStringArray(blackout.siteIds),
        siteClasses: getStringArray(blackout.siteClassIds),
        startDate,
        endDate,
        notes: getString(blackout.notes) || "",
        isActive: getBoolean(blackout.isActive) ?? true,
      };
    })
    .filter((closure): closure is SiteClosure => Boolean(closure));
}

async function fetchSiteClasses(campgroundId: string): Promise<string[]> {
  const response = await fetch(`${API_BASE}/campgrounds/${campgroundId}/site-classes`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch site classes");
  }
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((entry: unknown) => (isRecord(entry) ? getString(entry.name) : undefined))
    .filter((name): name is string => Boolean(name));
}

async function deleteClosure(closureId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/blackouts/${closureId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to delete closure");
  }
}

interface CreateClosureData {
  campgroundId: string;
  name: string;
  reason: string;
  startDate: string;
  endDate: string;
  notes?: string;
  siteIds?: string[];
  siteClassIds?: string[];
}

async function createClosure(data: CreateClosureData): Promise<unknown> {
  const response = await fetch(`${API_BASE}/blackouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to create closure");
  }
  return response.json();
}

async function updateClosure(id: string, data: Partial<CreateClosureData>): Promise<unknown> {
  const response = await fetch(`${API_BASE}/blackouts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update closure");
  }
  return response.json();
}

async function toggleClosure(id: string, isActive: boolean): Promise<unknown> {
  const response = await fetch(`${API_BASE}/blackouts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ isActive }),
  });
  if (!response.ok) {
    throw new Error("Failed to toggle closure");
  }
  return response.json();
}

export default function SiteClosuresPage() {
  const { selectedCampground, isHydrated } = useCampground();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState<SiteClosure | null>(null);

  const { data: closures = [], isLoading } = useQuery({
    queryKey: ["closures", selectedCampground?.id],
    queryFn: () => fetchClosures(selectedCampground!.id),
    enabled: isHydrated && !!selectedCampground?.id,
  });

  const { data: siteClasses = [] } = useQuery({
    queryKey: ["site-classes", selectedCampground?.id],
    queryFn: () => fetchSiteClasses(selectedCampground!.id),
    enabled: isHydrated && !!selectedCampground?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClosure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closures", selectedCampground?.id] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; payload: CreateClosureData }) => {
      if (data.id) {
        return updateClosure(data.id, data.payload);
      }
      return createClosure(data.payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closures", selectedCampground?.id] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return toggleClosure(id, isActive);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closures", selectedCampground?.id] });
    },
  });

  // Form state
  const [formName, setFormName] = useState("");
  const [formReason, setFormReason] = useState<SiteClosure["reason"]>("maintenance");
  const [formSites, setFormSites] = useState<string[]>([]);
  const [formSiteClasses, setFormSiteClasses] = useState<string[]>([]);
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const resetForm = useCallback(() => {
    setFormName("");
    setFormReason("maintenance");
    setFormSites([]);
    setFormSiteClasses([]);
    setFormStartDate("");
    setFormEndDate("");
    setFormNotes("");
    setEditingClosure(null);
  }, []);

  const openEditor = useCallback((closure: SiteClosure | null) => {
    if (closure) {
      setEditingClosure(closure);
      setFormName(closure.name);
      setFormReason(closure.reason);
      setFormSites(closure.sites);
      setFormSiteClasses(closure.siteClasses);
      setFormStartDate(closure.startDate);
      setFormEndDate(closure.endDate);
      setFormNotes(closure.notes);
    } else {
      resetForm();
    }
    setIsEditorOpen(true);
  }, [resetForm]);

  const handleSave = useCallback(() => {
    if (!formName.trim() || !formStartDate || !formEndDate || !selectedCampground) return;

    const payload: CreateClosureData = {
      campgroundId: selectedCampground.id,
      name: formName.trim(),
      reason: formReason,
      startDate: formStartDate,
      endDate: formEndDate,
      notes: formNotes || undefined,
      siteIds: formSites.length > 0 ? formSites : undefined,
      siteClassIds: formSiteClasses.length > 0 ? formSiteClasses : undefined,
    };

    saveMutation.mutate(
      { id: editingClosure?.id, payload },
      {
        onSuccess: () => {
          setIsEditorOpen(false);
          resetForm();
        },
      }
    );
  }, [formName, formStartDate, formEndDate, formReason, formNotes, formSites, formSiteClasses, selectedCampground, editingClosure, saveMutation, resetForm]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleToggleActive = useCallback((id: string) => {
    const closure = closures.find((c) => c.id === id);
    if (closure) {
      toggleMutation.mutate({ id, isActive: !closure.isActive });
    }
  }, [closures, toggleMutation]);

  if (!isHydrated || !selectedCampground) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toggleSiteClass = (siteClass: string) => {
    setFormSiteClasses((prev) =>
      prev.includes(siteClass)
        ? prev.filter((s) => s !== siteClass)
        : [...prev, siteClass]
    );
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  };

  const columns = [
    {
      key: "name",
      label: "Closure",
      render: (item: SiteClosure) => {
        const config = reasonConfig[item.reason];
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.color.split(" ")[0])}>
              <Icon className={cn("h-4 w-4", config.color.split(" ")[1])} />
            </div>
            <div>
              <p className="font-medium text-foreground">{item.name}</p>
              <Badge variant="outline" className="text-xs mt-1">
                {config.label}
              </Badge>
            </div>
          </div>
        );
      },
    },
    {
      key: "affected",
      label: "Affected Sites",
      render: (item: SiteClosure) => (
        <div className="flex flex-wrap gap-1">
          {item.siteClasses.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {item.siteClasses.length} site class{item.siteClasses.length !== 1 && "es"}
            </Badge>
          )}
          {item.sites.length > 0 && (
            <Badge variant="outline" className="text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              {item.sites.length} specific site{item.sites.length !== 1 && "s"}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "dates",
      label: "Date Range",
      render: (item: SiteClosure) => (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDateRange(item.startDate, item.endDate)}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: SiteClosure) => {
        const now = new Date();
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const isUpcoming = start > now;
        const isCurrent = start <= now && end >= now;
        const isPast = end < now;

        if (!item.isActive) {
          return (
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              Cancelled
            </Badge>
          );
        }
        if (isPast) {
          return (
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              Completed
            </Badge>
          );
        }
        if (isCurrent) {
          return (
            <Badge className="bg-status-error/15 text-status-error">
              Active Now
            </Badge>
          );
        }
        return (
          <Badge className="bg-status-warning/15 text-status-warning">
            Scheduled
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Site Closures</h2>
          <p className="text-muted-foreground mt-1">
            Temporarily close sites for maintenance, seasonal shutdowns, or events
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Closure
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Site closures block availability for the specified dates. Guests cannot book
          closed sites, and existing reservations will be flagged for review.
        </AlertDescription>
      </Alert>

      {/* Table */}
      <SettingsTable
        data={closures}
        columns={columns}
        searchPlaceholder="Search closures..."
        searchFields={["name", "notes"]}
        addLabel="Add Closure"
        onAdd={() => openEditor(null)}
        getItemStatus={(item) => (item.isActive ? "active" : "inactive")}
        getRowActions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More options" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditor(item)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleActive(item.id)}>
                {item.isActive ? "Cancel Closure" : "Reactivate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDelete(item.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyState={{
          icon: XCircle,
          title: "No site closures",
          description: "Create closures to temporarily block site availability",
        }}
      />

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingClosure ? "Edit Closure" : "Add Site Closure"}
            </DialogTitle>
            <DialogDescription>
              Block sites from being booked during a specific period
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Closure Name</Label>
              <Input
                id="name"
                placeholder="e.g., Winter Maintenance, Festival Prep"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Select
                value={formReason}
                onValueChange={(value) => {
                  if (isClosureReason(value)) {
                    setFormReason(value);
                  }
                }}
              >
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reasonConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Apply to Site Classes</Label>
              <div className="flex flex-wrap gap-2">
                {siteClasses.map((siteClass) => (
                  <Button
                    key={siteClass}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSiteClass(siteClass)}
                    className={cn(
                      formSiteClasses.includes(siteClass) &&
                        "bg-status-success/15 border-status-success/30 text-status-success"
                    )}
                  >
                    {siteClass}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Or leave empty and select specific sites below
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional details about this closure..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formName.trim() || !formStartDate || !formEndDate}
            >
              {editingClosure ? "Save Changes" : "Create Closure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
