"use client";

import { useState, useCallback } from "react";
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
    color: "bg-blue-100 text-blue-800",
    description: "Entry gate access",
  },
  cabin: {
    label: "Cabin Lock",
    icon: Lock,
    color: "bg-amber-100 text-amber-800",
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
    color: "bg-emerald-100 text-emerald-800",
    description: "Network access",
  },
  master: {
    label: "Master Code",
    icon: Shield,
    color: "bg-red-100 text-red-800",
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

const mockCodes: LockCode[] = [
  {
    id: "1",
    name: "Main Gate",
    code: "1234",
    type: "gate",
    appliesTo: ["All Sites"],
    rotationSchedule: "monthly",
    showOnConfirmation: true,
    showAtCheckin: true,
    isActive: true,
    lastRotated: "2025-12-01",
  },
  {
    id: "2",
    name: "Pool Gate",
    code: "5678",
    type: "amenity",
    appliesTo: ["Pool"],
    rotationSchedule: "weekly",
    showOnConfirmation: false,
    showAtCheckin: true,
    isActive: true,
    lastRotated: "2025-12-23",
  },
  {
    id: "3",
    name: "Campground WiFi",
    code: "CampHappy2025!",
    type: "wifi",
    appliesTo: ["Guest WiFi"],
    rotationSchedule: "monthly",
    showOnConfirmation: true,
    showAtCheckin: true,
    isActive: true,
  },
  {
    id: "4",
    name: "Cabin A1 Lock",
    code: "4521",
    type: "cabin",
    appliesTo: ["Cabin A1"],
    rotationSchedule: "per-guest",
    showOnConfirmation: false,
    showAtCheckin: true,
    isActive: true,
  },
  {
    id: "5",
    name: "Staff Master",
    code: "9999",
    type: "master",
    appliesTo: ["All Locks"],
    rotationSchedule: "none",
    showOnConfirmation: false,
    showAtCheckin: false,
    isActive: true,
  },
];

export default function LockCodesPage() {
  const [codes, setCodes] = useState<LockCode[]>(mockCodes);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<LockCode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      setCodes((prev) =>
        prev.map((c) =>
          c.id === editingCode.id ? { ...c, ...codeData } : c
        )
      );
    } else {
      const newCode: LockCode = {
        ...codeData,
        id: Date.now().toString(),
      };
      setCodes((prev) => [...prev, newCode]);
    }

    setIsEditorOpen(false);
    resetForm();
  }, [editingCode, formName, formCode, formType, formRotation, formShowConfirmation, formShowCheckin, resetForm]);

  const handleDelete = useCallback((id: string) => {
    setCodes((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleToggleActive = useCallback((id: string) => {
    setCodes((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isActive: !c.isActive } : c
      )
    );
  }, []);

  const handleRotateCode = useCallback((id: string) => {
    // Generate a new random code
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setCodes((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, code: newCode, lastRotated: new Date().toISOString().split("T")[0] }
          : c
      )
    );
  }, []);

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
      key: "code",
      label: "Code",
      render: (item: LockCode) => (
        <div className="flex items-center gap-2">
          <code className="px-2 py-1 rounded bg-slate-100 font-mono text-sm">
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
              <Copy className="h-3 w-3 text-slate-400" />
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
          <p className="text-slate-900">{rotationLabels[item.rotationSchedule]}</p>
          {item.lastRotated && (
            <p className="text-slate-500 text-xs">
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
            <span className="text-slate-400 text-sm">Staff only</span>
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
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          )}
        >
          {item.isActive ? "Active" : "Disabled"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Lock Codes</h2>
          <p className="text-slate-500 mt-1">
            Manage gate codes, WiFi passwords, and facility access codes
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Lock Code
        </Button>
      </div>

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
                <DropdownMenuItem onClick={() => handleRotateCode(item.id)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rotate Now
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleToggleActive(item.id)}>
                {item.isActive ? "Disable" : "Enable"}
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
          icon: Key,
          title: "No lock codes",
          description: "Add codes for gates, cabins, WiFi, and amenities",
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
                          <span className="text-slate-400 ml-2 text-xs">
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
              <p className="text-xs text-slate-500">
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
                  <p className="text-sm text-slate-500">
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
                  <p className="text-sm text-slate-500">
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
              disabled={!formName.trim() || !formCode.trim()}
            >
              {editingCode ? "Save Changes" : "Add Lock Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
