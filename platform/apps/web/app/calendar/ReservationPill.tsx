import { CheckCircle, Clock, XCircle, HelpCircle, Wrench, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

interface ReservationPillProps {
    reservation: any; // Replace with proper type
    style: React.CSSProperties;
    isHighlighted: boolean;
    hasMaintenance?: boolean;
    needsCleaning?: boolean;
    hasConflict?: boolean;
    onClick: (e: React.MouseEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
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
    hasConflict
}: ReservationPillProps) {
    const statusConfig = {
        confirmed: { bg: "bg-emerald-600", icon: CheckCircle, border: "border-emerald-700" },
        checked_in: { bg: "bg-blue-600", icon: Clock, border: "border-blue-700" }, // Clock or maybe LogIn icon
        cancelled: { bg: "bg-rose-500", icon: XCircle, border: "border-rose-600" },
        pending: { bg: "bg-amber-500", icon: HelpCircle, border: "border-amber-600" },
    };

    const config = statusConfig[reservation.status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    const guestName = `${reservation.guest?.primaryFirstName || ""} ${reservation.guest?.primaryLastName || ""}`.trim() || "Guest";
    const total = (reservation.totalAmount ?? 0) / 100;

    return (
        <div
            className={cn(
                "absolute top-1 bottom-1 rounded-md text-xs text-white shadow-sm flex items-center px-2 overflow-hidden border transition-all hover:brightness-110 hover:shadow-md hover:z-10 cursor-pointer",
                config.bg,
                config.border,
                isHighlighted ? "ring-2 ring-white ring-offset-2 ring-offset-slate-100 z-20" : "z-10"
            )}
            style={style}
            title={`${guestName} • ${reservation.status}`}
            onClick={onClick}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
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
        </div>
    );
}
