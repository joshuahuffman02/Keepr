"use client";

import { useState } from "react";
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

const mockDiscounts: Discount[] = [
  {
    id: "1",
    name: "Senior Discount",
    code: "SENIOR",
    type: "percent",
    value: 10,
    appliesTo: "All Store Items",
    validUntil: null,
    usageCount: 145,
    isActive: true,
  },
  {
    id: "2",
    name: "Military Discount",
    code: "MILITARY",
    type: "percent",
    value: 15,
    appliesTo: "All Store Items",
    validUntil: null,
    usageCount: 89,
    isActive: true,
  },
  {
    id: "3",
    name: "Happy Hour",
    code: "HAPPYHOUR",
    type: "percent",
    value: 20,
    appliesTo: "Beverages",
    validUntil: "2025-12-31",
    usageCount: 234,
    isActive: true,
  },
  {
    id: "4",
    name: "$5 Off Firewood",
    code: "FIRE5",
    type: "fixed",
    value: 5,
    appliesTo: "Firewood",
    validUntil: "2025-03-31",
    usageCount: 67,
    isActive: true,
  },
];

export default function DiscountsPage() {
  const [discounts] = useState<Discount[]>(mockDiscounts);

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
            <p className="font-medium text-slate-900">{item.name}</p>
            <code className="text-xs px-1.5 py-0.5 rounded bg-slate-100">
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
        <span className="font-medium text-emerald-600">
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
              <Calendar className="h-4 w-4 text-slate-400" />
              {new Date(item.validUntil).toLocaleDateString()}
            </>
          ) : (
            <span className="text-slate-400">No expiration</span>
          )}
        </div>
      ),
    },
    {
      key: "usage",
      label: "Uses",
      render: (item: Discount) => (
        <span className="text-slate-600">{item.usageCount}</span>
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
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-600"
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
          <h2 className="text-2xl font-bold text-slate-900">Discounts</h2>
          <p className="text-slate-500 mt-1">
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
              <DropdownMenuItem className="text-red-600">
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
