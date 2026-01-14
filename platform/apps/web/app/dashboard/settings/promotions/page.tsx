"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiClient } from "@/lib/api-client";
import { Plus, Pencil, Trash2, Percent, DollarSign, Tag, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

type Promotion = {
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
};

type PromotionFormData = {
    code: string;
    type: "percentage" | "flat";
    value: string;
    validFrom: string;
    validTo: string;
    usageLimit: string;
    isActive: boolean;
    description: string;
};

const defaultFormData: PromotionFormData = {
    code: "",
    type: "percentage",
    value: "",
    validFrom: "",
    validTo: "",
    usageLimit: "",
    isActive: true,
    description: ""
};

const isPromotionType = (value: string): value is PromotionFormData["type"] =>
    value === "percentage" || value === "flat";

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

export default function PromotionsSettingsPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [campgroundId, setCampgroundId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    const [formData, setFormData] = useState<PromotionFormData>(defaultFormData);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const cg = localStorage.getItem("campreserv:selectedCampground");
        setCampgroundId(cg);
        if (cg) {
            loadPromotions(cg);
        }
    }, []);

    const loadPromotions = async (cgId: string) => {
        setLoading(true);
        try {
            const data = await apiClient.getPromotions(cgId);
            setPromotions(data);
        } catch (err) {
            console.error(err);
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
            value: String(promo.value),
            validFrom: promo.validFrom ? promo.validFrom.split("T")[0] : "",
            validTo: promo.validTo ? promo.validTo.split("T")[0] : "",
            usageLimit: promo.usageLimit ? String(promo.usageLimit) : "",
            isActive: promo.isActive,
            description: promo.description || ""
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
                description: formData.description || undefined
            };

            if (editingPromotion) {
                await apiClient.updatePromotion(editingPromotion.id, payload, campgroundId);
            } else {
                await apiClient.createPromotion({ campgroundId, ...payload });
            }
            setIsModalOpen(false);
            loadPromotions(campgroundId);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to save promotion"));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!campgroundId) return;
        try {
            await apiClient.deletePromotion(id, campgroundId);
            if (campgroundId) loadPromotions(campgroundId);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleActive = async (promo: Promotion) => {
        if (!campgroundId) return;
        try {
            await apiClient.updatePromotion(promo.id, { isActive: !promo.isActive }, campgroundId);
            if (campgroundId) loadPromotions(campgroundId);
        } catch (err) {
            console.error(err);
        }
    };

    const formatValue = (promo: Promotion) => {
        if (promo.type === "percentage") {
            return `${promo.value}%`;
        }
        return `$${(promo.value / 100).toFixed(2)}`;
    };

    if (!campgroundId) {
        return (
            <div>
                <div className="text-center py-12 text-muted-foreground">
                    Please select a campground first.
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Promotions & Discounts</h1>
                        <p className="text-muted-foreground">Create and manage promo codes for your campground.</p>
                    </div>
                    <Button onClick={openCreateModal}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Promotion
                    </Button>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Skeleton className="h-12 w-12 rounded-lg" />
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Skeleton className="h-5 w-24" />
                                                    <Skeleton className="h-5 w-16 rounded-full" />
                                                </div>
                                                <Skeleton className="h-4 w-32" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Skeleton className="h-4 w-20" />
                                            <Skeleton className="h-6 w-10" />
                                            <Skeleton className="h-8 w-8" />
                                            <Skeleton className="h-8 w-8" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : promotions.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="font-semibold text-lg mb-2">No promotions yet</h3>
                            <p className="text-muted-foreground mb-4">
                                Create your first promo code to offer discounts to guests.
                            </p>
                            <Button onClick={openCreateModal}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Promotion
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {promotions.map((promo) => (
                            <Card key={promo.id} className={!promo.isActive ? "opacity-60" : ""}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-lg ${promo.type === "percentage"
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
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={promo.isActive}
                                                    onCheckedChange={() => toggleActive(promo)}
                                                />
                                                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEditModal(promo)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <ConfirmDialog
                                                    trigger={
                                                        <Button variant="ghost" size="icon" aria-label="Delete">
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    }
                                                    title="Delete promotion?"
                                                    description={`This will permanently remove the "${promo.code}" promotion code.`}
                                                    confirmLabel="Delete"
                                                    variant="destructive"
                                                    onConfirm={() => handleDelete(promo.id)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingPromotion ? "Edit Promotion" : "Create Promotion"}</DialogTitle>
                        <DialogDescription>
                            {editingPromotion ? "Update the promotion details." : "Create a new promo code for discounts."}
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
                                    onValueChange={(val) => {
                                        if (isPromotionType(val)) {
                                            setFormData({ ...formData, type: val });
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
                            <Label>{formData.type === "percentage" ? "Discount Percentage" : "Discount Amount ($)"}</Label>
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
                            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
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
        </div>
    );
}
