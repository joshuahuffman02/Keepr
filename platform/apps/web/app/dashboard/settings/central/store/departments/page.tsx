"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Folder,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsTable } from "@/components/settings/tables";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface Department {
  id: string;
  name: string;
  color: string;
  productCount: number;
  isActive: boolean;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const campgroundId = localStorage.getItem("campreserv:selectedCampground");
    if (!campgroundId) {
      setLoading(false);
      return;
    }

    Promise.all([
      apiClient.getProductCategories(campgroundId).catch(() => []),
      apiClient.getProducts(campgroundId).catch(() => [])
    ]).then(([categories, products]) => {
      const categoryList = Array.isArray(categories) ? categories : [];
      const productList = Array.isArray(products) ? products : [];

      // Count products per category
      const productCounts: Record<string, number> = {};
      productList.forEach((p: any) => {
        if (p.categoryId) {
          productCounts[p.categoryId] = (productCounts[p.categoryId] || 0) + 1;
        }
      });

      // Map categories to departments
      const depts: Department[] = categoryList.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color || "#6b7280",
        productCount: productCounts[cat.id] || 0,
        isActive: cat.isActive !== false,
      }));

      setDepartments(depts);
      setLoading(false);
    });
  }, []);

  const columns = [
    {
      key: "name",
      label: "Department",
      render: (item: Department) => (
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-medium text-slate-900">{item.name}</span>
        </div>
      ),
    },
    {
      key: "products",
      label: "Products",
      render: (item: Department) => (
        <Badge variant="outline">
          {item.productCount} item{item.productCount !== 1 && "s"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Department) => (
        <Badge
          variant={item.isActive ? "default" : "secondary"}
          className={cn(
            item.isActive
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          )}
        >
          {item.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Departments</h2>
            <p className="text-slate-500 mt-1">
              Organize your store products into categories
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Departments</h2>
          <p className="text-slate-500 mt-1">
            Organize your store products into categories
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Department
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Departments help organize products in your POS system and provide
          better reporting by category.
        </AlertDescription>
      </Alert>

      <SettingsTable
        data={departments}
        columns={columns}
        searchPlaceholder="Search departments..."
        searchFields={["name"]}
        addLabel="Add Department"
        onAdd={() => {}}
        getItemStatus={(item) => (item.isActive ? "active" : "inactive")}
        getRowActions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                {item.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyState={{
          icon: Folder,
          title: "No departments",
          description: "Create departments to organize your products",
        }}
      />
    </div>
  );
}
