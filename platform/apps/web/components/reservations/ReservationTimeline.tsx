import { Reservation } from "@campreserv/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, XCircle, CreditCard, DoorOpen } from "lucide-react";
import { format } from "date-fns";

interface ReservationTimelineProps {
    reservation: Reservation;
}

export function ReservationTimeline({ reservation }: ReservationTimelineProps) {
    const normalizeDate = (d?: string | Date | null) => (d ? new Date(d) : new Date());
    const paidCents = reservation.paidAmount ?? 0;

    // Get payments from reservation (now included in Reservation type)
    const payments = reservation.payments || [];
    const firstPaymentDate = payments.length > 0
        ? normalizeDate(payments[0].createdAt)
        : null;

    const events = [
        {
            title: "Reservation Created",
            date: normalizeDate(reservation.createdAt),
            icon: Clock,
            color: "text-muted-foreground",
            bg: "bg-muted"
        }
    ];

    // Add payment events from actual payments array if available
    if (payments.length > 0) {
        payments.forEach((payment) => {
            const isRefund = payment.direction === "refund";
            events.push({
                title: isRefund
                    ? `Refund Issued ($${((payment.amountCents ?? 0) / 100).toFixed(2)})`
                    : `Payment Received ($${((payment.amountCents ?? 0) / 100).toFixed(2)})`,
                date: normalizeDate(payment.createdAt),
                icon: CreditCard,
                color: isRefund ? "text-status-error" : "text-status-success",
                bg: isRefund ? "bg-status-error/10" : "bg-status-success/10"
            });
        });
    } else if (paidCents > 0) {
        // Fallback if no payments array but paidAmount exists
        events.push({
            title: `Payment Received ($${(paidCents / 100).toFixed(2)})`,
            date: normalizeDate(reservation.updatedAt), // Use updatedAt as better approximation
            icon: CreditCard,
            color: "text-status-success",
            bg: "bg-status-success/10"
        });
    }

    if (reservation.status === "checked_in" || reservation.status === "checked_out") {
        events.push({
            title: "Guest Checked In",
            date: normalizeDate(reservation.checkInAt),
            icon: CheckCircle2,
            color: "text-status-info",
            bg: "bg-status-info/10"
        });
    }

    if (reservation.status === "checked_out") {
        events.push({
            title: "Guest Checked Out",
            date: normalizeDate(reservation.checkOutAt),
            icon: DoorOpen,
            color: "text-muted-foreground",
            bg: "bg-muted"
        });
    }

    if (reservation.status === "cancelled") {
        events.push({
            title: "Reservation Cancelled",
            date: normalizeDate(reservation.updatedAt),
            icon: XCircle,
            color: "text-status-error",
            bg: "bg-status-error/10"
        });
    }

    // Sort by date ascending (oldest first) for proper chronological timeline
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    Timeline
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative space-y-6 pl-2">
                    {events.map((event, i) => (
                        <div key={i} className="relative flex gap-4">
                            {/* Line */}
                            {i !== events.length - 1 && (
                                <div className="absolute left-[19px] top-10 bottom-[-24px] w-0.5 bg-border" />
                            )}

                            <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center ${event.bg} border-2 border-card shadow-sm`}>
                                <event.icon className={`w-5 h-5 ${event.color}`} />
                            </div>

                            <div className="flex-1 pt-2">
                                <div className="font-medium text-foreground">{event.title}</div>
                                <div className="text-sm text-muted-foreground">
                                    {format(new Date(event.date), "MMM d, yyyy 'at' h:mm a")}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
