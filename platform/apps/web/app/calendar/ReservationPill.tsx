import { CheckCircle, Clock, XCircle, HelpCircle, Wrench, Sparkles, AlertTriangle, LogIn } from "lucide-react";
import { cn } from "../../lib/utils";
import type { CalendarReservation, ReservationStatus } from "./types";

interface ReservationPillProps {
    reservation: CalendarReservation;
    style: React.CSSProperties;
    isHighlighted: boolean;
    hasMaintenance?: boolean;
    needsCleaning?: boolean;
    hasConflict?: boolean;
    onClick: (e: React.MouseEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onQuickCheckIn?: (reservationId: string) => void;
    isArrivalToday?: boolean;
}

export function ReservationPill({
    reservation,
    style,
    isHighlighted,
    onClick,
    onMouseDown,
    onMouseUp,
    hasMaintenance,
    needsCleaning,
    hasConflict,
    onQuickCheckIn,
    isArrivalToday
}: ReservationPillProps) {
    // Wrapper handlers that stop propagation to prevent double events
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(e);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        onMouseDown(e);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        e.stopPropagation();
        onMouseUp(e);
    };

    const handleQuickCheckIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (onQuickCheckIn && reservation.status === "confirmed") {
            onQuickCheckIn(reservation.id);
        }
    };

    // Show quick check-in for confirmed reservations arriving today
    const showQuickCheckIn = onQuickCheckIn && reservation.status === "confirmed" && isArrivalToday;

    const statusConfig = {
        confirmed: {
            bg: "bg-gradient-to-r from-emerald-500 to-emerald-600",
            icon: CheckCircle,
            border: "border-emerald-600/50",
            shadow: "shadow-emerald-500/25"
        },
        checked_in: {
            bg: "bg-gradient-to-r from-blue-500 to-blue-600",
            icon: Clock,
            border: "border-blue-600/50",
            shadow: "shadow-blue-500/25"
        },
        cancelled: {
            bg: "bg-gradient-to-r from-rose-400 to-rose-500",
            icon: XCircle,
            border: "border-rose-500/50",
            shadow: "shadow-rose-500/25"
        },
        pending: {
            bg: "bg-gradient-to-r from-amber-400 to-amber-500",
            icon: HelpCircle,
            border: "border-amber-500/50",
            shadow: "shadow-amber-500/25"
        },
    };

    const config = statusConfig[reservation.status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    const guestName = `${reservation.guest?.primaryFirstName || ""} ${reservation.guest?.primaryLastName || ""}`.trim() || "Guest";
    const total = (reservation.totalAmount ?? 0) / 100;

    return (
        <div
            className={cn(
                "group absolute top-1 bottom-1 rounded-lg text-xs text-white shadow-md flex items-center px-2.5 overflow-hidden border transition-all duration-200 ease-out cursor-pointer",
                "hover:scale-[1.02] hover:shadow-lg hover:z-20 active:scale-[0.98]",
                config.bg,
                config.border,
                config.shadow,
                isHighlighted ? "ring-2 ring-white ring-offset-2 ring-offset-slate-100 z-20 scale-[1.02]" : "z-10"
            )}
            style={style}
            title={`${guestName} • ${reservation.status}`}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
        >
            <Icon className="w-3 h-3 mr-1.5 flex-shrink-0 opacity-90" />
            <div className="flex flex-col leading-tight min-w-0">
                <span className="font-semibold truncate">{guestName}</span>
                {style.minWidth && parseInt(style.minWidth.toString()) > 100 && (
                    <span className="text-[10px] opacity-90 truncate font-mono">${total.toFixed(0)}</span>
                )}
            </div>
            {(hasMaintenance || needsCleaning || hasConflict) && (
                <div className="ml-2 flex gap-1 items-center">
                    {hasMaintenance && <Wrench className="h-3 w-3 text-amber-100" />}
                    {needsCleaning && <Sparkles className="h-3 w-3 text-cyan-100" />}
                    {hasConflict && <AlertTriangle className="h-3 w-3 text-amber-100" aria-label="Conflict in date range" />}
                </div>
            )}
            {/* Quick Check-in Button - Shows on hover for confirmed arrivals today */}
            {showQuickCheckIn && (
                <button
                    type="button"
                    onClick={handleQuickCheckIn}
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-emerald-700 rounded-full p-1 hover:bg-white shadow-sm"
                    title="Quick Check-in"
                >
                    <LogIn className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}
