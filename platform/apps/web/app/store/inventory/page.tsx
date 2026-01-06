"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmpty } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { Product, ProductCategory } from "@keepr/shared";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Package, Settings } from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeletons";
import { Badge } from "@/components/ui/badge";
import { useCampground } from "@/contexts/CampgroundContext";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

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
                        <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
                        <p className="text-muted-foreground">Track stock levels and manage reorder points.</p>
                    </div>
                </div>

                {lowStockProducts.length > 0 && (
                    <div className="bg-status-warning/10 border border-status-warning/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="h-5 w-5 text-status-warning" />
                            <h2 className="font-semibold text-status-warning">Low Stock Alerts</h2>
                        </div>
                        <div className="grid gap-2">
                            {lowStockProducts.map(product => (
                                <div key={product.id} className="flex items-center justify-between bg-card p-2 rounded border border-status-warning/20">
                                    <span className="font-medium text-foreground">{product.name}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-muted-foreground">
                                            Current: <span className="font-bold text-status-error">{product.stockQty}</span>
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            Alert at: {product.lowStockAlert}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-card rounded-lg shadow">
                    <div className="p-4 border-b">
                        <h2 className="font-semibold flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            All Tracked Items
                        </h2>
                    </div>

                    {loading ? (
                        <TableSkeleton columns={5} rows={5} />
                    ) : products.length === 0 ? (
                        <EmptyState
                            icon={Package}
                            title="No inventory tracking enabled"
                            description="Inventory tracking helps you monitor stock levels and receive alerts when products run low. Enable tracking on individual products to see them here."
                            action={{
                                label: "Manage Products",
                                onClick: () => window.location.href = "/settings/store",
                                icon: Settings
                            }}
                        />
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
                                                    defaultValue={product.stockQty ?? undefined}
                                                    onBlur={(e) => handleStockUpdate(product.id, parseInt(e.target.value))}
                                                    aria-label={`Stock level for ${product.name}`}
                                                />
                                                {product.stockQty != null && product.lowStockAlert != null && product.stockQty <= product.lowStockAlert && (
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
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
