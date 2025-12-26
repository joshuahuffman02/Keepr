"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { useToast } from "../ui/use-toast";
import { cn } from "../../lib/utils";
import {
    Package, Plus, Trash2, Percent, DollarSign, Tag, Sparkles,
    Check, Gift, Loader2, Edit2
} from "lucide-react";

type Activity = {
    id: string;
    name: string;
    price: number;
    duration?: number;
    imageUrl?: string | null;
};

type BundleItemActivity = {
    id: string;
    name: string;
    price: number;
};

type Bundle = {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    discountType: string;
    discountValue?: number | null;
    isActive: boolean;
    items: Array<{
        id: string;
        activityId?: string;
        quantity?: number;
        activity: BundleItemActivity;
    }>;
};

interface BundlesManagerProps {
    campgroundId: string;
    activities: Activity[];
}

export function BundlesManager({ campgroundId, activities }: BundlesManagerProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);

    const [newBundle, setNewBundle] = useState({
        name: "",
        description: "",
        discountType: "percent" as "percent" | "fixed",
        discountValue: "15",
        selectedActivities: [] as string[]
    });

    const { data: bundles, isLoading } = useQuery<Bundle[]>({
        queryKey: ["bundles", campgroundId],
        queryFn: () => apiClient.getActivityBundles(campgroundId),
        enabled: !!campgroundId
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            // Calculate total price of selected activities
            const selectedActivitiesData = activities.filter(a =>
                newBundle.selectedActivities.includes(a.id)
            );
            const totalPrice = selectedActivitiesData.reduce((sum, a) => sum + a.price, 0);

            // Calculate discounted price
            let bundlePrice = totalPrice;
            const discountValue = parseInt(newBundle.discountValue) || 0;
            if (newBundle.discountType === "percent") {
                bundlePrice = Math.round(totalPrice * (1 - discountValue / 100));
            } else {
                bundlePrice = Math.max(0, totalPrice - (discountValue * 100)); // Convert dollars to cents
            }

            return apiClient.createActivityBundle(campgroundId, {
                name: newBundle.name,
                description: newBundle.description || undefined,
                price: bundlePrice,
                discountType: newBundle.discountType,
                discountValue,
                activityIds: newBundle.selectedActivities
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bundles", campgroundId] });
            setIsCreateOpen(false);
            setNewBundle({
                name: "",
                description: "",
                discountType: "percent",
                discountValue: "15",
                selectedActivities: []
            });
            toast({
                title: "Bundle created!",
                description: "Guests can now purchase this package deal."
            });
        },
        onError: (err: any) => {
            toast({
                title: "Failed to create bundle",
                description: err?.message || "Please try again",
                variant: "destructive"
            });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.deleteActivityBundle(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bundles", campgroundId] });
            toast({ title: "Bundle deleted" });
        }
    });

    const toggleActivity = (activityId: string) => {
        setNewBundle(prev => ({
            ...prev,
            selectedActivities: prev.selectedActivities.includes(activityId)
                ? prev.selectedActivities.filter(id => id !== activityId)
                : [...prev.selectedActivities, activityId]
        }));
    };

    // Calculate bundle savings for display
    const calculateSavings = () => {
        const selectedActivitiesData = activities.filter(a =>
            newBundle.selectedActivities.includes(a.id)
        );
        const totalPrice = selectedActivitiesData.reduce((sum, a) => sum + a.price, 0);
        const discountValue = parseInt(newBundle.discountValue) || 0;

        let bundlePrice = totalPrice;
        if (newBundle.discountType === "percent") {
            bundlePrice = Math.round(totalPrice * (1 - discountValue / 100));
        } else {
            bundlePrice = Math.max(0, totalPrice - (discountValue * 100));
        }

        return {
            originalPrice: totalPrice,
            bundlePrice,
            savings: totalPrice - bundlePrice
        };
    };

    const savings = calculateSavings();

    return (
        <>
            {/* Bundles List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Package className="h-5 w-5 text-purple-600" />
                            Activity Bundles
                        </h3>
                        <p className="text-sm text-slate-500">
                            Create package deals to increase sales
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Bundle
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    </div>
                ) : bundles?.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-4">
                                <Gift className="h-8 w-8 text-purple-600" />
                            </div>
                            <h4 className="font-semibold text-slate-900 mb-1">No Bundles Yet</h4>
                            <p className="text-sm text-slate-500 text-center max-w-sm mb-4">
                                Create activity bundles to offer package deals and increase average order value.
                            </p>
                            <Button
                                onClick={() => setIsCreateOpen(true)}
                                className="bg-gradient-to-r from-purple-500 to-pink-500"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Your First Bundle
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {bundles?.map(bundle => (
                            <Card
                                key={bundle.id}
                                className={cn(
                                    "group overflow-hidden transition-all hover:shadow-lg",
                                    !bundle.isActive && "opacity-60"
                                )}
                            >
                                <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500" />
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Package className="h-4 w-4 text-purple-600" />
                                                {bundle.name}
                                            </CardTitle>
                                            {bundle.description && (
                                                <CardDescription className="text-xs mt-1">
                                                    {bundle.description}
                                                </CardDescription>
                                            )}
                                        </div>
                                        <Badge
                                            variant={bundle.isActive ? "default" : "secondary"}
                                            className={bundle.isActive ? "bg-emerald-500" : ""}
                                        >
                                            {bundle.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {/* Included activities */}
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                            Includes
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {bundle.items.map(item => (
                                                <Badge
                                                    key={item.id}
                                                    variant="outline"
                                                    className="text-xs"
                                                >
                                                    {item.activity.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pricing */}
                                    <div className="flex items-center justify-between pt-2 border-t">
                                        <div>
                                            <div className="text-xl font-bold text-slate-900">
                                                ${(bundle.price / 100).toFixed(2)}
                                            </div>
                                            {bundle.discountValue && (
                                                <div className="flex items-center gap-1 text-xs text-emerald-600">
                                                    <Tag className="h-3 w-3" />
                                                    Save {bundle.discountType === "percent"
                                                        ? `${bundle.discountValue}%`
                                                        : `$${bundle.discountValue}`}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-slate-400 hover:text-red-500"
                                            onClick={() => {
                                                if (confirm("Delete this bundle?")) {
                                                    deleteMutation.mutate(bundle.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Bundle Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gift className="h-5 w-5 text-purple-600" />
                            Create Activity Bundle
                        </DialogTitle>
                        <DialogDescription>
                            Combine activities into a discounted package deal.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                        {/* Bundle Name */}
                        <div className="grid gap-2">
                            <Label htmlFor="bundle-name">Bundle Name</Label>
                            <Input
                                id="bundle-name"
                                value={newBundle.name}
                                onChange={(e) => setNewBundle({ ...newBundle, name: e.target.value })}
                                placeholder="e.g. Adventure Weekend Package"
                            />
                        </div>

                        {/* Description */}
                        <div className="grid gap-2">
                            <Label htmlFor="bundle-description">Description (optional)</Label>
                            <Textarea
                                id="bundle-description"
                                value={newBundle.description}
                                onChange={(e) => setNewBundle({ ...newBundle, description: e.target.value })}
                                placeholder="Describe what's included and why it's a great deal..."
                                rows={2}
                            />
                        </div>

                        {/* Select Activities */}
                        <div className="space-y-3">
                            <Label>Select Activities to Include</Label>
                            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                                {activities.map(activity => (
                                    <label
                                        key={activity.id}
                                        className={cn(
                                            "flex items-center gap-3 p-3 cursor-pointer transition-colors",
                                            newBundle.selectedActivities.includes(activity.id)
                                                ? "bg-purple-50"
                                                : "hover:bg-slate-50"
                                        )}
                                    >
                                        <Checkbox
                                            checked={newBundle.selectedActivities.includes(activity.id)}
                                            onCheckedChange={() => toggleActivity(activity.id)}
                                        />
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{activity.name}</p>
                                            <p className="text-xs text-slate-500">
                                                ${(activity.price / 100).toFixed(2)}{activity.duration ? ` · ${activity.duration} mins` : ''}
                                            </p>
                                        </div>
                                        {newBundle.selectedActivities.includes(activity.id) && (
                                            <Check className="h-4 w-4 text-purple-600" />
                                        )}
                                    </label>
                                ))}
                            </div>
                            {activities.length === 0 && (
                                <p className="text-sm text-slate-500 text-center py-4">
                                    Create some activities first to add them to a bundle.
                                </p>
                            )}
                        </div>

                        {/* Discount Settings */}
                        <div className="space-y-3">
                            <Label>Discount</Label>
                            <div className="flex gap-3">
                                <Select
                                    value={newBundle.discountType}
                                    onValueChange={(v: "percent" | "fixed") => setNewBundle({ ...newBundle, discountType: v })}
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percent">
                                            <span className="flex items-center gap-2">
                                                <Percent className="h-4 w-4" />
                                                Percentage
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="fixed">
                                            <span className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4" />
                                                Fixed Amount
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="relative flex-1">
                                    <Input
                                        type="number"
                                        value={newBundle.discountValue}
                                        onChange={(e) => setNewBundle({ ...newBundle, discountValue: e.target.value })}
                                        className="pl-8"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        {newBundle.discountType === "percent" ? "%" : "$"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Price Preview */}
                        {newBundle.selectedActivities.length > 0 && (
                            <div className="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-slate-600">Original Price</span>
                                    <span className="text-slate-500 line-through">
                                        ${(savings.originalPrice / 100).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-slate-600">Discount</span>
                                    <span className="text-emerald-600 font-medium">
                                        -${(savings.savings / 100).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-purple-200">
                                    <span className="font-medium">Bundle Price</span>
                                    <span className="text-xl font-bold text-purple-700">
                                        ${(savings.bundlePrice / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => createMutation.mutate()}
                            disabled={
                                createMutation.isPending ||
                                !newBundle.name ||
                                newBundle.selectedActivities.length < 2
                            }
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Create Bundle
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
