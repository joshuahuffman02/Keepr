import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { HelpTooltip } from "../ui/help-tooltip";
import { Product, ProductCategory } from "@campreserv/shared";

interface ProductModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product?: Product | null;
    categories: ProductCategory[];
    onSave: (data: any) => Promise<void>;
}

export function ProductModal({ open, onOpenChange, product, categories, onSave }: ProductModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        categoryId: "",
        priceCents: 0,
        stockQty: 0,
        imageUrl: "",
        sku: "",
        glCode: "",
        isActive: true
    });

    useEffect(() => {
        if (open) {
            if (product) {
                setFormData({
                    name: product.name,
                    description: product.description || "",
                    categoryId: product.categoryId || "",
                    priceCents: product.priceCents,
                    stockQty: product.stockQty || 0,
                    imageUrl: product.imageUrl || "",
                    sku: product.sku || "",
                    glCode: product.glCode || "",
                    isActive: product.isActive ?? true
                });
            } else {
                setFormData({
                    name: "",
                    description: "",
                    categoryId: categories.length > 0 ? categories[0].id : "",
                    priceCents: 0,
                    stockQty: 0,
                    imageUrl: "",
                    sku: "",
                    glCode: "",
                    isActive: true
                });
            }
        }
    }, [open, product, categories]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave({
                ...formData,
                priceCents: Number(formData.priceCents),
                stockQty: Number(formData.stockQty),
                // Convert empty strings to null for optional fields
                imageUrl: formData.imageUrl.trim() || null,
                description: formData.description.trim() || null,
                sku: formData.sku.trim() || null,
                glCode: formData.glCode.trim() || null,
                categoryId: formData.categoryId || null
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
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{product ? "Edit Product" : "New Product"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
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
                            <Label htmlFor="category">Category</Label>
                            <select
                                id="category"
                                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.categoryId}
                                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                            >
                                <option value="">Select category...</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
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

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                                <Label htmlFor="price">Price (cents)</Label>
                                <HelpTooltip content="Enter price in cents (e.g., 999 = $9.99)" />
                            </div>
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
                            <Label htmlFor="stock">Stock</Label>
                            <Input
                                id="stock"
                                type="number"
                                min="0"
                                value={formData.stockQty}
                                onChange={(e) => setFormData({ ...formData, stockQty: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                                <Label htmlFor="sku">SKU</Label>
                                <HelpTooltip content="Stock Keeping Unit - unique identifier for inventory" />
                            </div>
                            <Input
                                id="sku"
                                value={formData.sku}
                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image">Image URL</Label>
                        <Input
                            id="image"
                            value={formData.imageUrl}
                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                            <Label htmlFor="glCode">GL Code</Label>
                            <HelpTooltip content="General Ledger code for accounting integration" />
                        </div>
                        <Input
                            id="glCode"
                            value={formData.glCode}
                            onChange={(e) => setFormData({ ...formData, glCode: e.target.value })}
                            placeholder="e.g., 4000-MERCH"
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
                            {loading ? "Saving..." : "Save Product"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
