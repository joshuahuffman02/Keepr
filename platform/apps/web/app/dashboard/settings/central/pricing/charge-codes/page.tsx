"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Receipt,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsTable } from "@/components/settings/tables";

interface ChargeCode {
  id: string;
  code: string;
  name: string;
  category: string;
  defaultAmount: number;
  taxable: boolean;
  isActive: boolean;
}

const mockChargeCodes: ChargeCode[] = [
  { id: "1", code: "SITE", name: "Site Rental", category: "Accommodation", defaultAmount: 0, taxable: true, isActive: true },
  { id: "2", code: "EXTRA", name: "Extra Person Fee", category: "Accommodation", defaultAmount: 10, taxable: true, isActive: true },
  { id: "3", code: "PET", name: "Pet Fee", category: "Accommodation", defaultAmount: 15, taxable: true, isActive: true },
  { id: "4", code: "EARLY", name: "Early Check-in", category: "Services", defaultAmount: 25, taxable: true, isActive: true },
  { id: "5", code: "LATE", name: "Late Check-out", category: "Services", defaultAmount: 25, taxable: true, isActive: true },
  { id: "6", code: "FIRE", name: "Firewood Bundle", category: "Store", defaultAmount: 8, taxable: true, isActive: true },
  { id: "7", code: "GOLF", name: "Golf Cart Rental", category: "Rentals", defaultAmount: 50, taxable: true, isActive: true },
  { id: "8", code: "CANC", name: "Cancellation Fee", category: "Fees", defaultAmount: 25, taxable: false, isActive: true },
];

export default function ChargeCodesPage() {
  const [chargeCodes] = useState<ChargeCode[]>(mockChargeCodes);

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (item: ChargeCode) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100">
            <Receipt className="h-4 w-4 text-slate-600" />
          </div>
          <code className="px-2 py-1 rounded bg-slate-100 font-mono text-sm">
            {item.code}
          </code>
        </div>
      ),
    },
    {
      key: "name",
      label: "Description",
      render: (item: ChargeCode) => (
        <div>
          <p className="font-medium text-slate-900">{item.name}</p>
          <p className="text-sm text-slate-500">{item.category}</p>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Default Amount",
      render: (item: ChargeCode) => (
        <span className="font-medium">
          {item.defaultAmount === 0 ? "Variable" : `$${item.defaultAmount.toFixed(2)}`}
        </span>
      ),
    },
    {
      key: "taxable",
      label: "Taxable",
      render: (item: ChargeCode) => (
        <Badge variant={item.taxable ? "default" : "secondary"} className={item.taxable ? "bg-emerald-100 text-emerald-800" : ""}>
          {item.taxable ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: ChargeCode) => (
        <Badge
          variant={item.isActive ? "default" : "secondary"}
          className={item.isActive ? "bg-emerald-100 text-emerald-800" : ""}
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
          <h2 className="text-2xl font-bold text-slate-900">Charge Codes</h2>
          <p className="text-slate-500 mt-1">
            Define charge codes used for billing and reporting
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Charge Code
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Charge codes categorize different types of revenue for reporting and accounting.
          Each transaction is associated with a charge code.
        </AlertDescription>
      </Alert>

      <SettingsTable
        data={chargeCodes}
        columns={columns}
        searchPlaceholder="Search charge codes..."
        searchFields={["code", "name", "category"]}
        addLabel="Add Charge Code"
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
          icon: Receipt,
          title: "No charge codes",
          description: "Add charge codes to categorize your revenue",
        }}
      />
    </div>
  );
}
