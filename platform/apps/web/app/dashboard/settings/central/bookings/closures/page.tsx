"use client";

import { useState, useCallback } from "react";
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

const reasonConfig = {
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    color: "bg-amber-100 text-amber-800",
  },
  seasonal: {
    label: "Seasonal",
    icon: Snowflake,
    color: "bg-blue-100 text-blue-800",
  },
  event: {
    label: "Special Event",
    icon: PartyPopper,
    color: "bg-purple-100 text-purple-800",
  },
  emergency: {
    label: "Emergency",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-800",
  },
  other: {
    label: "Other",
    icon: XCircle,
    color: "bg-slate-100 text-slate-800",
  },
};

const mockClosures: SiteClosure[] = [
  {
    id: "1",
    name: "Winter Closure - Tent Sites",
    reason: "seasonal",
    sites: [],
    siteClasses: ["Tent Sites"],
    startDate: "2025-11-01",
    endDate: "2026-03-15",
    notes: "Tent sites closed during winter months due to weather",
    isActive: true,
  },
  {
    id: "2",
    name: "Sewer Line Repair",
    reason: "maintenance",
    sites: ["A-12", "A-13", "A-14"],
    siteClasses: [],
    startDate: "2025-01-15",
    endDate: "2025-01-20",
    notes: "Replacing sewer connections on row A",
    isActive: true,
  },
  {
    id: "3",
    name: "Music Festival",
    reason: "event",
    sites: [],
    siteClasses: ["Full Hookup", "Partial Hookup"],
    startDate: "2025-06-20",
    endDate: "2025-06-23",
    notes: "Sites reserved for festival staff and vendors",
    isActive: true,
  },
];

const mockSiteClasses = ["Full Hookup", "Partial Hookup", "Tent Sites", "Cabins"];
const mockSites = ["A-01", "A-02", "A-03", "A-12", "A-13", "A-14", "B-01", "B-02", "C-01"];

export default function SiteClosuresPage() {
  const [closures, setClosures] = useState<SiteClosure[]>(mockClosures);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState<SiteClosure | null>(null);

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
    if (!formName.trim() || !formStartDate || !formEndDate) return;

    const closureData = {
      name: formName.trim(),
      reason: formReason,
      sites: formSites,
      siteClasses: formSiteClasses,
      startDate: formStartDate,
      endDate: formEndDate,
      notes: formNotes,
      isActive: true,
    };

    if (editingClosure) {
      setClosures((prev) =>
        prev.map((c) =>
          c.id === editingClosure.id ? { ...c, ...closureData } : c
        )
      );
    } else {
      const newClosure: SiteClosure = {
        ...closureData,
        id: Date.now().toString(),
      };
      setClosures((prev) => [...prev, newClosure]);
    }

    setIsEditorOpen(false);
    resetForm();
  }, [editingClosure, formName, formReason, formSites, formSiteClasses, formStartDate, formEndDate, formNotes, resetForm]);

  const handleDelete = useCallback((id: string) => {
    setClosures((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleToggleActive = useCallback((id: string) => {
    setClosures((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isActive: !c.isActive } : c
      )
    );
  }, []);

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
              <p className="font-medium text-slate-900">{item.name}</p>
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
          <Calendar className="h-4 w-4 text-slate-400" />
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
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              Cancelled
            </Badge>
          );
        }
        if (isPast) {
          return (
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              Completed
            </Badge>
          );
        }
        if (isCurrent) {
          return (
            <Badge className="bg-red-100 text-red-800">
              Active Now
            </Badge>
          );
        }
        return (
          <Badge className="bg-amber-100 text-amber-800">
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
          <h2 className="text-2xl font-bold text-slate-900">Site Closures</h2>
          <p className="text-slate-500 mt-1">
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
              <Button variant="ghost" size="icon" className="h-8 w-8">
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
              <Select value={formReason} onValueChange={(v) => setFormReason(v as SiteClosure["reason"])}>
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
                {mockSiteClasses.map((siteClass) => (
                  <Button
                    key={siteClass}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSiteClass(siteClass)}
                    className={cn(
                      formSiteClasses.includes(siteClass) &&
                        "bg-emerald-100 border-emerald-300 text-emerald-800"
                    )}
                  >
                    {siteClass}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
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
