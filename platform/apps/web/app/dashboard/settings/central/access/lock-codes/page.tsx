"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Key,
  Info,
  Pencil,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Copy,
  Check,
  Lock,
  DoorOpen,
  Wifi,
  Shield,
  AlertTriangle,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useCampground } from "@/contexts/CampgroundContext";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface LockCode {
  id: string;
  name: string;
  code: string;
  type: "gate" | "cabin" | "amenity" | "wifi" | "master";
  appliesTo: string[];
  rotationSchedule: "none" | "daily" | "weekly" | "monthly" | "per-guest";
  showOnConfirmation: boolean;
  showAtCheckin: boolean;
  isActive: boolean;
  lastRotated?: string;
}

const typeConfig = {
  gate: {
    label: "Gate Code",
    icon: DoorOpen,
    color: "bg-status-info/15 text-status-info",
    description: "Entry gate access",
  },
  cabin: {
    label: "Cabin Lock",
    icon: Lock,
    color: "bg-status-warning/15 text-status-warning",
    description: "Cabin door codes",
  },
  amenity: {
    label: "Amenity Access",
    icon: Key,
    color: "bg-purple-100 text-purple-800",
    description: "Pool, laundry, etc.",
  },
  wifi: {
    label: "WiFi Password",
    icon: Wifi,
    color: "bg-status-success/15 text-status-success",
    description: "Network access",
  },
  master: {
    label: "Master Code",
    icon: Shield,
    color: "bg-status-error/15 text-status-error",
    description: "Staff only",
  },
};

const rotationLabels = {
  none: "Never",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  "per-guest": "Per Guest",
};

// API functions
const fetchLockCodes = async (campgroundId: string): Promise<LockCode[]> => {
  const response = await fetch(`${API_BASE}/campgrounds/${campgroundId}/lock-codes`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch lock codes');
  const data = await response.json();
  // Transform backend data to frontend format
  return data.map((item: any) => ({
    id: item.id,
    name: item.name,
    code: item.code,
    type: item.type,
    appliesTo: item.appliesTo || [],
    rotationSchedule: item.rotationSchedule?.replace('_', '-') || 'none',
    showOnConfirmation: item.showOnConfirmation,
    showAtCheckin: item.showAtCheckin,
    isActive: item.isActive,
    lastRotated: item.lastRotatedAt,
  }));
};

const createLockCode = async (campgroundId: string, data: Partial<LockCode>): Promise<LockCode> => {
  const response = await fetch(`${API_BASE}/campgrounds/${campgroundId}/lock-codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      ...data,
      rotationSchedule: data.rotationSchedule?.replace('-', '_') || 'none',
    }),
  });
  if (!response.ok) throw new Error('Failed to create lock code');
  return response.json();
};

const updateLockCode = async (campgroundId: string, id: string, data: Partial<LockCode>): Promise<LockCode> => {
  const payload: Record<string, unknown> = { ...data };
  if (payload.rotationSchedule && typeof payload.rotationSchedule === 'string') {
    payload.rotationSchedule = payload.rotationSchedule.replace('-', '_');
  }
  const response = await fetch(`${API_BASE}/campgrounds/${campgroundId}/lock-codes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to update lock code');
  return response.json();
};

const deleteLockCode = async (campgroundId: string, id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/campgrounds/${campgroundId}/lock-codes/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to delete lock code');
};

const rotateLockCode = async (campgroundId: string, id: string): Promise<LockCode> => {
  const response = await fetch(`${API_BASE}/campgrounds/${campgroundId}/lock-codes/${id}/rotate`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to rotate lock code');
  return response.json();
};

export default function LockCodesPage() {
  const { selectedCampground, isHydrated } = useCampground();
  const campgroundId = selectedCampground?.id || null;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<LockCode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rotateConfirmId, setRotateConfirmId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch lock codes from API
  const { data: codes = [], isLoading, error } = useQuery({
    queryKey: ["lock-codes", campgroundId],
    queryFn: () => fetchLockCodes(campgroundId!),
    enabled: isHydrated && !!campgroundId,
  });

  // Form state
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<LockCode["type"]>("gate");
  const [formRotation, setFormRotation] = useState<LockCode["rotationSchedule"]>("none");
  const [formShowConfirmation, setFormShowConfirmation] = useState(true);
  const [formShowCheckin, setFormShowCheckin] = useState(true);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormCode("");
    setFormType("gate");
    setFormRotation("none");
    setFormShowConfirmation(true);
    setFormShowCheckin(true);
    setEditingCode(null);
  }, []);

  const openEditor = useCallback((code: LockCode | null) => {
    if (code) {
      setEditingCode(code);
      setFormName(code.name);
      setFormCode(code.code);
      setFormType(code.type);
      setFormRotation(code.rotationSchedule);
      setFormShowConfirmation(code.showOnConfirmation);
      setFormShowCheckin(code.showAtCheckin);
    } else {
      resetForm();
    }
    setIsEditorOpen(true);
  }, [resetForm]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<LockCode>) => createLockCode(campgroundId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lock-codes", campgroundId] });
      toast({ title: "Lock code created successfully" });
      setIsEditorOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create lock code", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LockCode> }) =>
      updateLockCode(campgroundId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lock-codes", campgroundId] });
      toast({ title: "Lock code updated successfully" });
      setIsEditorOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update lock code", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLockCode(campgroundId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lock-codes", campgroundId] });
      toast({ title: "Lock code deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete lock code", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => rotateLockCode(campgroundId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lock-codes", campgroundId] });
      toast({ title: "Lock code rotated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to rotate lock code", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSave = useCallback(() => {
    if (!formName.trim() || !formCode.trim()) return;

    const codeData = {
      name: formName.trim(),
      code: formCode.trim(),
      type: formType,
      appliesTo: editingCode?.appliesTo || [],
      rotationSchedule: formRotation,
      showOnConfirmation: formShowConfirmation,
      showAtCheckin: formShowCheckin,
      isActive: true,
    };

    if (editingCode) {
      updateMutation.mutate({ id: editingCode.id, data: codeData });
    } else {
      createMutation.mutate(codeData);
    }
  }, [editingCode, formName, formCode, formType, formRotation, formShowConfirmation, formShowCheckin, createMutation, updateMutation]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleToggleActive = useCallback((code: LockCode) => {
    updateMutation.mutate({
      id: code.id,
      data: { isActive: !code.isActive },
    });
  }, [updateMutation]);

  const handleRotateCode = useCallback((id: string) => {
    rotateMutation.mutate(id);
  }, [rotateMutation]);

  const handleCopyCode = useCallback((id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const generateRandomCode = () => {
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setFormCode(newCode);
  };

  const columns = [
    {
      key: "name",
      label: "Lock Code",
      render: (item: LockCode) => {
        const config = typeConfig[item.type];
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
      key: "code",
      label: "Code",
      render: (item: LockCode) => (
        <div className="flex items-center gap-2">
          <code className="px-2 py-1 rounded bg-muted font-mono text-sm">
            {item.type === "master" ? "••••" : item.code}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleCopyCode(item.id, item.code)}
          >
            {copiedId === item.id ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>
      ),
    },
    {
      key: "rotation",
      label: "Rotation",
      render: (item: LockCode) => (
        <div className="text-sm">
          <p className="text-foreground">{rotationLabels[item.rotationSchedule]}</p>
          {item.lastRotated && (
            <p className="text-muted-foreground text-xs">
              Last: {new Date(item.lastRotated).toLocaleDateString()}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "visibility",
      label: "Shown On",
      render: (item: LockCode) => (
        <div className="flex flex-wrap gap-1">
          {item.showOnConfirmation && (
            <Badge variant="secondary" className="text-xs">
              Confirmation
            </Badge>
          )}
          {item.showAtCheckin && (
            <Badge variant="secondary" className="text-xs">
              Check-in
            </Badge>
          )}
          {!item.showOnConfirmation && !item.showAtCheckin && (
            <span className="text-muted-foreground text-sm">Staff only</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: LockCode) => (
        <Badge
          variant={item.isActive ? "default" : "secondary"}
          className={cn(
            item.isActive
              ? "bg-status-success/15 text-status-success"
              : "bg-muted text-muted-foreground"
          )}
        >
          {item.isActive ? "Active" : "Disabled"}
        </Badge>
      ),
    },
  ];

  if (!isHydrated || !campgroundId || isLoading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load lock codes. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Lock Codes</h2>
          <p className="text-muted-foreground mt-1">
            Manage gate codes, WiFi passwords, and facility access codes
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Lock Code
        </Button>
      </div>

      {/* Security Warning for Development */}
      <Alert className="bg-amber-50 border-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-800">
          <strong>Security Notice:</strong> Lock codes are now fetched from the backend API. 
          Never hardcode credentials in the frontend code. All access codes should be stored 
          securely in the database with proper encryption and access controls.
        </AlertDescription>
      </Alert>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Lock codes can be automatically included in confirmation emails and check-in instructions.
          Set rotation schedules to automatically generate new codes for security.
        </AlertDescription>
      </Alert>

      {/* Table */}
      <SettingsTable
        data={codes}
        columns={columns}
        searchPlaceholder="Search lock codes..."
        searchFields={["name"]}
        addLabel="Add Lock Code"
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
              <DropdownMenuItem onClick={() => handleCopyCode(item.id, item.code)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </DropdownMenuItem>
              {item.rotationSchedule !== "none" && (
                <DropdownMenuItem onClick={() => setRotateConfirmId(item.id)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rotate Now
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleToggleActive(item)}>
                {item.isActive ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteConfirmId(item.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyState={{
          icon: Key,
          title: "No lock codes configured",
          description: "Add codes for gates, cabins, WiFi, and amenities to get started. Lock codes should be configured through the backend API for security.",
        }}
      />

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? "Edit Lock Code" : "Add Lock Code"}
            </DialogTitle>
            <DialogDescription>
              Configure access codes for your property
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Main Gate, Pool Access"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as LockCode["type"])}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        <div>
                          <span>{config.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {config.description}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  placeholder="Enter code"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateRandomCode}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rotation">Rotation Schedule</Label>
              <Select value={formRotation} onValueChange={(v) => setFormRotation(v as LockCode["rotationSchedule"])}>
                <SelectTrigger id="rotation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rotationLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Per Guest generates a unique code for each reservation
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium">Show Code On</Label>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label htmlFor="show-confirmation" className="font-normal">
                    Confirmation Email
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Include in booking confirmation
                  </p>
                </div>
                <Switch
                  id="show-confirmation"
                  checked={formShowConfirmation}
                  onCheckedChange={setFormShowConfirmation}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label htmlFor="show-checkin" className="font-normal">
                    Check-in Instructions
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show during self check-in
                  </p>
                </div>
                <Switch
                  id="show-checkin"
                  checked={formShowCheckin}
                  onCheckedChange={setFormShowCheckin}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formName.trim() || !formCode.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingCode ? "Save Changes" : "Add Lock Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Lock Code Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lock Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this lock code? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  handleDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Lock Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rotate Lock Code Confirmation */}
      <AlertDialog open={!!rotateConfirmId} onOpenChange={(open) => !open && setRotateConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate Lock Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rotate this lock code? This will generate a new code and the old code will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rotateConfirmId) {
                  handleRotateCode(rotateConfirmId);
                  setRotateConfirmId(null);
                }
              }}
            >
              Rotate Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
