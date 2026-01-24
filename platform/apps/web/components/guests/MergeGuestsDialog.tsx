"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Users, ArrowRight, Crown, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Guest = {
  id: string;
  primaryFirstName: string;
  primaryLastName: string;
  email: string;
  phone?: string | null;
  vip?: boolean;
  city?: string | null;
  state?: string | null;
};

interface MergeGuestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guests: Guest[];
  campgroundId: string;
  onSuccess?: () => void;
}

export function MergeGuestsDialog({
  open,
  onOpenChange,
  guests,
  campgroundId,
  onSuccess,
}: MergeGuestsDialogProps) {
  const [primaryId, setPrimaryId] = useState<string>(guests[0]?.id || "");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (guests.length !== 2) {
        throw new Error("Select exactly 2 guests to merge");
      }
      const secondaryId = guests.find((g) => g.id !== primaryId)?.id;
      if (!secondaryId) {
        throw new Error("Could not determine secondary guest");
      }
      return apiClient.mergeGuests(primaryId, secondaryId);
    },
    onSuccess: (mergedGuest) => {
      toast({
        title: "Guests merged successfully",
        description: `Records have been consolidated under ${mergedGuest.primaryFirstName} ${mergedGuest.primaryLastName}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["guests", campgroundId] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "An error occurred while merging guests";
      toast({
        title: "Failed to merge guests",
        description: message,
        variant: "destructive",
      });
    },
  });

  if (guests.length !== 2) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Merge Guests
            </DialogTitle>
            <DialogDescription>Please select exactly 2 guests to merge.</DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center">
            <AlertTriangle className="h-12 w-12 text-status-warning mx-auto mb-3" />
            <p className="text-muted-foreground">
              You have selected {guests.length} guest{guests.length !== 1 ? "s" : ""}.
              <br />
              Select exactly 2 guests to merge.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const primaryGuest = guests.find((g) => g.id === primaryId);
  const secondaryGuest = guests.find((g) => g.id !== primaryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Merge Guest Records
          </DialogTitle>
          <DialogDescription>
            Select which guest profile to keep as the primary. The other profile will be merged into
            it.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={primaryId} onValueChange={setPrimaryId} className="space-y-3">
            {guests.map((guest) => (
              <div
                key={guest.id}
                className={cn(
                  "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-all",
                  primaryId === guest.id
                    ? "border-status-success-border bg-status-success-bg ring-2 ring-status-success/20"
                    : "border-border hover:border-border",
                )}
                onClick={() => setPrimaryId(guest.id)}
              >
                <RadioGroupItem value={guest.id} id={guest.id} />
                <Label htmlFor={guest.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {guest.primaryFirstName} {guest.primaryLastName}
                        </span>
                        {guest.vip && (
                          <Badge
                            variant="outline"
                            className="border-status-warning-border bg-status-warning-bg text-status-warning-text"
                          >
                            <Crown className="h-3 w-3 mr-1" />
                            VIP
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {guest.email}
                        {guest.phone && ` | ${guest.phone}`}
                      </div>
                      {(guest.city || guest.state) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {[guest.city, guest.state].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                    {primaryId === guest.id && (
                      <Badge className="bg-status-success text-status-success-foreground">
                        <Check className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="rounded-lg bg-muted border border-border p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-status-warning" />
            What will happen:
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
            <li>
              All reservations from{" "}
              <strong>
                {secondaryGuest?.primaryFirstName} {secondaryGuest?.primaryLastName}
              </strong>{" "}
              will be transferred to{" "}
              <strong>
                {primaryGuest?.primaryFirstName} {primaryGuest?.primaryLastName}
              </strong>
            </li>
            <li>Messages, equipment, and loyalty points will be combined</li>
            <li>Missing contact info will be filled from the secondary profile</li>
            <li>VIP status and marketing opt-in will be preserved if either guest had them</li>
            <li className="text-status-error">
              <strong>
                {secondaryGuest?.primaryFirstName} {secondaryGuest?.primaryLastName}
              </strong>
              's profile will be deleted
            </li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mergeMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mergeMutation.mutate()}
            disabled={mergeMutation.isPending}
            className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover"
          >
            {mergeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Merge Guests
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
