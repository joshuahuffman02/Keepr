import { Reservation } from "@campreserv/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { format } from "date-fns";
import Link from "next/link";
import { Pencil } from "lucide-react";

interface ReservationHeaderProps {
    reservation: Reservation;
    onCheckIn: () => void;
    onCheckOut: () => void;
    onCancel: () => void;
    isProcessing: boolean;
    onEdit?: () => void;
}

export function ReservationHeader({ reservation, onCheckIn, onCheckOut, onCancel, isProcessing, onEdit }: ReservationHeaderProps) {
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
            case "confirmed": return "bg-blue-100 text-blue-800";
            case "checked_in": return "bg-green-100 text-green-800";
            case "checked_out": return "bg-slate-100 text-slate-800";
            case "cancelled": return "bg-red-100 text-red-800";
            default: return "bg-slate-100 text-slate-800";
        }
    };

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white border-b border-slate-200">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-slate-900">Reservation #{reservation.id.slice(0, 8)}</h1>
                    <Badge className={getStatusColor(reservation.status)}>
                        {reservation.status.replace("_", " ").toUpperCase()}
                    </Badge>
                </div>
                <p className="text-slate-500">
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
                    <Button onClick={onCheckIn} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
                        Check In Guest
                    </Button>
                )}
                {canCheckOut && (
                    <Button onClick={onCheckOut} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
                        Check Out Guest
                    </Button>
                )}
                {canCancel && (
                    <ConfirmDialog
                        trigger={
                            <Button variant="outline" disabled={isProcessing} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
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
