"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CreditCard, Trash2, Star, Plus, Shield } from "lucide-react";
import { format } from "date-fns";

interface GuestPaymentMethodsProps {
  guestId: string;
  campgroundId: string;
  /** Additional campground IDs to fetch payment methods from (for multi-park guests) */
  additionalCampgroundIds?: string[];
}

type PaymentMethod = {
  id: string;
  stripePaymentMethodId: string;
  type: string;
  last4: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  nickname: string | null;
  addedBy: string;
  createdAt: string;
};

const CARD_BRAND_COLORS: Record<string, string> = {
  visa: "bg-blue-600",
  mastercard: "bg-red-500",
  amex: "bg-blue-400",
  discover: "bg-orange-500",
  default: "bg-slate-600",
};

function getCardBrandColor(brand: string | null): string {
  if (!brand) return CARD_BRAND_COLORS.default;
  return CARD_BRAND_COLORS[brand.toLowerCase()] || CARD_BRAND_COLORS.default;
}

export function GuestPaymentMethods({ guestId, campgroundId, additionalCampgroundIds = [] }: GuestPaymentMethodsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddCard, setShowAddCard] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");

  // Get all unique campground IDs to fetch from
  const allCampgroundIds = [campgroundId, ...additionalCampgroundIds].filter(Boolean);
  const uniqueCampgroundIds = [...new Set(allCampgroundIds)];

  // Fetch payment methods from all campgrounds
  const { data: paymentMethodsResults, isLoading } = useQuery({
    queryKey: ["guest-payment-methods-all", uniqueCampgroundIds, guestId],
    queryFn: async () => {
      const results = await Promise.all(
        uniqueCampgroundIds.map(cgId =>
          apiClient.getGuestPaymentMethods(cgId, guestId).catch(() => [])
        )
      );
      // Aggregate and deduplicate by stripePaymentMethodId
      const allMethods: PaymentMethod[] = results.flat();
      const seen = new Set<string>();
      return allMethods.filter(pm => {
        if (seen.has(pm.stripePaymentMethodId)) return false;
        seen.add(pm.stripePaymentMethodId);
        return true;
      });
    },
    enabled: uniqueCampgroundIds.length > 0 && !!guestId,
  });

  const paymentMethods = paymentMethodsResults;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      apiClient.deletePaymentMethod(campgroundId, paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-payment-methods-all"] });
      toast({ title: "Card removed", description: "Payment method deleted successfully." });
      setDeleteConfirm(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      apiClient.setDefaultPaymentMethod(campgroundId, guestId, paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-payment-methods-all"] });
      toast({ title: "Default updated", description: "Default payment method changed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Update nickname mutation
  const updateNicknameMutation = useMutation({
    mutationFn: ({ id, nickname }: { id: string; nickname: string }) =>
      apiClient.updatePaymentMethod(campgroundId, id, { nickname }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-payment-methods-all"] });
      toast({ title: "Updated", description: "Card nickname updated." });
      setEditingNickname(null);
      setNickname("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Create setup intent for adding new card
  const createSetupIntentMutation = useMutation({
    mutationFn: () => apiClient.createPaymentMethodSetupIntent(campgroundId, guestId),
    onSuccess: (data) => {
      // In a real implementation, you would use Stripe.js to collect card details
      // For now, show instructions
      toast({
        title: "Setup Intent Created",
        description: `Client secret: ${data.clientSecret.slice(0, 20)}... Use Stripe.js to collect card.`,
      });
      setShowAddCard(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const formatExpiry = (month: number | null, year: number | null) => {
    if (!month || !year) return "N/A";
    return `${month.toString().padStart(2, "0")}/${year.toString().slice(-2)}`;
  };

  const getAddedByLabel = (addedBy: string) => {
    switch (addedBy) {
      case "guest":
        return "Added by guest";
      case "staff":
        return "Added by staff";
      case "auto":
        return "Auto-saved from payment";
      default:
        return addedBy;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Saved Payment Methods
              </CardTitle>
              <CardDescription>
                Cards on file for this guest. Refunds are processed to the original payment method only.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddCard(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Card
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!paymentMethods?.length ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No saved payment methods</p>
              <p className="text-xs text-slate-400 mt-1">
                Cards are automatically saved when guests pay online, or you can add them manually.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    pm.isDefault ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-8 rounded flex items-center justify-center text-white text-xs font-bold ${getCardBrandColor(
                        pm.brand
                      )}`}
                    >
                      {pm.brand?.toUpperCase().slice(0, 4) || "CARD"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          •••• •••• •••• {pm.last4 || "****"}
                        </span>
                        {pm.isDefault && (
                          <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {pm.nickname && (
                          <span className="text-sm text-slate-500">({pm.nickname})</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Expires {formatExpiry(pm.expMonth, pm.expYear)} · {getAddedByLabel(pm.addedBy)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!pm.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(pm.id)}
                        disabled={setDefaultMutation.isPending}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingNickname(pm.id);
                        setNickname(pm.nickname || "");
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(pm.id)}
                    >
                      <Trash2 className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-medium">PCI Compliant Card Storage</p>
                <p className="mt-0.5">
                  Card details are securely stored with Stripe. We never store raw card numbers.
                  Refunds are automatically processed to the original payment method.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Card Dialog */}
      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Create a setup intent to securely collect card details.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-4">
              This will create a Stripe SetupIntent. In production, you would use Stripe Elements
              or the Payment Element to collect card details securely.
            </p>
            <div className="p-4 bg-slate-50 rounded-lg border">
              <p className="text-xs text-slate-500">
                The guest can also add cards themselves through the guest portal, or cards are
                automatically saved when they make payments online.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCard(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createSetupIntentMutation.mutate()}
              disabled={createSetupIntentMutation.isPending}
            >
              {createSetupIntentMutation.isPending ? "Creating..." : "Create Setup Intent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Nickname Dialog */}
      <Dialog open={!!editingNickname} onOpenChange={() => setEditingNickname(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Card Nickname</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Nickname</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g., Personal Visa, Business Card"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNickname(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingNickname) {
                  updateNicknameMutation.mutate({ id: editingNickname, nickname });
                }
              }}
              disabled={updateNicknameMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Payment Method?</DialogTitle>
            <DialogDescription>
              This will remove the card from the guest's account. Any active subscriptions or
              scheduled payments using this card will need a new payment method.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate(deleteConfirm);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removing..." : "Remove Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
