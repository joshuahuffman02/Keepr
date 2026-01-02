"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCampground } from "@/contexts/CampgroundContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Percent,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
  Tag,
  Calendar,
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface Discount {
  id: string;
  name: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  appliesTo: string;
  validUntil: string | null;
  usageCount: number;
  isActive: boolean;
}

async function fetchDiscounts(campgroundId: string): Promise<Discount[]> {
  const response = await fetch(`${API_BASE}/promotions/campgrounds/${campgroundId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch discounts");
  }
  // Transform promotions to discount format
  const data = await response.json();
  return data.map((promo: any) => ({
    id: promo.id,
    name: promo.name,
    code: promo.code || promo.name.toUpperCase().replace(/\s+/g, ""),
    type: promo.discountType === "percentage" ? "percent" : "fixed",
    value: promo.discountValue || promo.amount || 0,
    appliesTo: promo.appliesTo || "All Items",
    validUntil: promo.endDate || null,
    usageCount: promo.usageCount || 0,
    isActive: promo.isActive !== false,
  }));
}

async function deleteDiscount(discountId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/promotions/${discountId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to delete discount");
  }
}

export default function DiscountsPage() {
  const { selectedCampground, isHydrated } = useCampground();
  const queryClient = useQueryClient();

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["discounts", selectedCampground?.id],
    queryFn: () => fetchDiscounts(selectedCampground!.id),
    enabled: isHydrated && !!selectedCampground?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDiscount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts", selectedCampground?.id] });
    },
  });

  if (!isHydrated || !selectedCampground) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const columns = [
    {
      key: "name",
      label: "Discount",
      render: (item: Discount) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <Tag className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-foreground">{item.name}</p>
            <code className="text-xs px-1.5 py-0.5 rounded bg-muted">
              {item.code}
            </code>
          </div>
        </div>
      ),
    },
    {
      key: "value",
      label: "Value",
      render: (item: Discount) => (
        <span className="font-medium text-status-success">
          {item.type === "percent" ? `${item.value}%` : `$${item.value}`} off
        </span>
      ),
    },
    {
      key: "appliesTo",
      label: "Applies To",
      render: (item: Discount) => (
        <Badge variant="outline">{item.appliesTo}</Badge>
      ),
    },
    {
      key: "validity",
      label: "Valid Until",
      render: (item: Discount) => (
        <div className="flex items-center gap-2 text-sm">
          {item.validUntil ? (
            <>
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {new Date(item.validUntil).toLocaleDateString()}
            </>
          ) : (
            <span className="text-muted-foreground">No expiration</span>
          )}
        </div>
      ),
    },
    {
      key: "usage",
      label: "Uses",
      render: (item: Discount) => (
        <span className="text-muted-foreground">{item.usageCount}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Discount) => (
        <Badge
          variant={item.isActive ? "default" : "secondary"}
          className={cn(
            item.isActive
              ? "bg-status-success/15 text-status-success"
              : "bg-muted text-muted-foreground"
          )}
        >
          {item.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Discounts</h2>
          <p className="text-muted-foreground mt-1">
            Create discount codes for your store and POS
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Discount
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Discounts can be applied at checkout in the POS system. Use codes for
          special promotions or create standing discounts for groups like seniors
          or military.
        </AlertDescription>
      </Alert>

      <SettingsTable
        data={discounts}
        columns={columns}
        searchPlaceholder="Search discounts..."
        searchFields={["name", "code"]}
        addLabel="Add Discount"
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
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => deleteMutation.mutate(item.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        emptyState={{
          icon: Percent,
          title: "No discounts",
          description: "Create discounts to offer special pricing",
        }}
      />
    </div>
  );
}
