"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCampground } from "@/contexts/CampgroundContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Calendar,
  Moon,
  Info,
  Pencil,
  Trash2,
  MoreHorizontal,
  Copy,
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

interface StayRule {
  id: string;
  name: string;
  minNights: number;
  maxNights: number;
  siteClasses: string[];
  dateRanges: { start: string; end: string }[];
  ignoreDaysBefore: number;
  isActive: boolean;
}

async function fetchStayRules(campgroundId: string): Promise<StayRule[]> {
  const response = await fetch(`${API_BASE}/campgrounds/${campgroundId}/stay-rules`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch stay rules");
  }
  return response.json();
}

async function deleteStayRule(campgroundId: string, ruleId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/stay-rules/${ruleId}?campgroundId=${encodeURIComponent(campgroundId)}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error("Failed to delete stay rule");
  }
}

export default function StayRulesPage() {
  const { selectedCampground, isHydrated } = useCampground();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<StayRule | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["stay-rules", selectedCampground?.id],
    queryFn: () => fetchStayRules(selectedCampground!.id),
    enabled: isHydrated && !!selectedCampground?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteStayRule(selectedCampground!.id, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stay-rules", selectedCampground?.id] });
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

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Stay Rules</h2>
          <p className="text-muted-foreground mt-1">
            Set minimum and maximum night requirements for bookings
          </p>
        </div>
        <Button onClick={() => setIsEditorOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Stay Rule
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Stay rules enforce minimum and maximum night requirements. Rules with date ranges apply
          only during those periods. The "Ignore Days Before" setting allows last-minute bookings to
          bypass minimum requirements.
        </AlertDescription>
      </Alert>

      {/* Default Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Stay Limits</CardTitle>
          <CardDescription>These apply when no specific rules match</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Minimum Nights</Label>
              <Input type="number" defaultValue="1" className="w-24" />
            </div>
            <div className="space-y-2">
              <Label>Default Maximum Nights</Label>
              <Input type="number" defaultValue="28" className="w-24" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Custom Rules ({rules.length})</h3>

        {rules.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-muted mb-4">
                <Moon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No stay rules</h3>
              <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                Create stay rules to set minimum and maximum night requirements
              </p>
              <Button className="mt-4" onClick={() => setIsEditorOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Stay Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card
              key={rule.id}
              className={cn("transition-all hover:shadow-md group", !rule.isActive && "opacity-60")}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      <Moon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{rule.name}</p>
                        {!rule.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {rule.minNights}-{rule.maxNights} nights
                        </span>
                        <span>•</span>
                        <span>{rule.siteClasses.join(", ")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {rule.dateRanges.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {rule.dateRanges.length} date range{rule.dateRanges.length !== 1 && "s"}
                      </Badge>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="More options"
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
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          {rule.isActive ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteMutation.mutate(rule.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Stay Rule</DialogTitle>
            <DialogDescription>Create a new minimum/maximum night requirement</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input id="rule-name" placeholder="e.g., Peak Summer Minimum" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-nights">Minimum Nights</Label>
                <Input id="min-nights" type="number" min={1} defaultValue={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-nights">Maximum Nights</Label>
                <Input id="max-nights" type="number" min={1} defaultValue={14} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Apply to Site Types</Label>
              <div className="flex flex-wrap gap-2">
                {["RV", "Tent", "Cabin", "Other"].map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="data-[selected=true]:bg-emerald-100 data-[selected=true]:border-emerald-300"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ignore Minimum</Label>
              <div className="flex items-center gap-2">
                <Input type="number" defaultValue={14} className="w-20" />
                <span className="text-sm text-muted-foreground">
                  days before arrival (allows last-minute bookings)
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsEditorOpen(false)}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
