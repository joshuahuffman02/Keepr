import { memo } from "react";
import { ReservationPill } from "./ReservationPill";
import { RowSelectionOverlay } from "./RowSelectionOverlay";
import { useCalendarContext } from "./CalendarContext";
import { cn } from "../../lib/utils";
import type { CalendarSite, CalendarReservation, CalendarSelection, GanttSelection, DayMeta } from "./types";
import { Wrench, Sparkles, AlertTriangle, Calendar, Tent } from "lucide-react";
import { diffInDays } from "./utils";

interface CalendarRowProps {
    site: CalendarSite;
    days: DayMeta[];
    reservations: CalendarReservation[];
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
    };
    today: Date;
}

export const CalendarRow = memo(function CalendarRow({
    site,
    days,
    reservations,
    gridTemplate,
    dayCount,
    zebra,
    selection,
    ganttSelection,
    handlers,
    today
}: CalendarRowProps) {
    const { dragState } = useCalendarContext();
    const { onDragStart, onDragEnter, onDragEnd, onReservationClick, onQuickCheckIn } = handlers;

    const isArrivalToday = (res: CalendarReservation) => {
        const arrivalDate = new Date(res.arrivalDate);
        return (
            arrivalDate.getDate() === today.getDate() &&
            arrivalDate.getMonth() === today.getMonth() &&
            arrivalDate.getFullYear() === today.getFullYear()
        );
    };

    return (
        <div
            className="grid relative group hover:bg-slate-50/50 transition-colors"
            style={{ gridTemplateColumns: gridTemplate }}
            onDragStart={(e) => e.preventDefault()}
            onPointerLeave={() => {
                // If the pointer leaves the row while dragging, we still want to track it
                // but we don't clear the siteId here because it might be a drift.
            }}
        >
            {/* Site Info Column */}
            <div className={cn("px-4 py-3 sticky left-0 z-20 border-r border-slate-200 flex flex-col justify-center", zebra)}>
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate" title={site.name}>{site.name}</div>
                        <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                            <span>{site.siteType}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
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
                            className={cn(
                                "border-r border-slate-100 cursor-crosshair transition-colors h-16 touch-none",
                                zebra,
                                d.isToday && "bg-blue-50/40",
                                d.weekend && "bg-slate-50/50",
                                "hover:bg-blue-50/30"
                            )}
                            onPointerDown={(e) => {
                                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
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
                            const selStartIdx = Math.max(0, diffInDays(new Date(selection.arrival), start));
                            const selEndIdx = Math.min(dayCount, diffInDays(new Date(selection.departure), start));
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
                                    <span className="text-[10px] font-bold text-purple-700 bg-white/90 px-2 py-0.5 rounded shadow-sm">
                                        Selected Stays
                                    </span>
                                </div>
                            );
                        })()}

                    {/* Reservations */}
                    {reservations.map((res) => {
                        const start = days[0].date;
                        const resStart = new Date(res.arrivalDate);
                        const resEnd = new Date(res.departureDate);
                        const startIdx = Math.max(0, diffInDays(resStart, start));
                        const endIdx = Math.min(dayCount, diffInDays(resEnd, start));

                        if (endIdx <= 0 || startIdx >= dayCount) return null;

                        const span = Math.max(1, endIdx - startIdx);

                        return (
                            <div
                                key={res.id}
                                className="relative h-full w-full pointer-events-auto"
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
                                    isDragging={dragState.isDragging}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
