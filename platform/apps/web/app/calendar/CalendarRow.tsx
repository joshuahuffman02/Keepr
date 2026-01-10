import { memo } from "react";
import { ReservationPill } from "./ReservationPill";
import { RowSelectionOverlay } from "./RowSelectionOverlay";
import { cn } from "../../lib/utils";
import type { CalendarSite, CalendarReservation, CalendarSelection, GanttSelection, DayMeta, ReservationDragMode, CalendarBlackout } from "./types";
import { Wrench, Sparkles, AlertTriangle, Calendar, Tent, Ban } from "lucide-react";
import { diffInDays, parseLocalDateInput } from "./utils";

interface CalendarRowProps {
    site: CalendarSite;
    days: DayMeta[];
    reservations: CalendarReservation[];
    blackouts: CalendarBlackout[];
    gridTemplate: string;
    dayCount: number;
    zebra: string;
    selection: CalendarSelection | null;
    ganttSelection: GanttSelection;
    handlers: {
        onDragStart: (siteId: string, dayIdx: number) => void;
        onDragEnter: (siteId: string, dayIdx: number) => void;
        onDragEnd: (siteId: string | null, dayIdx: number | null) => void;
        onReservationClick: (resId: string) => void;
        onQuickCheckIn?: (reservationId: string) => void;
        onReservationDragStart?: (reservationId: string, mode: ReservationDragMode) => void;
    };
    today: Date;
}

export const CalendarRow = memo(function CalendarRow({
    site,
    days,
    reservations,
    blackouts,
    gridTemplate,
    dayCount,
    zebra,
    selection,
    ganttSelection,
    handlers,
    today
}: CalendarRowProps) {
    const { onDragStart, onDragEnter, onDragEnd, onReservationClick, onQuickCheckIn, onReservationDragStart } = handlers;

    const isArrivalToday = (res: CalendarReservation) => {
        const arrivalDate = parseLocalDateInput(res.arrivalDate);
        return (
            arrivalDate.getDate() === today.getDate() &&
            arrivalDate.getMonth() === today.getMonth() &&
            arrivalDate.getFullYear() === today.getFullYear()
        );
    };

    return (
        <div
            className="grid relative group hover:bg-muted/50 transition-colors"
            style={{ gridTemplateColumns: gridTemplate }}
            data-site-id={site.id}
            onDragStart={(e) => e.preventDefault()}
        >
            {/* Site Info Column */}
            <div className={cn("px-4 py-3 sticky left-0 z-20 border-r border-border flex flex-col justify-center", zebra)}>
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate" title={site.name}>{site.name}</div>
                        <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                            <span>{site.siteType}</span>
                            <span className="w-1 h-1 rounded-full bg-muted" />
                            <span>Site {site.siteNumber}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid Cells Container */}
            <div className="relative" style={{ gridColumn: "2 / -1" }}>
                {/* Background Grid */}
                <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(94px, 1fr))` }}>
                    {days.map((d, i) => (
                        <div
                            key={i}
                            data-day-idx={i}
                            className={cn(
                                "border-r border-border cursor-crosshair transition-colors h-16 touch-none",
                                zebra,
                                d.isToday && "bg-status-info/5",
                                d.weekend && "bg-muted/50",
                                "hover:bg-status-info/10"
                            )}
                            onPointerDown={(e) => {
                                // Important: release pointer capture so pointerenter/enter triggers on other cells
                                const target = e.currentTarget as HTMLElement;
                                if (target.hasPointerCapture?.(e.pointerId)) {
                                    target.releasePointerCapture(e.pointerId);
                                }
                                onDragStart(site.id, i);
                            }}
                            onPointerEnter={() => onDragEnter(site.id, i)}
                            onPointerUp={() => onDragEnd(site.id, i)}
                        />
                    ))}
                </div>

                {/* Overlay Layer (Selection & Reservations) */}
                <div
                    className="grid absolute inset-0 items-center pointer-events-none"
                    style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(94px, 1fr))` }}
                >
                    {/* Active Drag Selection Overlay (Smarter re-renders) */}
                    <RowSelectionOverlay siteId={site.id} siteName={site.name} dayCount={dayCount} />

                    {/* Stored Selection Pill */}
                    {selection &&
                        selection.siteId === site.id &&
                        (() => {
                            const start = days[0].date;
                            const resStart = parseLocalDateInput(selection.arrival);
                            const resEnd = parseLocalDateInput(selection.departure);
                            const selStartIdx = Math.max(0, diffInDays(resStart, start));
                            const selEndIdx = Math.min(dayCount, diffInDays(resEnd, start));
                            if (selEndIdx <= 0 || selStartIdx >= dayCount) return null;
                            const span = Math.max(1, selEndIdx - selStartIdx);
                            return (
                                <div
                                    key="selection-pill-stored"
                                    className="mx-1 rounded-lg bg-purple-500/10 border-2 border-purple-500 border-dashed h-12 z-10 flex items-center justify-center animate-pulse"
                                    style={{
                                        gridColumn: `${selStartIdx + 1} / span ${span}`,
                                    }}
                                >
                                    <span className="text-[10px] font-bold text-purple-700 bg-card/90 px-2 py-0.5 rounded shadow-sm">
                                        Selected Stays
                                    </span>
                                </div>
                            );
                        })()}

                    {/* Blackouts */}
                    {blackouts.map((blackout) => {
                        const start = days[0].date;
                        const blackoutStart = parseLocalDateInput(blackout.startDate);
                        const blackoutEnd = parseLocalDateInput(blackout.endDate);
                        const startIdx = Math.max(0, diffInDays(blackoutStart, start));
                        const endIdx = Math.min(dayCount, diffInDays(blackoutEnd, start) + 1); // +1 because end is inclusive

                        if (endIdx <= 0 || startIdx >= dayCount) return null;

                        const span = Math.max(1, endIdx - startIdx);

                        return (
                            <div
                                key={blackout.id}
                                className="relative h-full w-full pointer-events-none"
                                style={{
                                    gridColumn: `${startIdx + 1} / span ${span}`,
                                    zIndex: 15
                                }}
                                title={blackout.reason || "Blocked"}
                            >
                                <div className="absolute inset-0 mx-0.5 my-1 rounded-md bg-destructive/10 border border-destructive/30 flex items-center justify-center overflow-hidden">
                                    {/* Hatching pattern */}
                                    <div
                                        className="absolute inset-0 opacity-20"
                                        style={{
                                            backgroundImage: `repeating-linear-gradient(
                                                45deg,
                                                transparent,
                                                transparent 4px,
                                                currentColor 4px,
                                                currentColor 5px
                                            )`,
                                            color: 'hsl(var(--destructive))'
                                        }}
                                    />
                                    <div className="relative z-10 flex items-center gap-1 bg-card/90 px-2 py-0.5 rounded text-[10px] font-medium text-destructive">
                                        <Ban className="h-3 w-3" />
                                        <span className="truncate max-w-[80px]">{blackout.reason || "Blocked"}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Reservations */}
                    {reservations.map((res) => {
                        const start = days[0].date;
                        const resStart = parseLocalDateInput(res.arrivalDate);
                        const resEnd = parseLocalDateInput(res.departureDate);
                        const startIdx = Math.max(0, diffInDays(resStart, start));
                        const endIdx = Math.min(dayCount, diffInDays(resEnd, start));

                        if (endIdx <= 0 || startIdx >= dayCount) return null;

                        const span = Math.max(1, endIdx - startIdx);

                        return (
                            <div
                                key={res.id}
                                className="relative h-full w-full pointer-events-auto reservation-wrapper"
                                style={{
                                    gridColumn: `${startIdx + 1} / span ${span}`,
                                    zIndex: 20
                                }}
                            >
                                <ReservationPill
                                    reservation={res}
                                    isHighlighted={ganttSelection.highlightedId === res.id}
                                    style={{ width: "calc(100% - 6px)", left: "3px", right: "3px" }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onReservationClick(res.id);
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onPointerUp={(e) => e.stopPropagation()}
                                    onQuickCheckIn={onQuickCheckIn}
                                    isArrivalToday={isArrivalToday(res)}
                                    onDragStart={onReservationDragStart}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
