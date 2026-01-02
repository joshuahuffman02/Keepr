"use client";

import { useEffect, useState } from "react";
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
  Loader2,
  ExternalLink,
  DollarSign,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsTable } from "@/components/settings/tables";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

interface ChargeCode {
  id: string;
  code: string;
  name: string;
  category: string;
  source: "product" | "fee" | "ledger" | "system";
  usageCount: number;
  isActive: boolean;
}

// Standard system charge codes that campgrounds typically use
const SYSTEM_CHARGE_CODES = [
  { code: "SITE", name: "Site Rental", category: "Accommodation" },
  { code: "TAX", name: "Sales Tax", category: "Taxes" },
  { code: "LODGING_TAX", name: "Lodging Tax", category: "Taxes" },
  { code: "DEPOSIT", name: "Security Deposit", category: "Deposits" },
  { code: "REFUND", name: "Refund", category: "Adjustments" },
  { code: "DISCOUNT", name: "Discount", category: "Adjustments" },
  { code: "PAYMENT", name: "Payment Received", category: "Payments" },
];

export default function ChargeCodesPage() {
  const [loading, setLoading] = useState(true);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [chargeCodes, setChargeCodes] = useState<ChargeCode[]>([]);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    // Fetch products and ledger summary to build charge codes list
    Promise.all([
      apiClient.getProducts(id).catch(() => []),
      apiClient.getLedgerSummary(id, {}).catch(() => []),
    ]).then(([products, ledgerSummary]) => {
      const codesMap = new Map<string, ChargeCode>();

      // Add system charge codes
      SYSTEM_CHARGE_CODES.forEach((sc) => {
        codesMap.set(sc.code, {
          id: `system-${sc.code}`,
          code: sc.code,
          name: sc.name,
          category: sc.category,
          source: "system",
          usageCount: 0,
          isActive: true,
        });
      });

      // Add GL codes from products
      const productList = Array.isArray(products) ? products : [];
      productList.forEach((product: any) => {
        if (product.glCode) {
          const existing = codesMap.get(product.glCode);
          if (existing) {
            existing.usageCount += 1;
          } else {
            codesMap.set(product.glCode, {
              id: `product-${product.id}`,
              code: product.glCode,
              name: product.name || product.glCode,
              category: product.category?.name || "Store",
              source: "product",
              usageCount: 1,
              isActive: product.isActive !== false,
            });
          }
        }
      });

      // Add GL codes from ledger entries
      const summaryList = Array.isArray(ledgerSummary) ? ledgerSummary : [];
      summaryList.forEach((entry: { glCode: string; netCents: number }) => {
        if (entry.glCode && entry.glCode !== "Unassigned") {
          const existing = codesMap.get(entry.glCode);
          if (existing) {
            existing.usageCount += 1;
          } else {
            codesMap.set(entry.glCode, {
              id: `ledger-${entry.glCode}`,
              code: entry.glCode,
              name: entry.glCode,
              category: "Ledger",
              source: "ledger",
              usageCount: 1,
              isActive: true,
            });
          }
        }
      });

      // Convert map to array and sort by code
      const codes = Array.from(codesMap.values()).sort((a, b) =>
        a.code.localeCompare(b.code)
      );

      setChargeCodes(codes);
      setLoading(false);
    });
  }, []);

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (item: ChargeCode) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </div>
          <code className="px-2 py-1 rounded bg-muted font-mono text-sm">
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
          <p className="font-medium text-foreground">{item.name}</p>
          <p className="text-sm text-muted-foreground">{item.category}</p>
        </div>
      ),
    },
    {
      key: "source",
      label: "Source",
      render: (item: ChargeCode) => (
        <Badge
          variant="outline"
          className={
            item.source === "system"
              ? "bg-purple-50 text-purple-700 border-purple-200"
              : item.source === "product"
              ? "bg-status-info/15 text-status-info border-blue-200"
              : item.source === "ledger"
              ? "bg-status-warning/15 text-status-warning border-amber-200"
              : "bg-muted text-foreground"
          }
        >
          {item.source === "system"
            ? "System"
            : item.source === "product"
            ? "Product"
            : item.source === "ledger"
            ? "Ledger"
            : "Other"}
        </Badge>
      ),
    },
    {
      key: "usage",
      label: "Usage",
      render: (item: ChargeCode) => (
        <span className="text-sm text-muted-foreground">
          {item.usageCount > 0 ? `${item.usageCount} items` : "Not used"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: ChargeCode) => (
        <Badge
          variant={item.isActive ? "default" : "secondary"}
          className={item.isActive ? "bg-status-success/15 text-status-success" : ""}
        >
          {item.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Charge Codes / GL Codes</h2>
          <p className="text-muted-foreground mt-1">
            Define charge codes used for billing and accounting
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
          <h2 className="text-2xl font-bold text-foreground">Charge Codes / GL Codes</h2>
          <p className="text-muted-foreground mt-1">
            Define charge codes used for billing and accounting
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <Info className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-muted-foreground">Please select a campground first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Charge Codes / GL Codes</h2>
          <p className="text-muted-foreground mt-1">
            Define charge codes used for billing and accounting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/ledger">
              <DollarSign className="h-4 w-4 mr-2" />
              View Ledger
            </Link>
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Charge Code
          </Button>
        </div>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Charge codes (also called GL codes) categorize different types of revenue for
          reporting and accounting. Each transaction is associated with a charge code.
          Codes are pulled from products, fees, and ledger entries.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Receipt className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {chargeCodes.filter((c) => c.source === "system").length}
                </p>
                <p className="text-sm text-muted-foreground">System</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-info/15">
                <Receipt className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {chargeCodes.filter((c) => c.source === "product").length}
                </p>
                <p className="text-sm text-muted-foreground">From Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-warning/15">
                <Receipt className="h-5 w-5 text-status-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {chargeCodes.filter((c) => c.source === "ledger").length}
                </p>
                <p className="text-sm text-muted-foreground">From Ledger</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-success/15">
                <Receipt className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {chargeCodes.length}
                </p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              {item.source !== "system" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
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
