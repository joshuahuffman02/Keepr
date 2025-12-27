"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { Product, ProductCategory } from "@campreserv/shared";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, AlertTriangle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCampground } from "@/contexts/CampgroundContext";

export default function InventoryPage() {
    const [products, setProducts] = useState<(Product & { category?: ProductCategory | null })[]>([]);
    const [lowStockProducts, setLowStockProducts] = useState<(Product & { category?: ProductCategory | null })[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { selectedCampground, isHydrated } = useCampground();

    const campgroundId = selectedCampground?.id;

    const loadData = useCallback(async (cgId: string) => {
        try {
            setLoading(true);
            const [allProducts, lowStock] = await Promise.all([
                apiClient.getProducts(cgId),
                apiClient.getLowStockProducts(cgId)
            ]);
            setProducts(allProducts.filter(p => p.trackInventory));
            setLowStockProducts(lowStock);
        } catch (error) {
            console.error("Failed to load inventory:", error);
            toast({
                title: "Error",
                description: "Failed to load inventory data.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (isHydrated && campgroundId) {
            loadData(campgroundId);
        }
    }, [isHydrated, campgroundId, loadData]);

    const handleStockUpdate = async (id: string, newQty: number) => {
        if (!campgroundId) return;

        try {
            const product = products.find(p => p.id === id);
            if (!product) return;

            const adjustment = newQty - (product.stockQty || 0);
            if (adjustment === 0) return;

            await apiClient.updateStoreStock(campgroundId, id, { delta: adjustment });

            toast({
                title: "Stock Updated",
                description: `Stock for ${product.name} updated to ${newQty}.`
            });

            // Reload data to refresh low stock list
            loadData(campgroundId);

        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "Failed to update stock.",
                variant: "destructive"
            });
        }
    };

    return (
        <DashboardShell>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
                        <p className="text-muted-foreground">Track stock levels and manage reorder points.</p>
                    </div>
                </div>

                {lowStockProducts.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            <h2 className="font-semibold text-amber-900">Low Stock Alerts</h2>
                        </div>
                        <div className="grid gap-2">
                            {lowStockProducts.map(product => (
                                <div key={product.id} className="flex items-center justify-between bg-white p-2 rounded border border-amber-100">
                                    <span className="font-medium text-slate-700">{product.name}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-slate-500">
                                            Current: <span className="font-bold text-red-600">{product.stockQty}</span>
                                        </span>
                                        <span className="text-sm text-slate-500">
                                            Alert at: {product.lowStockAlert}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b">
                        <h2 className="font-semibold flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            All Tracked Items
                        </h2>
                    </div>

                    {loading ? (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Stock Level</TableHead>
                                    <TableHead>Low Stock Alert</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell>{product.category?.name || "-"}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    className="w-20 h-8"
                                                    defaultValue={product.stockQty}
                                                    onBlur={(e) => handleStockUpdate(product.id, parseInt(e.target.value))}
                                                />
                                                {product.stockQty !== undefined && product.lowStockAlert !== undefined && product.stockQty <= product.lowStockAlert && (
                                                    <Badge variant="destructive" className="h-5 text-[10px]">Low</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{product.lowStockAlert || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <a href={`/settings/store/products/${product.id}`}>Edit Details</a>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {products.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No products with inventory tracking enabled.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
