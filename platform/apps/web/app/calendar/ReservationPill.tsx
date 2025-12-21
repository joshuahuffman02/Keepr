import { CheckCircle, Clock, XCircle, HelpCircle, Wrench, Sparkles, AlertTriangle, Lock, LogIn } from "lucide-react";
import { useCalendarContext } from "./CalendarContext";
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
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onQuickCheckIn?: (reservationId: string) => void;
    isArrivalToday?: boolean;
}

export function ReservationPill({
    reservation,
    style,
    isHighlighted,
    onClick,
    onPointerDown,
    onPointerUp,
    hasMaintenance,
    needsCleaning,
    hasConflict,
    onQuickCheckIn,
    isArrivalToday
}: ReservationPillProps) {
    const { dragState } = useCalendarContext();
    const isDragging = dragState.isDragging;
    // Wrapper handlers that stop propagation to prevent double events
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(e);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        onPointerDown(e);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        onPointerUp(e);
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
    const showSignals = hasMaintenance || needsCleaning || hasConflict || reservation.siteLocked;
    const lockedAccent = reservation.siteLocked
        ? "border-amber-200/70 shadow-[0_0_0_1px_rgba(251,191,36,0.45)]"
        : "";

    const statusConfig = {
        confirmed: {
            bg: "bg-gradient-to-br from-emerald-500/90 to-emerald-600/95",
            icon: CheckCircle,
            border: "border-emerald-400/30",
            shadow: "shadow-[0_2px_8px_-2px_rgba(16,185,129,0.4)]"
        },
        checked_in: {
            bg: "bg-gradient-to-br from-blue-500/90 to-blue-600/95",
            icon: Clock,
            border: "border-blue-400/30",
            shadow: "shadow-[0_2px_8px_-2px_rgba(59,130,246,0.4)]"
        },
        cancelled: {
            bg: "bg-gradient-to-br from-rose-400/90 to-rose-500/95",
            icon: XCircle,
            border: "border-rose-400/30",
            shadow: "shadow-[0_2px_8px_-2px_rgba(244,63,94,0.4)]"
        },
        pending: {
            bg: "bg-gradient-to-br from-amber-400/90 to-amber-500/95",
            icon: HelpCircle,
            border: "border-amber-400/30",
            shadow: "shadow-[0_2px_8px_-2px_rgba(245,158,11,0.4)]"
        },
    };

    const config = statusConfig[reservation.status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    const guestName = `${reservation.guest?.primaryFirstName || ""} ${reservation.guest?.primaryLastName || ""}`.trim() || "Guest";
    const total = (reservation.totalAmount ?? 0) / 100;

    return (
        <div
            className={cn(
                "group absolute top-1.5 bottom-1.5 rounded-lg text-[11px] text-white backdrop-blur-[2px] flex items-center px-2.5 overflow-hidden border transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer",
                "hover:scale-[1.015] hover:brightness-110 hover:shadow-xl hover:z-30 active:scale-[0.985]",
                config.bg,
                config.border,
                config.shadow,
                lockedAccent,
                isHighlighted ? "ring-2 ring-white/60 ring-offset-2 ring-offset-slate-100 z-20 shadow-lg" : "z-10",
                isDragging && "pointer-events-none opacity-40 grayscale-[0.5]"
            )}
            style={style}
            title={`${guestName} • ${reservation.status}`}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
        >
            {reservation.siteLocked && (
                <span className="absolute left-0 top-0 bottom-0 w-2 bg-amber-300/95 rounded-l-lg" aria-hidden="true" />
            )}
            <div className="flex items-center min-w-0 w-full">
                <Icon className="w-3 h-3 mr-2 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col leading-none min-w-0 flex-1">
                    <span className="font-bold truncate tracking-tight">{guestName}</span>
                    {style.width && parseInt(style.width.toString()) > 120 && (
                        <span className="text-[9px] opacity-70 truncate font-mono mt-0.5">${total.toFixed(0)}</span>
                    )}
                </div>
                {showSignals && (
                    <div className="ml-2 flex gap-1 items-center flex-shrink-0">
                        {reservation.siteLocked && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-300/40 ring-1 ring-amber-200/70">
                                <Lock className="h-3 w-3 text-white" aria-label="Site locked" />
                            </span>
                        )}
                        {hasMaintenance && <Wrench className="h-2.5 w-2.5 text-amber-100/80" />}
                        {needsCleaning && <Sparkles className="h-2.5 w-2.5 text-cyan-100/80" />}
                        {hasConflict && <AlertTriangle className="h-2.5 w-2.5 text-rose-100/80" aria-label="Conflict" />}
                    </div>
                )}
            </div>

            {/* Gloss Highlight effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

            {/* Quick Check-in Button */}
            {showQuickCheckIn && (
                <button
                    type="button"
                    onClick={handleQuickCheckIn}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white shadow-md text-emerald-600 rounded-full p-1.5 hover:scale-110 active:scale-90"
                    title="Quick Check-in"
                >
                    <LogIn className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}
