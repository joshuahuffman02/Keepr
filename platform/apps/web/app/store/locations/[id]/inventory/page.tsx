"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../../../lib/api-client";
import { DashboardShell } from "../../../../../components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Badge } from "../../../../../components/ui/badge";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../components/ui/table";
import { ArrowLeft, Package, AlertTriangle, Plus, Minus, Edit2, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "../../../../../lib/utils";

type LocationInventory = Awaited<ReturnType<typeof apiClient.getLocationInventory>>[0];

export default function LocationInventoryPage() {
  const params = useParams<{ id?: string }>();
  const locationId = params.id ?? "";
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [adjustingItem, setAdjustingItem] = useState<LocationInventory | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"set" | "adjust">("adjust");
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [lowStockAlert, setLowStockAlert] = useState<number | undefined>();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCampgroundId(localStorage.getItem("campreserv:selectedCampground"));
  }, []);

  const { data: location, isLoading: locationLoading } = useQuery({
    queryKey: ["store-location", locationId, campgroundId],
    queryFn: () => apiClient.getStoreLocation(locationId, campgroundId ?? undefined),
    enabled: !!locationId && !!campgroundId,
  });

  const { data: inventory = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["location-inventory", locationId, campgroundId],
    queryFn: () => apiClient.getLocationInventory(locationId, undefined, campgroundId ?? undefined),
    enabled: !!locationId && !!campgroundId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["store-products", location?.campgroundId],
    queryFn: () => apiClient.getStoreProducts(location!.campgroundId),
    enabled: !!location?.campgroundId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      stockQty?: number;
      adjustment?: number;
      lowStockAlert?: number;
      notes?: string;
    }) =>
      apiClient.updateLocationInventory(
        locationId,
        adjustingItem!.productId,
        data,
        campgroundId ?? undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-inventory", locationId] });
      closeAdjustDialog();
    },
  });

  const closeAdjustDialog = () => {
    setAdjustingItem(null);
    setAdjustmentValue(0);
    setAdjustmentNotes("");
    setLowStockAlert(undefined);
  };

  const handleAdjust = () => {
    if (!adjustingItem) return;

    if (adjustmentType === "set") {
      updateMutation.mutate({
        stockQty: adjustmentValue,
        lowStockAlert,
        notes: adjustmentNotes || undefined,
      });
    } else {
      updateMutation.mutate({
        adjustment: adjustmentValue,
        notes: adjustmentNotes || undefined,
      });
    }
  };

  const filteredInventory = inventory.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.product?.name.toLowerCase().includes(q) || item.product?.sku?.toLowerCase().includes(q)
    );
  });

  // Products not yet in this location's inventory
  const availableProducts = products.filter(
    (p) => p.trackInventory && !inventory.some((i) => i.productId === p.id),
  );

  const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (locationLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/store/locations">
            <Button variant="ghost" size="icon" aria-label="Back to locations">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {location?.name} Inventory
            </h1>
            <p className="text-muted-foreground">Manage stock levels for this location</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Product Stock</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search products"
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {inventoryLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading inventory...</div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">
                  {searchQuery
                    ? "No products match your search"
                    : "No inventory tracked at this location yet"}
                </p>
                {!searchQuery && availableProducts.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Add products below to start tracking inventory
                  </p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Low Alert</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => {
                    const isLowStock =
                      item.lowStockAlert != null && item.stockQty <= item.lowStockAlert;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product?.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.product?.sku || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.product ? formatMoney(item.product.priceCents) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn("font-medium", isLowStock && "text-status-warning")}>
                            {item.stockQty}
                          </span>
                          {isLowStock && (
                            <AlertTriangle className="inline-block w-4 h-4 ml-1 text-status-warning" />
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.lowStockAlert ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setAdjustingItem(item);
                                setAdjustmentType("adjust");
                                setAdjustmentValue(-1);
                              }}
                              aria-label={`Decrease stock for ${item.product?.name ?? "product"}`}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setAdjustingItem(item);
                                setAdjustmentType("adjust");
                                setAdjustmentValue(1);
                              }}
                              aria-label={`Increase stock for ${item.product?.name ?? "product"}`}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setAdjustingItem(item);
                                setAdjustmentType("set");
                                setAdjustmentValue(item.stockQty);
                                setLowStockAlert(item.lowStockAlert ?? undefined);
                              }}
                              aria-label={`Edit stock settings for ${item.product?.name ?? "product"}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Products Section */}
        {availableProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Products to Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availableProducts.slice(0, 12).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setAdjustingItem({
                        id: "",
                        productId: product.id,
                        locationId,
                        stockQty: 0,
                        lowStockAlert: product.lowStockAlert ?? null,
                        product,
                      });
                      setAdjustmentType("set");
                      setAdjustmentValue(0);
                      setLowStockAlert(product.lowStockAlert ?? undefined);
                    }}
                    className="p-3 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/10 transition-colors text-left"
                  >
                    <div className="font-medium text-sm truncate">{product.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {product.sku || "No SKU"}
                    </div>
                  </button>
                ))}
              </div>
              {availableProducts.length > 12 && (
                <p className="text-sm text-muted-foreground mt-3">
                  And {availableProducts.length - 12} more products...
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!adjustingItem} onOpenChange={() => closeAdjustDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentType === "set" ? "Set Stock Level" : "Adjust Stock"}
            </DialogTitle>
            <DialogDescription>{adjustingItem?.product?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2 mb-4">
              <Button
                variant={adjustmentType === "adjust" ? "default" : "outline"}
                onClick={() => setAdjustmentType("adjust")}
                aria-pressed={adjustmentType === "adjust"}
                className="flex-1"
              >
                Quick Adjust
              </Button>
              <Button
                variant={adjustmentType === "set" ? "default" : "outline"}
                onClick={() => setAdjustmentType("set")}
                aria-pressed={adjustmentType === "set"}
                className="flex-1"
              >
                Set Exact
              </Button>
            </div>

            {adjustmentType === "adjust" ? (
              <div className="space-y-2">
                <Label htmlFor="adjustment-amount">Adjustment Amount</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAdjustmentValue((v) => v - 1)}
                    aria-label="Decrease adjustment amount"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    id="adjustment-amount"
                    type="number"
                    value={adjustmentValue}
                    onChange={(e) => setAdjustmentValue(parseInt(e.target.value) || 0)}
                    className="text-center w-24"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAdjustmentValue((v) => v + 1)}
                    aria-label="Increase adjustment amount"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Current: {adjustingItem?.stockQty ?? 0} →{" "}
                  <span className="font-medium">
                    {Math.max(0, (adjustingItem?.stockQty ?? 0) + adjustmentValue)}
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stock-quantity">Stock Quantity</Label>
                  <Input
                    id="stock-quantity"
                    type="number"
                    min={0}
                    value={adjustmentValue}
                    onChange={(e) => setAdjustmentValue(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="low-stock-alert">Low Stock Alert (optional)</Label>
                  <Input
                    id="low-stock-alert"
                    type="number"
                    min={0}
                    value={lowStockAlert ?? ""}
                    onChange={(e) =>
                      setLowStockAlert(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="Alert when stock falls below..."
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="adjustment-notes">Notes (optional)</Label>
              <Input
                id="adjustment-notes"
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                placeholder="Reason for adjustment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAdjustDialog}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
