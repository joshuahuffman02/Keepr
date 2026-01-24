"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import {
  Loader2,
  Home,
  AlertCircle,
  Info,
  Search,
  User,
  MapPin,
  Calendar,
  Check,
} from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { apiClient } from "../../../../lib/api-client";
import { cn } from "../../../../lib/utils";

interface FolioMethodProps {
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

interface ReservationSearchResult {
  id: string;
  confirmationCode: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  guest: { id: string; firstName: string; lastName: string; email: string; phone: string } | null;
  site: {
    id: string;
    number: string;
    name: string | null;
    siteClass: { id: string; name: string } | null;
  } | null;
  displayLabel: string;
}

export function FolioMethod({ onSuccess, onError, onCancel }: FolioMethodProps) {
  const { state, actions, props } = usePaymentContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ReservationSearchResult[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationSearchResult | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const amountDue = state.remainingCents / 100;

  // If this is for a reservation, we might already know the site
  const isReservationContext =
    props.subject.type === "reservation" || props.subject.type === "balance";

  // Debounced search
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query || query.length < 1) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await apiClient.searchReservations(props.campgroundId, query);
        setSearchResults(results);
        setShowResults(true);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [props.campgroundId],
  );

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedReservation(null); // Clear selection when typing

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectReservation = (reservation: ReservationSearchResult) => {
    setSelectedReservation(reservation);
    setSearchQuery(reservation.displayLabel);
    setShowResults(false);
  };

  const handleCancel = () => {
    actions.selectMethod(null);
    onCancel?.();
  };

  const handleComplete = async () => {
    if (!selectedReservation && !isReservationContext) {
      setError("Please select a reservation to charge");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const targetReservationId =
        selectedReservation?.id ||
        (props.subject?.type === "reservation" || props.subject?.type === "balance"
          ? props.subject.reservationId
          : undefined);

      if (!targetReservationId) {
        throw new Error("No reservation selected");
      }

      const amountCents = state.remainingCents;
      const reference = `FOLIO-${selectedReservation?.site?.number || "RES"}-${Date.now()}`;

      // Record the payment in the database
      await apiClient.recordReservationPayment(targetReservationId, amountCents, [
        {
          method: "folio",
          amountCents,
          note: selectedReservation
            ? `Charged to ${selectedReservation.displayLabel}`
            : "Charged to reservation",
        },
      ]);

      // Add tender entry for UI tracking
      actions.addTenderEntry({
        method: "folio",
        amountCents,
        reference,
        metadata: {
          reservationId: targetReservationId,
          siteNumber: selectedReservation?.site?.number || undefined,
          guestName: selectedReservation?.guest
            ? `${selectedReservation.guest.firstName} ${selectedReservation.guest.lastName}`
            : undefined,
        },
      });

      onSuccess?.(reference);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to charge to folio";
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      checked_in: "bg-emerald-100 text-emerald-700",
      confirmed: "bg-blue-100 text-blue-700",
      pending: "bg-amber-100 text-amber-700",
    };
    return styles[status] || "bg-muted text-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Amount display */}
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Charge to Folio</p>
        <p className="text-3xl font-bold text-foreground">${amountDue.toFixed(2)}</p>
      </div>

      {/* Reservation context info */}
      {isReservationContext && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Charging to Reservation Folio</p>
            <p className="mt-1 text-blue-700">
              This amount will be added to the guest&apos;s reservation balance.
            </p>
          </div>
        </div>
      )}

      {/* Site/Guest search */}
      <div className="space-y-2">
        <Label htmlFor="site-search" className="text-sm text-muted-foreground">
          Search by Site, Guest Name, or Confirmation Code
          {!isReservationContext && <span className="text-red-500"> *</span>}
        </Label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <Input
            ref={inputRef}
            id="site-search"
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder="Type to search..."
            className="pl-10 font-medium"
            autoComplete="off"
          />

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {searchResults.map((reservation) => (
                <button
                  key={reservation.id}
                  type="button"
                  onClick={() => handleSelectReservation(reservation)}
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-muted border-b border-border last:border-b-0 transition-colors",
                    selectedReservation?.id === reservation.id && "bg-emerald-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Site + Guest */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">
                          {reservation.site?.number || reservation.site?.name || "No Site"}
                        </span>
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded-full",
                            getStatusBadge(reservation.status),
                          )}
                        >
                          {reservation.status.replace("_", " ")}
                        </span>
                      </div>

                      {/* Guest name */}
                      {reservation.guest && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span>
                            {reservation.guest.firstName} {reservation.guest.lastName}
                          </span>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {formatDate(reservation.arrivalDate)} -{" "}
                          {formatDate(reservation.departureDate)}
                        </span>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="text-right flex-shrink-0">
                      {reservation.balanceAmount > 0 ? (
                        <div className="text-sm font-medium text-amber-600">
                          ${(reservation.balanceAmount / 100).toFixed(2)} due
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          Paid
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {reservation.confirmationCode}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {showResults && searchQuery.length >= 1 && searchResults.length === 0 && !isSearching && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
              No active reservations found
            </div>
          )}
        </div>
      </div>

      {/* Selected Reservation Card */}
      {selectedReservation && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-foreground">
                {selectedReservation.site?.number || selectedReservation.site?.name || "No Site"}
              </div>
              {selectedReservation.guest && (
                <div className="text-sm text-muted-foreground">
                  {selectedReservation.guest.firstName} {selectedReservation.guest.lastName}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {formatDate(selectedReservation.arrivalDate)} -{" "}
                {formatDate(selectedReservation.departureDate)}
                {" | "}
                {selectedReservation.confirmationCode}
              </div>
            </div>
            {selectedReservation.balanceAmount > 0 && (
              <div className="text-sm font-medium text-amber-600">
                Current balance: ${(selectedReservation.balanceAmount / 100).toFixed(2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Payment Pending</p>
          <p className="mt-1 text-amber-700">
            This charge will be added to the guest&apos;s folio and will need to be collected at
            checkout.
          </p>
        </div>
      </div>

      {/* Error display */}
      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleComplete}
          disabled={(!selectedReservation && !isReservationContext) || loading}
          className="min-w-[160px]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Charging...
            </>
          ) : (
            <>
              <Home className="h-4 w-4 mr-2" />
              Charge to Folio
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default FolioMethod;
