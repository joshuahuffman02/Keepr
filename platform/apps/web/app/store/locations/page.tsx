"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  Store,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Star,
  MapPin,
  Monitor,
  Globe,
  Package,
  DollarSign,
} from "lucide-react";
import { cn } from "../../../lib/utils";

type StoreLocation = Awaited<ReturnType<typeof apiClient.getStoreLocations>>[0];
type StoreLocationType = "physical" | "virtual";
type StoreLocationFormData = {
  name: string;
  code: string;
  type: StoreLocationType;
  isDefault: boolean;
  acceptsOnline: boolean;
};

export default function StoreLocationsPage() {
  const queryClient = useQueryClient();
  const [selectedCg, setSelectedCg] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StoreLocation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StoreLocation | null>(null);

  // Form state
  const [formData, setFormData] = useState<StoreLocationFormData>({
    name: "",
    code: "",
    type: "physical",
    isDefault: false,
    acceptsOnline: false,
  });

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["store-locations", selectedCg, showInactive],
    queryFn: () => apiClient.getStoreLocations(selectedCg, showInactive),
    enabled: !!selectedCg,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.createStoreLocation(selectedCg, { ...data, campgroundId: selectedCg }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-locations"] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<typeof formData> & { isActive?: boolean };
    }) => apiClient.updateStoreLocation(id, data, selectedCg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-locations"] });
      setEditingLocation(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteStoreLocation(id, selectedCg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-locations"] });
      setDeleteConfirm(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      type: "physical",
      isDefault: false,
      acceptsOnline: false,
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) {
      setSelectedCg(stored);
    } else if (campgrounds.length > 0) {
      setSelectedCg(campgrounds[0].id);
    }
  }, [campgrounds]);

  useEffect(() => {
    if (editingLocation) {
      setFormData({
        name: editingLocation.name,
        code: editingLocation.code || "",
        type: editingLocation.type,
        isDefault: editingLocation.isDefault,
        acceptsOnline: editingLocation.acceptsOnline,
      });
    }
  }, [editingLocation]);

  const handleSubmit = () => {
    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Store Locations</h1>
            <p className="text-muted-foreground">
              Manage physical and virtual store locations for inventory and POS.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">All Locations</CardTitle>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                Show inactive
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading locations...</div>
            ) : locations.length === 0 ? (
              <div className="text-center py-8">
                <Store className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">
                  No store locations yet. Create your first location to get started.
                </p>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Location
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border",
                      !location.isActive && "bg-muted/60 opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          location.type === "physical" ? "bg-status-info/15" : "bg-primary/10",
                        )}
                      >
                        {location.type === "physical" ? (
                          <MapPin className="w-5 h-5 text-status-info" />
                        ) : (
                          <Globe className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{location.name}</span>
                          {location.code && (
                            <Badge variant="outline" className="text-xs">
                              {location.code}
                            </Badge>
                          )}
                          {location.isDefault && (
                            <Badge className="bg-status-warning/15 text-status-warning hover:bg-status-warning/15">
                              <Star className="w-3 h-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          {!location.isActive && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          {location.acceptsOnline && (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5" />
                              Online orders
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Monitor className="w-3.5 h-3.5" />
                            {location._count?.terminals ?? 0} terminals
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {location._count?.locationInventory ?? 0} products
                          </span>
                          {(location._count?.priceOverrides ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5" />
                              {location._count?.priceOverrides} price overrides
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Open actions for ${location.name}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingLocation(location)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {!location.isDefault && (
                          <DropdownMenuItem
                            onClick={() =>
                              updateMutation.mutate({
                                id: location.id,
                                data: { isDefault: true },
                              })
                            }
                          >
                            <Star className="w-4 h-4 mr-2" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            updateMutation.mutate({
                              id: location.id,
                              data: { isActive: !location.isActive },
                            })
                          }
                        >
                          {location.isActive ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        {!location.isDefault && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirm(location)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || !!editingLocation}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingLocation(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Edit Location" : "Create Location"}</DialogTitle>
            <DialogDescription>
              {editingLocation
                ? "Update the details for this store location."
                : "Add a new physical or virtual store location."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Location Name</Label>
              <Input
                id="name"
                placeholder="e.g., Pool Bar, Camp Store"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Short Code (optional)</Label>
              <Input
                id="code"
                placeholder="e.g., PB, CS"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                maxLength={4}
              />
              <p className="text-xs text-muted-foreground">A short code for receipts and reports</p>
            </div>
            <div className="space-y-2">
              <Label>Location Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.type === "physical" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, type: "physical" })}
                  aria-pressed={formData.type === "physical"}
                  className="flex-1"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Physical
                </Button>
                <Button
                  type="button"
                  variant={formData.type === "virtual" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, type: "virtual" })}
                  aria-pressed={formData.type === "virtual"}
                  className="flex-1"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Virtual
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="acceptsOnline">Accepts Online Orders</Label>
                <p className="text-xs text-muted-foreground">
                  This location can fulfill orders placed online
                </p>
              </div>
              <Switch
                id="acceptsOnline"
                checked={formData.acceptsOnline}
                onCheckedChange={(checked) => setFormData({ ...formData, acceptsOnline: checked })}
              />
            </div>
            {!editingLocation && (
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isDefault">Set as Default</Label>
                  <p className="text-xs text-muted-foreground">
                    Make this the default location for new terminals
                  </p>
                </div>
                <Switch
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingLocation(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingLocation
                  ? "Save Changes"
                  : "Create Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteConfirm?.name}&rdquo;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
