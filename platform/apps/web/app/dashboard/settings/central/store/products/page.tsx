"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowRight,
  Package,
  ShoppingCart,
  Tags,
  Info,
  Loader2,
  Plus,
  MoreHorizontal,
  DollarSign,
  AlertCircle,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";
import { StaggeredList, StaggeredItem } from "@/components/ui/staggered-list";
import { FilterChip } from "@/components/ui/filter-chip";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  categoryId: string | null;
  isActive: boolean;
  trackInventory: boolean;
  inventoryCount: number | null;
  category?: {
    id: string;
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    Promise.all([
      apiClient.getProducts(id).catch(() => []),
      apiClient.getProductCategories(id).catch(() => [])
    ]).then(([productList, categoryList]) => {
      setProducts(Array.isArray(productList) ? productList as unknown as Product[] : []);
      setCategories(Array.isArray(categoryList) ? categoryList as unknown as Category[] : []);
      setLoading(false);
    });
  }, []);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const activeProducts = products.filter((p) => p.isActive !== false);
  const lowStockProducts = products.filter(
    (p) => p.trackInventory && p.inventoryCount !== null && p.inventoryCount <= 5
  );

  // Filter products based on current filters
  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== "all") {
      if (categoryFilter === "uncategorized") {
        if (p.categoryId !== null) return false;
      } else if (p.categoryId !== categoryFilter) {
        return false;
      }
    }
    if (statusFilter !== "all") {
      const isActive = p.isActive !== false;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
    }
    return true;
  });

  // Count active filters
  const activeFilterCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  // Get category name for display
  const getCategoryName = (categoryId: string) => {
    if (categoryId === "uncategorized") return "Uncategorized";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Products</h2>
          <p className="text-muted-foreground mt-1">
            Manage your store inventory and products
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
          <h2 className="text-2xl font-bold text-foreground">Products</h2>
          <p className="text-muted-foreground mt-1">
            Manage your store inventory and products
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
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
          <h2 className="text-2xl font-bold text-foreground">Products</h2>
          <p className="text-muted-foreground mt-1">
            Manage your store inventory and products
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/pos">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Open POS
            </Link>
          </Button>
          <Button asChild>
            <Link href="/pos">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Info */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Products are sold through the Point of Sale system. Use the POS to manage
          inventory, process sales, and track revenue.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <StaggeredList className="grid grid-cols-4 gap-4" variant="scale" staggerDelay={0.08}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{products.length}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeProducts.length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Tags className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{categories.length}</p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${lowStockProducts.length > 0 ? "bg-amber-100" : "bg-muted"}`}>
                <AlertCircle className={`h-5 w-5 ${lowStockProducts.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{lowStockProducts.length}</p>
                <p className="text-sm text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </StaggeredList>

      {/* Filters */}
      {products.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                disabled={activeFilterCount === 0}
                onClick={clearAllFilters}
              >
                Clear all filters
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Category filter dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Category:</label>
              <select
                className="text-sm border border-border rounded-md px-2 py-1 bg-card"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="uncategorized">Uncategorized</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Status filter dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Status:</label>
              <select
                className="text-sm border border-border rounded-md px-2 py-1 bg-card"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          {/* Active filter pills */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground font-medium">Active:</span>
              {categoryFilter !== "all" && (
                <FilterChip
                  label={`Category: ${getCategoryName(categoryFilter)}`}
                  selected
                  removable
                  onRemove={() => setCategoryFilter("all")}
                  variant="subtle"
                />
              )}
              {statusFilter !== "all" && (
                <FilterChip
                  label={`Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`}
                  selected
                  removable
                  onRemove={() => setStatusFilter("all")}
                  variant="subtle"
                />
              )}
              {activeFilterCount > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 px-2"
                  onClick={clearAllFilters}
                >
                  Clear all
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Products List */}
      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No products yet
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Add products to your store to start selling through the POS system.
            </p>
            <Button asChild>
              <Link href="/pos">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Product
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-3 px-4 bg-muted border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Products ({filteredProducts.length}{activeFilterCount > 0 ? ` of ${products.length}` : ""})
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/pos">
                Manage All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {filteredProducts.slice(0, 10).map((product, index) => (
              <StaggeredItem key={product.id} delay={0.1 + index * 0.04} variant="slideRight">
              <div
                className="flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${product.isActive !== false ? "bg-blue-100" : "bg-muted"}`}>
                    <Package className={`h-5 w-5 ${product.isActive !== false ? "text-blue-600" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${product.isActive !== false ? "text-foreground" : "text-muted-foreground"}`}>
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {product.sku && <span>SKU: {product.sku}</span>}
                      {product.category && (
                        <Badge variant="outline" className="text-xs">
                          {product.category.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {formatPrice(product.price)}
                    </p>
                    {product.trackInventory && product.inventoryCount !== null && (
                      <p className={`text-xs ${product.inventoryCount <= 5 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {product.inventoryCount} in stock
                      </p>
                    )}
                  </div>
                  <Badge variant={product.isActive !== false ? "default" : "secondary"}>
                    {product.isActive !== false ? "Active" : "Inactive"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link href="/pos" className="w-full">Edit Product</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href="/store" className="w-full">Update Inventory</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              </StaggeredItem>
            ))}
            {filteredProducts.length > 10 && (
              <div className="px-4 py-3 text-center">
                <Button variant="ghost" asChild>
                  <Link href="/pos">
                    View all {filteredProducts.length} products
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            )}
            {filteredProducts.length === 0 && activeFilterCount > 0 && (
              <div className="px-4 py-8 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No products match your filters</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={clearAllFilters}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <Link href="/store" className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-emerald-100">
                  <ShoppingCart className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Inventory</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Track stock levels and manage reorders
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <Link
              href="/dashboard/settings/central/store/departments"
              className="flex items-start justify-between"
            >
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Tags className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Categories</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Organize products into departments
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {categories.length} categories
                  </Badge>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
