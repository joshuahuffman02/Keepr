"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Button } from "../../../components/ui/button";
import { apiClient } from "../../../lib/api-client";
import { Plus, Pencil, Trash2, Package, ShoppingBag, Users, Moon, MapPin } from "lucide-react";

type UpsellItem = {
  id: string;
  campgroundId: string;
  name: string;
  description: string | null;
  priceType: "flat" | "per_night" | "per_guest" | "per_site";
  priceCents: number;
  siteClassId: string | null;
  taxCode: string | null;
  inventoryTracking: boolean;
  inventoryQty: number | null;
  active: boolean;
};

type SiteClass = { id: string; name: string };

type FormData = {
  name: string;
  description: string;
  priceType: "flat" | "per_night" | "per_guest" | "per_site";
  priceCents: string;
  siteClassId: string;
  taxCode: string;
  inventoryTracking: boolean;
  inventoryQty: string;
  active: boolean;
};

const defaultFormData: FormData = {
  name: "",
  description: "",
  priceType: "flat",
  priceCents: "",
  siteClassId: "",
  taxCode: "",
  inventoryTracking: false,
  inventoryQty: "",
  active: true,
};

const priceTypeLabels: Record<string, { label: string; icon: typeof Package; description: string }> = {
  flat: { label: "Flat", icon: Package, description: "One-time charge" },
  per_night: { label: "Per Night", icon: Moon, description: "Charged each night" },
  per_guest: { label: "Per Guest", icon: Users, description: "Charged per person" },
  per_site: { label: "Per Site", icon: MapPin, description: "Charged per site" },
};

export default function UpsellsPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UpsellItem | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const cg = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(cg);
  }, []);

  const itemsQuery = useQuery({
    queryKey: ["upsell-items", campgroundId],
    queryFn: () => apiClient.getUpsellItems(campgroundId!),
    enabled: !!campgroundId,
  });

  const siteClassesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId!),
    enabled: !!campgroundId,
  });

  const infoBanner = (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
      <div className="font-semibold">Upsells vs POS</div>
      <p className="mt-1">
        Upsells here power booking extras and guest portal add-ons. Store/POS items are separate today; unified catalog and sync are on the roadmap.
      </p>
    </div>
  );

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createUpsellItem>[1]) =>
      apiClient.createUpsellItem(campgroundId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upsell-items", campgroundId] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiClient.updateUpsellItem>[1] }) =>
      apiClient.updateUpsellItem(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upsell-items", campgroundId] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteUpsellItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upsell-items", campgroundId] });
    },
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(defaultFormData);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: UpsellItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      priceType: item.priceType,
      priceCents: String(item.priceCents / 100),
      siteClassId: item.siteClassId || "",
      taxCode: item.taxCode || "",
      inventoryTracking: item.inventoryTracking,
      inventoryQty: item.inventoryQty ? String(item.inventoryQty) : "",
      active: item.active,
    });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData(defaultFormData);
    setError(null);
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.priceCents || parseFloat(formData.priceCents) <= 0) {
      setError("Price is required");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      priceType: formData.priceType,
      priceCents: Math.round(parseFloat(formData.priceCents) * 100),
      siteClassId: formData.siteClassId || null,
      taxCode: formData.taxCode.trim() || null,
      inventoryTracking: formData.inventoryTracking,
      inventoryQty: formData.inventoryTracking && formData.inventoryQty
        ? parseInt(formData.inventoryQty)
        : null,
      active: formData.active,
    };

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save");
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this upsell item?")) return;
    await deleteMutation.mutateAsync(id);
  };

  const formatPrice = (item: UpsellItem) => {
    const price = `$${(item.priceCents / 100).toFixed(2)}`;
    switch (item.priceType) {
      case "flat":
        return price;
      case "per_night":
        return `${price}/night`;
      case "per_guest":
        return `${price}/guest`;
      case "per_site":
        return `${price}/site`;
    }
  };

  const getSiteClassName = (id: string | null) => {
    if (!id) return "All Site Classes";
    const sc = siteClassesQuery.data?.find((c: SiteClass) => c.id === id);
    return sc?.name || id;
  };

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="text-center py-12 text-muted-foreground">
          Please select a campground first.
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {infoBanner}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Upsells & Add-ons</h1>
            <p className="text-muted-foreground">
              Configure optional add-ons guests can purchase during checkout.
            </p>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        {itemsQuery.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : itemsQuery.data?.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
            <ShoppingBag className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No upsell items yet</h3>
            <p className="mt-2 text-muted-foreground">
              Create add-ons like firewood, kayak rentals, or early check-in.
            </p>
            <Button className="mt-4" onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Item
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {itemsQuery.data?.map((item) => {
              const PriceIcon = priceTypeLabels[item.priceType]?.icon || Package;
              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 ${item.active ? "bg-white" : "bg-slate-50 opacity-60"}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${item.active ? "bg-purple-100 text-purple-700" : "bg-slate-200 text-slate-500"}`}>
                      <PriceIcon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900">{item.name}</h3>
                    {!item.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Inactive
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
                  )}

                  <div className="text-lg font-bold text-slate-900">{formatPrice(item)}</div>

                  <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                    <div>{priceTypeLabels[item.priceType]?.label}</div>
                    <div>{getSiteClassName(item.siteClassId)}</div>
                    {item.inventoryTracking && (
                      <div className={item.inventoryQty && item.inventoryQty < 5 ? "text-amber-600 font-medium" : ""}>
                        {item.inventoryQty !== null ? `${item.inventoryQty} in stock` : "Tracking enabled"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {editingItem ? "Edit Upsell Item" : "Create Upsell Item"}
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g., Firewood Bundle"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none"
                  placeholder="Optional description shown to guests"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pricing Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(priceTypeLabels).map(([key, val]) => {
                    const Icon = val.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({ ...formData, priceType: key as FormData["priceType"] })}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          formData.priceType === key
                            ? "border-purple-500 bg-purple-50 text-purple-700"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <Icon className="h-4 w-4 mb-1" />
                        <div className="text-sm font-medium">{val.label}</div>
                        <div className="text-xs text-muted-foreground">{val.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g., 12.00"
                  value={formData.priceCents}
                  onChange={(e) => setFormData({ ...formData, priceCents: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Class</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={formData.siteClassId}
                  onChange={(e) => setFormData({ ...formData, siteClassId: e.target.value })}
                >
                  <option value="">Available for all site classes</option>
                  {siteClassesQuery.data?.map((sc: SiteClass) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax Code</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g., SERVICES or leave blank"
                  value={formData.taxCode}
                  onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="inventoryTracking"
                    checked={formData.inventoryTracking}
                    onChange={(e) => setFormData({ ...formData, inventoryTracking: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="inventoryTracking" className="text-sm text-slate-700">
                    Track inventory
                  </label>
                </div>

                {formData.inventoryTracking && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantity in Stock</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="e.g., 50"
                      value={formData.inventoryQty}
                      onChange={(e) => setFormData({ ...formData, inventoryQty: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="active" className="text-sm text-slate-700">Active (show to guests)</label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : editingItem ? "Save Changes" : "Create Item"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

