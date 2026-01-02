import { Reservation } from "@campreserv/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { format } from "date-fns";
import Link from "next/link";
import { Pencil, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ReservationHeaderProps {
    reservation: Reservation;
    onCheckIn: () => void;
    onCheckOut: () => void;
    onCancel: () => void;
    isProcessing: boolean;
    onEdit?: () => void;
}

export function ReservationHeader({ reservation, onCheckIn, onCheckOut, onCancel, isProcessing, onEdit }: ReservationHeaderProps) {
    const [copied, setCopied] = useState(false);

    const copyReservationId = async () => {
        await navigator.clipboard.writeText(reservation.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isToday = (date: Date | string) => {
        const d = new Date(date);
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    };

    const canCheckIn = reservation.status === "confirmed" && isToday(reservation.arrivalDate);
    const canCheckOut = reservation.status === "checked_in";
    const canCancel = reservation.status !== "checked_out" && reservation.status !== "cancelled";

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmed": return "bg-status-info-bg text-status-info-text";
            case "checked_in": return "bg-status-success-bg text-status-success-text";
            case "checked_out": return "bg-muted text-muted-foreground";
            case "cancelled": return "bg-status-error-bg text-status-error-text";
            default: return "bg-muted text-muted-foreground";
        }
    };

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-card border-b border-border">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-foreground">Reservation #{reservation.id.slice(0, 8)}</h1>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={copyReservationId}
                                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-muted-foreground transition-colors"
                                        aria-label="Copy full reservation ID"
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4 text-status-success" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="font-mono text-xs">{reservation.id}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{copied ? "Copied!" : "Click to copy"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <Badge className={getStatusColor(reservation.status)}>
                        {reservation.status.replace("_", " ").toUpperCase()}
                    </Badge>
                </div>
                <p className="text-muted-foreground">
                    Created on {format(new Date(reservation.createdAt ?? Date.now()), "MMM d, yyyy")}
                </p>
            </div>
            <div className="flex gap-2">
                {/* Edit button - always show for non-cancelled reservations */}
                {reservation.status !== "cancelled" && reservation.status !== "checked_out" && (
                    <Link href={`/campgrounds/${reservation.campgroundId}/reservations/${reservation.id}`}>
                        <Button variant="outline" disabled={isProcessing}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    </Link>
                )}
                {canCheckIn && (
                    <Button onClick={onCheckIn} disabled={isProcessing}>
                        Check In Guest
                    </Button>
                )}
                {canCheckOut && (
                    <Button variant="secondary" onClick={onCheckOut} disabled={isProcessing}>
                        Check Out Guest
                    </Button>
                )}
                {canCancel && (
                    <ConfirmDialog
                        trigger={
                            <Button
                                variant="outline"
                                disabled={isProcessing}
                                className="text-status-error hover:text-status-error hover:bg-status-error/10 border-status-error/30"
                            >
                                Cancel Reservation
                            </Button>
                        }
                        title="Cancel reservation?"
                        description="This will cancel the reservation. This action cannot be undone."
                        confirmLabel="Cancel Reservation"
                        variant="destructive"
                        onConfirm={onCancel}
                        isPending={isProcessing}
                    />
                )}
            </div>
        </div>
    );
}
