"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../../lib/api-client";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Plus, Tag, Clock, Percent, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { useToast } from "../../../../components/ui/use-toast";
import { Badge } from "../../../../components/ui/badge";

export default function MembershipSettingsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newType, setNewType] = useState({
        name: "",
        description: "",
        price: "",
        durationDays: "365",
        discountPercent: ""
    });

    // Get campground ID from localStorage
    const [campgroundId, setCampgroundId] = useState<string>("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem("campreserv:selectedCampground");
        if (stored) setCampgroundId(stored);
    }, []);

    const { data: types, isLoading } = useQuery({
        queryKey: ["membership-types", campgroundId],
        queryFn: () => apiClient.getMembershipTypes(campgroundId),
        enabled: !!campgroundId
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            return apiClient.createMembershipType(campgroundId, {
                ...newType,
                price: parseFloat(newType.price) * 100, // Convert to cents
                durationDays: parseInt(newType.durationDays),
                discountPercent: parseInt(newType.discountPercent)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["membership-types", campgroundId] });
            setIsCreateOpen(false);
            setNewType({ name: "", description: "", price: "", durationDays: "365", discountPercent: "" });
            toast({ title: "Membership type created" });
        },
        onError: () => {
            toast({ title: "Failed to create membership type", variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiClient.deleteMembershipType(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["membership-types", campgroundId] });
            toast({ title: "Membership type deleted" });
        }
    });

    if (isLoading) {
        return (
            <div>
                <div className="flex items-center justify-center h-96">Loading membership types...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Membership Programs</h1>
                        <p className="text-slate-500">Configure loyalty tiers and membership benefits.</p>
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                New Membership Type
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Membership Type</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={newType.name}
                                        onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                                        placeholder="e.g. VIP Club"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Description</Label>
                                    <Textarea
                                        value={newType.description}
                                        onChange={(e) => setNewType({ ...newType, description: e.target.value })}
                                        placeholder="Membership benefits..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Price ($)</Label>
                                        <Input
                                            type="number"
                                            value={newType.price}
                                            onChange={(e) => setNewType({ ...newType, price: e.target.value })}
                                            placeholder="99.00"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Discount (%)</Label>
                                        <Input
                                            type="number"
                                            value={newType.discountPercent}
                                            onChange={(e) => setNewType({ ...newType, discountPercent: e.target.value })}
                                            placeholder="10"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Duration (Days)</Label>
                                    <Input
                                        type="number"
                                        value={newType.durationDays}
                                        onChange={(e) => setNewType({ ...newType, durationDays: e.target.value })}
                                        placeholder="365"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                                    {createMutation.isPending ? "Creating..." : "Create Type"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">How membership works</CardTitle>
                        <CardDescription>Current setup supports paid tiers; auto-enrollment thresholds are roadmap items.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                            <div className="font-semibold text-slate-900">Buy-in</div>
                            <p className="text-sm text-slate-600">
                                Sell a membership tier by charging the price above (e.g., via POS or a manual charge), then assign the member to that tier in CRM.
                                Discounts/benefits are determined by the tier’s settings here.
                            </p>
                        </div>
                        <div className="space-y-1">
                            <div className="font-semibold text-slate-900">Auto-earn (planned)</div>
                            <p className="text-sm text-slate-600">
                                Auto-enrollment after X stays or Y spend is not wired yet. If you need this, capture the target thresholds and we’ll add the trigger once the rule engine ships.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {types?.map((type) => (
                        <Card key={type.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle>{type.name}</CardTitle>
                                    <Badge variant={type.isActive ? "default" : "secondary"}>
                                        {type.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    {type.description || "No description"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-sm text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <Tag className="w-4 h-4" />
                                            <span>${(type.price / 100).toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Percent className="w-4 h-4" />
                                            <span>{type.discountPercent}% Off</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            <span>{type.durationDays} Days</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-4 border-t border-slate-100 justify-end">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => {
                                                if (confirm("Delete this membership type?")) {
                                                    deleteMutation.mutate(type.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {types?.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No membership programs</h3>
                            <p className="text-slate-500">Create a membership type to start offering benefits.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
