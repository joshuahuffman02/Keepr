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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";

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

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500 mt-1">
            Manage your store inventory and products
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!campgroundId) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500 mt-1">
            Manage your store inventory and products
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-slate-600">Please select a campground first.</p>
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
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500 mt-1">
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
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{products.length}</p>
                <p className="text-sm text-slate-500">Total Products</p>
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
                <p className="text-2xl font-bold text-slate-900">{activeProducts.length}</p>
                <p className="text-sm text-slate-500">Active</p>
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
                <p className="text-2xl font-bold text-slate-900">{categories.length}</p>
                <p className="text-sm text-slate-500">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${lowStockProducts.length > 0 ? "bg-amber-100" : "bg-slate-100"}`}>
                <AlertCircle className={`h-5 w-5 ${lowStockProducts.length > 0 ? "text-amber-600" : "text-slate-600"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{lowStockProducts.length}</p>
                <p className="text-sm text-slate-500">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products List */}
      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No products yet
            </h3>
            <p className="text-slate-500 mb-4 max-w-md mx-auto">
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
          <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Products ({products.length})
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/pos">
                Manage All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {products.slice(0, 10).map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${product.isActive !== false ? "bg-blue-100" : "bg-slate-100"}`}>
                    <Package className={`h-5 w-5 ${product.isActive !== false ? "text-blue-600" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${product.isActive !== false ? "text-slate-900" : "text-slate-500"}`}>
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
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
                    <p className="font-medium text-slate-900">
                      {formatPrice(product.price)}
                    </p>
                    {product.trackInventory && product.inventoryCount !== null && (
                      <p className={`text-xs ${product.inventoryCount <= 5 ? "text-amber-600" : "text-slate-500"}`}>
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
            ))}
            {products.length > 10 && (
              <div className="px-4 py-3 text-center">
                <Button variant="ghost" asChild>
                  <Link href="/pos">
                    View all {products.length} products
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
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
                  <h3 className="font-semibold text-slate-900">Inventory</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Track stock levels and manage reorders
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400" />
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
                  <h3 className="font-semibold text-slate-900">Categories</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Organize products into departments
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {categories.length} categories
                  </Badge>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
