import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AddOn } from "@campreserv/shared";

interface AddOnModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    addOn?: AddOn | null;
    onSave: (data: any) => Promise<void>;
}

export function AddOnModal({ open, onOpenChange, addOn, onSave }: AddOnModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        priceCents: 0,
        pricingType: "flat",
        sortOrder: 0,
        glCode: "",
        isActive: true
    });

    useEffect(() => {
        if (open) {
            if (addOn) {
                setFormData({
                    name: addOn.name,
                    description: addOn.description || "",
                    priceCents: addOn.priceCents,
                    pricingType: addOn.pricingType || "flat",
                    sortOrder: addOn.sortOrder || 0,
                    glCode: addOn.glCode || "",
                    isActive: addOn.isActive ?? true
                });
            } else {
                setFormData({
                    name: "",
                    description: "",
                    priceCents: 0,
                    pricingType: "flat",
                    sortOrder: 0,
                    glCode: "",
                    isActive: true
                });
            }
        }
    }, [open, addOn]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave({
                ...formData,
                priceCents: Number(formData.priceCents),
                sortOrder: Number(formData.sortOrder)
            });
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{addOn ? "Edit Add-on" : "New Add-on"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <textarea
                            id="description"
                            className="flex min-h-[80px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price">Price (cents)</Label>
                            <Input
                                id="price"
                                type="number"
                                min="0"
                                value={formData.priceCents}
                                onChange={(e) => setFormData({ ...formData, priceCents: Number(e.target.value) })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pricingType">Pricing Type</Label>
                            <select
                                id="pricingType"
                                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.pricingType}
                                onChange={(e) => setFormData({ ...formData, pricingType: e.target.value })}
                            >
                                <option value="flat">Flat Fee</option>
                                <option value="per_night">Per Night</option>
                                <option value="per_person">Per Person</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="glCode">GL Code</Label>
                        <Input
                            id="glCode"
                            value={formData.glCode}
                            onChange={(e) => setFormData({ ...formData, glCode: e.target.value })}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-600"
                        />
                        <Label htmlFor="isActive">Active</Label>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save Add-on"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
