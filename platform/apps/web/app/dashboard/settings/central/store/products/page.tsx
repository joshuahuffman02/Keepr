"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Package, ShoppingCart, Tags, Info, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [productCount, setProductCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);

  useEffect(() => {
    const campgroundId = localStorage.getItem("campreserv:selectedCampground");
    if (!campgroundId) {
      setLoading(false);
      return;
    }

    Promise.all([
      apiClient.getProducts(campgroundId).catch(() => []),
      apiClient.getProductCategories(campgroundId).catch(() => [])
    ]).then(([products, categories]) => {
      const productList = Array.isArray(products) ? products : [];
      const categoryList = Array.isArray(categories) ? categories : [];

      setProductCount(productList.length);
      setActiveCount(productList.filter((p: any) => p.isActive !== false).length);
      setCategoryCount(categoryList.length);
      setLoading(false);
    });
  }, []);

  const stats = [
    { label: "Total Products", value: loading ? "..." : productCount.toString(), icon: Package },
    { label: "Active", value: loading ? "..." : activeCount.toString(), icon: ShoppingCart },
    { label: "Categories", value: loading ? "..." : categoryCount.toString(), icon: Tags },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500 mt-1">
            Manage your store inventory and products
          </p>
        </div>
        <Button asChild>
          <Link href="/pos">
            Manage Products
          </Link>
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Products are managed in the POS section. This page provides an overview
          and quick access to product management.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100">
                    {loading ? (
                      <Loader2 className="h-5 w-5 text-slate-600 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5 text-slate-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Link
              href="/pos"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-900">View All Products</p>
                  <p className="text-sm text-slate-500">
                    Browse and edit your product catalog
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </Link>

            <Link
              href="/store"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-900">Manage Inventory</p>
                  <p className="text-sm text-slate-500">
                    Manage stock levels and inventory
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </Link>

            <Link
              href="/dashboard/settings/central/store/departments"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Tags className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-900">Manage Departments</p>
                  <p className="text-sm text-slate-500">
                    Organize products into categories
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
