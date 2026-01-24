"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Truck, Pencil, Trash2, Info, Ruler, Link2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsTable } from "@/components/settings/tables";
import { cn } from "@/lib/utils";

interface EquipmentType {
  id: string;
  name: string;
  requiresLength: boolean;
  requiresTow: boolean;
  bufferLength: number;
  isActive: boolean;
}

// Mock data based on domain knowledge
const initialEquipmentTypes: EquipmentType[] = [
  {
    id: "1",
    name: "Travel Trailer",
    requiresLength: true,
    requiresTow: true,
    bufferLength: 5,
    isActive: true,
  },
  {
    id: "2",
    name: "Fifth Wheel",
    requiresLength: true,
    requiresTow: true,
    bufferLength: 5,
    isActive: true,
  },
  {
    id: "3",
    name: "Class A Motorhome",
    requiresLength: true,
    requiresTow: false,
    bufferLength: 0,
    isActive: true,
  },
  {
    id: "4",
    name: "Class B Van",
    requiresLength: false,
    requiresTow: false,
    bufferLength: 0,
    isActive: true,
  },
  {
    id: "5",
    name: "Class C Motorhome",
    requiresLength: true,
    requiresTow: false,
    bufferLength: 0,
    isActive: true,
  },
  {
    id: "6",
    name: "Pop-up/Folding",
    requiresLength: false,
    requiresTow: true,
    bufferLength: 0,
    isActive: true,
  },
  {
    id: "7",
    name: "Toy Hauler",
    requiresLength: true,
    requiresTow: true,
    bufferLength: 5,
    isActive: true,
  },
  {
    id: "8",
    name: "Truck Camper",
    requiresLength: false,
    requiresTow: false,
    bufferLength: 0,
    isActive: true,
  },
  {
    id: "9",
    name: "Tent",
    requiresLength: false,
    requiresTow: false,
    bufferLength: 0,
    isActive: true,
  },
  {
    id: "10",
    name: "Vehicle Only",
    requiresLength: false,
    requiresTow: false,
    bufferLength: 0,
    isActive: true,
  },
];

export default function EquipmentTypesPage() {
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>(initialEquipmentTypes);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingType, setEditingType] = useState<EquipmentType | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRequiresLength, setFormRequiresLength] = useState(false);
  const [formRequiresTow, setFormRequiresTow] = useState(false);
  const [formBufferLength, setFormBufferLength] = useState(0);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormRequiresLength(false);
    setFormRequiresTow(false);
    setFormBufferLength(0);
    setEditingType(null);
  }, []);

  const openEditor = useCallback(
    (type: EquipmentType | null) => {
      if (type) {
        setEditingType(type);
        setFormName(type.name);
        setFormRequiresLength(type.requiresLength);
        setFormRequiresTow(type.requiresTow);
        setFormBufferLength(type.bufferLength);
      } else {
        resetForm();
      }
      setIsEditorOpen(true);
    },
    [resetForm],
  );

  const handleSave = useCallback(() => {
    if (!formName.trim()) return;

    const typeData = {
      name: formName.trim(),
      requiresLength: formRequiresLength,
      requiresTow: formRequiresTow,
      bufferLength: formBufferLength,
      isActive: true,
    };

    if (editingType) {
      setEquipmentTypes((prev) =>
        prev.map((t) => (t.id === editingType.id ? { ...t, ...typeData } : t)),
      );
    } else {
      const newType: EquipmentType = {
        ...typeData,
        id: Date.now().toString(),
      };
      setEquipmentTypes((prev) => [...prev, newType]);
    }

    setIsEditorOpen(false);
    resetForm();
  }, [editingType, formName, formRequiresLength, formRequiresTow, formBufferLength, resetForm]);

  const handleDelete = useCallback((id: string) => {
    setEquipmentTypes((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleToggleActive = useCallback((id: string) => {
    setEquipmentTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t)),
    );
  }, []);

  const columns = [
    {
      key: "name",
      label: "Equipment Type",
      render: (item: EquipmentType) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Truck className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-medium">{item.name}</span>
        </div>
      ),
    },
    {
      key: "requirements",
      label: "Requirements",
      render: (item: EquipmentType) => (
        <div className="flex flex-wrap gap-1">
          {item.requiresLength && (
            <Badge variant="outline" className="text-xs">
              <Ruler className="h-3 w-3 mr-1" />
              Length
            </Badge>
          )}
          {item.requiresTow && (
            <Badge variant="outline" className="text-xs">
              <Link2 className="h-3 w-3 mr-1" />
              Tow vehicle
            </Badge>
          )}
          {item.bufferLength > 0 && (
            <Badge variant="outline" className="text-xs">
              +{item.bufferLength}ft buffer
            </Badge>
          )}
          {!item.requiresLength && !item.requiresTow && (
            <span className="text-muted-foreground text-sm">None</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: EquipmentType) => (
        <Badge
          variant={item.isActive ? "default" : "secondary"}
          className={cn(
            item.isActive
              ? "bg-status-success/15 text-status-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          {item.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Equipment Types</h2>
          <p className="text-muted-foreground mt-1">
            Define RV and camping equipment types for site matching
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Equipment Type
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Equipment types help match guests to appropriate sites. When a guest specifies their RV
          type and length, the system ensures they're assigned to a compatible site. Buffer lengths
          are added to the RV length for towed vehicles.
        </AlertDescription>
      </Alert>

      {/* Table */}
      <SettingsTable
        data={equipmentTypes}
        columns={columns}
        searchPlaceholder="Search equipment types..."
        searchFields={["name"]}
        addLabel="Add Equipment Type"
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
                {item.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyState={{
          icon: Truck,
          title: "No equipment types",
          description: "Add equipment types to help match guests to appropriate sites",
        }}
      />

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Equipment Type" : "Add Equipment Type"}</DialogTitle>
            <DialogDescription>
              Configure equipment requirements for site matching
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Travel Trailer, Class A Motorhome"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label htmlFor="requires-length" className="font-medium">
                  Requires length
                </Label>
                <p className="text-sm text-muted-foreground">
                  Guest must provide RV/equipment length
                </p>
              </div>
              <Switch
                id="requires-length"
                checked={formRequiresLength}
                onCheckedChange={setFormRequiresLength}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label htmlFor="requires-tow" className="font-medium">
                  Has tow vehicle
                </Label>
                <p className="text-sm text-muted-foreground">
                  Guest is towing this with another vehicle
                </p>
              </div>
              <Switch
                id="requires-tow"
                checked={formRequiresTow}
                onCheckedChange={setFormRequiresTow}
              />
            </div>

            {formRequiresTow && (
              <div className="space-y-2 p-3 rounded-lg bg-muted">
                <Label htmlFor="buffer-length">Buffer length (feet)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="buffer-length"
                    type="number"
                    min={0}
                    max={20}
                    value={formBufferLength}
                    onChange={(e) => setFormBufferLength(parseInt(e.target.value) || 0)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    Added to total length for site matching
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim()}>
              {editingType ? "Save Changes" : "Add Equipment Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
