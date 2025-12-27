"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCampground } from "@/contexts/CampgroundContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Percent,
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
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface TaxRule {
  id: string;
  name: string;
  rate: number;
  appliesToAccommodation: boolean;
  appliesToStore: boolean;
  appliesToServices: boolean;
  isActive: boolean;
}

async function fetchTaxRules(campgroundId: string): Promise<TaxRule[]> {
  const response = await fetch(`${API_BASE}/tax-rules/campground/${campgroundId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch tax rules");
  }
  return response.json();
}

async function deleteTaxRule(taxRuleId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tax-rules/${taxRuleId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to delete tax rule");
  }
}

export default function TaxRulesPage() {
  const { selectedCampground, isHydrated } = useCampground();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: taxRules = [], isLoading } = useQuery({
    queryKey: ["tax-rules", selectedCampground?.id],
    queryFn: () => fetchTaxRules(selectedCampground!.id),
    enabled: isHydrated && !!selectedCampground?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTaxRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-rules", selectedCampground?.id] });
    },
  });

  if (!isHydrated || !selectedCampground) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const totalAccommodationTax = taxRules
    .filter((t) => t.isActive && t.appliesToAccommodation)
    .reduce((sum, t) => sum + t.rate, 0);

  const totalStoreTax = taxRules
    .filter((t) => t.isActive && t.appliesToStore)
    .reduce((sum, t) => sum + t.rate, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tax Rules</h2>
          <p className="text-slate-500 mt-1">
            Configure tax rates and how they apply to different charges
          </p>
        </div>
        <Button onClick={() => setIsEditorOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tax Rule
        </Button>
      </div>

      <Alert className="bg-amber-50 border-amber-200">
        <Info className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-800">
          Tax rules are automatically applied to invoices based on the charge type.
          Consult with your accountant to ensure compliance with local tax regulations.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Percent className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-900">
                  {totalAccommodationTax.toFixed(1)}%
                </p>
                <p className="text-sm text-emerald-700">Total Accommodation Tax</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Percent className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {totalStoreTax.toFixed(1)}%
                </p>
                <p className="text-sm text-slate-500">Total Store Tax</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Rules List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-900">
          Tax Rules ({taxRules.length})
        </h3>

        {taxRules.map((rule) => (
          <Card
            key={rule.id}
            className={cn(
              "transition-all hover:shadow-md group",
              !rule.isActive && "opacity-60"
            )}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-slate-100">
                    <Percent className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{rule.name}</p>
                      {!rule.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {rule.appliesToAccommodation && (
                        <Badge variant="outline" className="text-xs">
                          Accommodation
                        </Badge>
                      )}
                      {rule.appliesToStore && (
                        <Badge variant="outline" className="text-xs">
                          Store
                        </Badge>
                      )}
                      {rule.appliesToServices && (
                        <Badge variant="outline" className="text-xs">
                          Services
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-lg font-semibold text-slate-900">
                    {rule.rate}%
                  </span>

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
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        {rule.isActive ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tax Rule</DialogTitle>
            <DialogDescription>
              Configure a new tax rate and where it applies
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tax Name</Label>
              <Input id="name" placeholder="e.g., State Sales Tax" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Tax Rate (%)</Label>
              <div className="flex items-center gap-2">
                <Input id="rate" type="number" step="0.1" defaultValue="6.5" className="w-24" />
                <span className="text-slate-500">%</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium">Applies To</Label>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label htmlFor="accommodation" className="font-normal">
                  Accommodation charges
                </Label>
                <Switch id="accommodation" defaultChecked />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label htmlFor="store" className="font-normal">
                  Store purchases
                </Label>
                <Switch id="store" defaultChecked />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label htmlFor="services" className="font-normal">
                  Service fees
                </Label>
                <Switch id="services" defaultChecked />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsEditorOpen(false)}>
              Add Tax Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
