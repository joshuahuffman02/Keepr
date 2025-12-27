"use client";

import { useState, useEffect, useCallback } from "react";
import { useWhoami } from "@/hooks/use-whoami";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  Plus,
  Search,
  Filter,
  Copy,
  Archive,
  Edit2,
  MapPin,
  Calendar,
  Truck,
  Baby,
  Dog,
  TrendingUp,
  AlertTriangle,
  Globe,
  Building2,
} from "lucide-react";

// Segment types
interface SegmentCriteria {
  type: string;
  operator: string;
  value: string | string[] | number;
}

interface GuestSegment {
  id: string;
  name: string;
  description: string;
  scope: "global" | "organization" | "campground";
  criteria: SegmentCriteria[];
  guestCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isTemplate: boolean;
  status: "active" | "archived";
}


const criteriaTypeOptions = [
  { value: "country", label: "Country", icon: Globe },
  { value: "state", label: "State/Province", icon: MapPin },
  { value: "city", label: "City", icon: Building2 },
  { value: "has_children", label: "Has Children", icon: Baby },
  { value: "has_pets", label: "Has Pets", icon: Dog },
  { value: "rig_type", label: "RV/Equipment Type", icon: Truck },
  { value: "stay_length", label: "Stay Length (nights)", icon: Calendar },
  { value: "stay_reason", label: "Stay Reason", icon: TrendingUp },
  { value: "repeat_stays", label: "Number of Stays", icon: Users },
  { value: "booking_month", label: "Booking Month", icon: Calendar },
  { value: "arrival_day", label: "Arrival Day", icon: Calendar },
];

function SegmentCard({ segment, onEdit, onCopy, onArchive }: {
  segment: GuestSegment;
  onEdit: (segment: GuestSegment) => void;
  onCopy: (segment: GuestSegment) => void;
  onArchive: (segment: GuestSegment) => void;
}) {
  const scopeColors = {
    global: "bg-blue-600",
    organization: "bg-purple-600",
    campground: "bg-emerald-600",
  };

  const scopeLabels = {
    global: "Global Template",
    organization: "Organization",
    campground: "Campground",
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{segment.name}</CardTitle>
              {segment.isTemplate && (
                <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/50">
                  Template
                </Badge>
              )}
            </div>
            <CardDescription className="text-sm">{segment.description}</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onEdit(segment)}
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onCopy(segment)}
              title="Duplicate"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300"
              onClick={() => onArchive(segment)}
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Criteria pills */}
          <div className="flex flex-wrap gap-2">
            {segment.criteria.map((criterion, i) => {
              const criteriaType = criteriaTypeOptions.find(c => c.value === criterion.type);
              const Icon = criteriaType?.icon || Filter;
              return (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-slate-700/50 text-slate-300 flex items-center gap-1"
                >
                  <Icon className="h-3 w-3" />
                  {criteriaType?.label || criterion.type}: {
                    Array.isArray(criterion.value)
                      ? criterion.value.slice(0, 2).join(", ") + (criterion.value.length > 2 ? "..." : "")
                      : String(criterion.value)
                  }
                </Badge>
              );
            })}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-white">
                  {segment.guestCount.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">guests</span>
              </div>
              <Badge className={`${scopeColors[segment.scope]} text-xs`}>
                {scopeLabels[segment.scope]}
              </Badge>
            </div>
            <span className="text-xs text-slate-500">
              Updated {new Date(segment.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GuestSegmentsPage() {
  const { data: whoami, isLoading: whoamiLoading } = useWhoami();
  const [segments, setSegments] = useState<GuestSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // New segment form state
  const [newSegment, setNewSegment] = useState({
    name: "",
    description: "",
    scope: "organization" as "global" | "organization" | "campground",
    criteria: [] as SegmentCriteria[],
  });

  const platformRole = whoami?.user?.platformRole;
  const canManageSegments = platformRole === "platform_admin" || platformRole === "platform_support";

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const fetchSegments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("campreserv:authToken");
      const params = new URLSearchParams();
      if (scopeFilter !== "all") params.append("scope", scopeFilter);
      params.append("status", "active");

      const res = await fetch(`${apiUrl}/admin/guest-segments?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch segments: ${res.statusText}`);
      }

      const data = await res.json();
      // Map API response to our interface
      const mappedSegments: GuestSegment[] = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        scope: s.scope,
        criteria: s.criteria || [],
        guestCount: s.guestCount || 0,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        createdBy: s.createdByEmail || "Unknown",
        isTemplate: s.isTemplate || false,
        status: s.status,
      }));
      setSegments(mappedSegments);
    } catch (err) {
      console.error("Failed to fetch segments:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setSegments([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, scopeFilter]);

  useEffect(() => {
    if (!whoamiLoading) {
      fetchSegments();
    }
  }, [whoamiLoading, fetchSegments]);

  const filteredSegments = segments.filter(segment => {
    const matchesSearch = segment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (segment.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    return matchesSearch && segment.status === "active";
  });

  const handleEdit = (segment: GuestSegment) => {
    console.log("Edit segment:", segment.id);
  };

  const handleCopy = async (segment: GuestSegment) => {
    try {
      const token = localStorage.getItem("campreserv:authToken");
      const res = await fetch(`${apiUrl}/admin/guest-segments/${segment.id}/duplicate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        // Fall back to local copy
        const newSeg: GuestSegment = {
          ...segment,
          id: `seg-${Date.now()}`,
          name: `${segment.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: whoami?.user?.email || "Unknown",
          isTemplate: false,
          scope: "organization",
        };
        setSegments([newSeg, ...segments]);
        return;
      }

      // Refresh segments list
      await fetchSegments();
    } catch (err) {
      console.error("Failed to duplicate segment:", err);
    }
  };

  const handleArchive = async (segment: GuestSegment) => {
    try {
      const token = localStorage.getItem("campreserv:authToken");
      const res = await fetch(`${apiUrl}/admin/guest-segments/${segment.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        // Fall back to local archive
        setSegments(segments.map(s =>
          s.id === segment.id ? { ...s, status: "archived" as const } : s
        ));
        return;
      }

      // Refresh segments list
      await fetchSegments();
    } catch (err) {
      console.error("Failed to archive segment:", err);
    }
  };

  const handleCreateSegment = async () => {
    if (!newSegment.name) return;

    try {
      const token = localStorage.getItem("campreserv:authToken");
      const res = await fetch(`${apiUrl}/admin/guest-segments`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newSegment.name,
          description: newSegment.description,
          scope: newSegment.scope,
          criteria: newSegment.criteria,
        }),
      });

      if (!res.ok) {
        // Fall back to local create
        const segment: GuestSegment = {
          id: `seg-${Date.now()}`,
          name: newSegment.name,
          description: newSegment.description,
          scope: newSegment.scope,
          criteria: newSegment.criteria,
          guestCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: whoami?.user?.email || "Unknown",
          isTemplate: false,
          status: "active",
        };
        setSegments([segment, ...segments]);
      } else {
        // Refresh segments list
        await fetchSegments();
      }

      setIsCreateDialogOpen(false);
      setNewSegment({
        name: "",
        description: "",
        scope: "organization",
        criteria: [],
      });
    } catch (err) {
      console.error("Failed to create segment:", err);
    }
  };

  if (whoamiLoading || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-800 rounded w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-slate-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!canManageSegments) {
    return (
      <div className="p-8">
        <Card className="bg-amber-900/20 border-amber-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <div>
                <h3 className="font-semibold text-amber-200">Access Restricted</h3>
                <p className="text-sm text-amber-300/80">
                  You need platform admin or support role to manage guest segments.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="bg-rose-900/20 border-rose-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
              <div>
                <h3 className="font-semibold text-rose-200">Error Loading Segments</h3>
                <p className="text-sm text-rose-300/80">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Guest Segments</h1>
          </div>
          <p className="text-slate-400 mt-1">
            Create and manage guest segments for targeted messaging and insights
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Segment
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Segment</DialogTitle>
              <DialogDescription>
                Define criteria to group guests for targeted messaging
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Segment Name</Label>
                <Input
                  id="name"
                  value={newSegment.name}
                  onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                  placeholder="e.g., Texas Family Campers"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newSegment.description}
                  onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                  placeholder="Brief description of this segment"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select
                  value={newSegment.scope}
                  onValueChange={(value: "global" | "organization" | "campground") =>
                    setNewSegment({ ...newSegment, scope: value })
                  }
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Campgrounds)</SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                    <SelectItem value="campground">Single Campground</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Criteria (select conditions to match)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {criteriaTypeOptions.slice(0, 6).map(option => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 p-2 rounded border border-slate-700 hover:border-slate-600 cursor-pointer"
                    >
                      <Checkbox
                        checked={newSegment.criteria.some(c => c.type === option.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewSegment({
                              ...newSegment,
                              criteria: [
                                ...newSegment.criteria,
                                { type: option.value, operator: "equals", value: "" }
                              ]
                            });
                          } else {
                            setNewSegment({
                              ...newSegment,
                              criteria: newSegment.criteria.filter(c => c.type !== option.value)
                            });
                          }
                        }}
                      />
                      <option.icon className="h-4 w-4 text-slate-400" />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateSegment}
                disabled={!newSegment.name}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Create Segment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Users className="h-8 w-8 text-emerald-500" />
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/50">
                Active
              </Badge>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">
                {segments.filter(s => s.status === "active").length}
              </div>
              <div className="text-sm text-slate-400">Active Segments</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Globe className="h-8 w-8 text-blue-500" />
              <Badge variant="outline" className="text-blue-400 border-blue-400/50">
                Global
              </Badge>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">
                {segments.filter(s => s.scope === "global" && s.isTemplate).length}
              </div>
              <div className="text-sm text-slate-400">Global Templates</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Building2 className="h-8 w-8 text-purple-500" />
              <Badge variant="outline" className="text-purple-400 border-purple-400/50">
                Custom
              </Badge>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">
                {segments.filter(s => !s.isTemplate).length}
              </div>
              <div className="text-sm text-slate-400">Custom Segments</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-8 w-8 text-amber-500" />
              <Badge variant="outline" className="text-amber-400 border-amber-400/50">
                Total
              </Badge>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">
                {segments.reduce((sum, s) => sum + s.guestCount, 0).toLocaleString()}
              </div>
              <div className="text-sm text-slate-400">Segmented Guests</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search segments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-44 bg-slate-800 border-slate-700">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scopes</SelectItem>
            <SelectItem value="global">Global Templates</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
            <SelectItem value="campground">Campground</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSegments.map((segment) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            onEdit={handleEdit}
            onCopy={handleCopy}
            onArchive={handleArchive}
          />
        ))}
      </div>

      {filteredSegments.length === 0 && (
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No segments found</h3>
            <p className="text-slate-400 mb-4">
              {searchQuery || scopeFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first segment to start grouping guests"}
            </p>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Segment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
