"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tag,
  Plus,
  Loader2,
  Info,
  Percent,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";

interface Promotion {
  id: string;
  campgroundId: string;
  code: string;
  type: "percentage" | "flat";
  value: number;
  validFrom: string | null;
  validTo: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PromotionFormData {
  code: string;
  type: "percentage" | "flat";
  value: string;
  validFrom: string;
  validTo: string;
  usageLimit: string;
  isActive: boolean;
  description: string;
}

const isPromotionType = (value: string): value is PromotionFormData["type"] =>
  value === "percentage" || value === "flat";

const defaultFormData: PromotionFormData = {
  code: "",
  type: "percentage",
  value: "",
  validFrom: "",
  validTo: "",
  usageLimit: "",
  isActive: true,
  description: "",
};

export default function PromotionsPage() {
  const [loading, setLoading] = useState(true);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState<PromotionFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    loadPromotions(id);
  }, []);

  const loadPromotions = async (id: string) => {
    try {
      const data = await apiClient.getPromotions(id);
      setPromotions(data);
    } catch (err) {
      console.error("Failed to load promotions:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPromotion(null);
    setFormData(defaultFormData);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promotion) => {
    setEditingPromotion(promo);
    setFormData({
      code: promo.code,
      type: promo.type,
      value: String(promo.type === "percentage" ? promo.value : promo.value / 100),
      validFrom: promo.validFrom ? promo.validFrom.split("T")[0] : "",
      validTo: promo.validTo ? promo.validTo.split("T")[0] : "",
      usageLimit: promo.usageLimit ? String(promo.usageLimit) : "",
      isActive: promo.isActive,
      description: promo.description || "",
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!campgroundId) return;
    if (!formData.code.trim()) {
      setError("Promo code is required");
      return;
    }
    if (!formData.value || Number(formData.value) <= 0) {
      setError("Value must be greater than 0");
      return;
    }
    if (formData.type === "percentage" && Number(formData.value) > 100) {
      setError("Percentage cannot exceed 100");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: formData.code.toUpperCase().trim(),
        type: formData.type,
        value: formData.type === "percentage" ? Number(formData.value) : Math.round(Number(formData.value) * 100),
        validFrom: formData.validFrom || undefined,
        validTo: formData.validTo || undefined,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : undefined,
        isActive: formData.isActive,
        description: formData.description || undefined,
      };

      if (editingPromotion) {
        await apiClient.updatePromotion(editingPromotion.id, payload, campgroundId);
      } else {
        await apiClient.createPromotion({ campgroundId, ...payload });
      }
      setIsModalOpen(false);
      loadPromotions(campgroundId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save promotion";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePromotion = async () => {
    if (!deleteConfirmId || !campgroundId) return;
    try {
      await apiClient.deletePromotion(deleteConfirmId, campgroundId);
      if (campgroundId) loadPromotions(campgroundId);
    } catch (err) {
      console.error("Failed to delete promotion:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleToggle = async (promo: Promotion) => {
    if (!campgroundId) return;
    try {
      await apiClient.updatePromotion(promo.id, { isActive: !promo.isActive }, campgroundId);
      if (campgroundId) loadPromotions(campgroundId);
    } catch (err) {
      console.error("Failed to toggle promotion:", err);
    }
  };

  const handleDuplicate = async (promo: Promotion) => {
    if (!campgroundId) return;
    try {
      await apiClient.createPromotion({
        campgroundId,
        code: `${promo.code}_COPY`,
        type: promo.type,
        value: promo.value,
        validFrom: promo.validFrom || undefined,
        validTo: promo.validTo || undefined,
        usageLimit: promo.usageLimit || undefined,
        isActive: false,
        description: promo.description || undefined,
      });
      loadPromotions(campgroundId);
    } catch (err) {
      console.error("Failed to duplicate promotion:", err);
    }
  };

  const formatValue = (promo: Promotion) => {
    if (promo.type === "percentage") {
      return `${promo.value}%`;
    }
    return `$${(promo.value / 100).toFixed(2)}`;
  };

  const activeCount = promotions.filter((p) => p.isActive).length;

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Promotions</h2>
          <p className="text-muted-foreground mt-1">
            Create promo codes and special offers
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!campgroundId) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Promotions</h2>
          <p className="text-muted-foreground mt-1">
            Create promo codes and special offers
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <Info className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-muted-foreground">Please select a campground first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Promotions</h2>
          <p className="text-muted-foreground mt-1">
            Create promo codes and special offers
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Create Promotion
        </Button>
      </div>

      {/* Info */}
      <Alert className="bg-amber-50 border-amber-200">
        <Tag className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Promo codes can be applied during booking to give guests discounts.
          Set expiration dates and usage limits to control availability.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Tag className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{promotions.length}</p>
                <p className="text-sm text-muted-foreground">Total Promotions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-success/15">
                <Tag className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-info/15">
                <DollarSign className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {promotions.reduce((sum, p) => sum + p.usageCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Uses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promotions List */}
      {promotions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No promotions yet
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Create promo codes to offer discounts to your guests.
              Perfect for seasonal specials, returning customers, or marketing campaigns.
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Promotion
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promotions.map((promo) => (
            <Card key={promo.id} className={!promo.isActive ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={promo.isActive}
                      onCheckedChange={() => handleToggle(promo)}
                    />
                    <div className={`p-3 rounded-lg ${
                      promo.type === "percentage"
                        ? "bg-status-info/15 text-status-info"
                        : "bg-status-success/15 text-status-success"
                    }`}>
                      {promo.type === "percentage" ? (
                        <Percent className="h-5 w-5" />
                      ) : (
                        <DollarSign className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg">{promo.code}</span>
                        <Badge variant={promo.isActive ? "default" : "secondary"}>
                          {promo.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="font-semibold text-foreground">{formatValue(promo)}</span> off
                        {promo.description && ` • ${promo.description}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-sm text-right">
                      <div className="text-muted-foreground">
                        {promo.usageLimit ? (
                          <span>{promo.usageCount} / {promo.usageLimit} used</span>
                        ) : (
                          <span>{promo.usageCount} uses</span>
                        )}
                      </div>
                      {(promo.validFrom || promo.validTo) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {promo.validFrom && format(new Date(promo.validFrom), "MMM d, yyyy")}
                          {promo.validFrom && promo.validTo && " - "}
                          {promo.validTo && format(new Date(promo.validTo), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="More options" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(promo)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(promo)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteConfirmId(promo.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingPromotion ? "Edit Promotion" : "Create Promotion"}
            </DialogTitle>
            <DialogDescription>
              {editingPromotion
                ? "Update the promotion details."
                : "Create a new promo code for discounts."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Promo Code</Label>
                <Input
                  placeholder="e.g. SUMMER20"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => {
                    if (isPromotionType(value)) {
                      setFormData({ ...formData, type: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                {formData.type === "percentage" ? "Discount Percentage" : "Discount Amount ($)"}
              </Label>
              <Input
                type="number"
                min="0"
                max={formData.type === "percentage" ? "100" : undefined}
                placeholder={formData.type === "percentage" ? "e.g. 20" : "e.g. 25.00"}
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From (Optional)</Label>
                <Input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid To (Optional)</Label>
                <Input
                  type="date"
                  value={formData.validTo}
                  onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Usage Limit (Optional)</Label>
              <Input
                type="number"
                min="1"
                placeholder="Leave empty for unlimited"
                value={formData.usageLimit}
                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                placeholder="e.g. Summer sale discount"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this promotion? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePromotion}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
