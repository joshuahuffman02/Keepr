import { memo } from "react";
import { ReservationPill } from "./ReservationPill";
import { cn } from "../../lib/utils";
import type { CalendarSite, CalendarReservation, CalendarSelection, DragState, GanttSelection, DayMeta } from "./types";

interface CalendarRowProps {
    site: CalendarSite;
    days: DayMeta[];
    reservations: CalendarReservation[];
    gridTemplate: string;
    dayCount: number;
    zebra: string;
    dragState: DragState;
    selection: CalendarSelection | null;
    ganttSelection: GanttSelection;
    handlers: {
        onMouseDown: (siteId: string, dayIdx: number) => void;
        onMouseEnter: (dayIdx: number) => void;
        onMouseUp: (siteId: string, dayIdx: number) => void;
        onReservationClick: (resId: string) => void;
        onQuickCheckIn?: (reservationId: string) => void;
    };
    today: Date;
}

function diffInDays(a: Date, b: Date) {
    return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export const CalendarRow = memo(function CalendarRow({
    site,
    days,
    reservations,
    gridTemplate,
    dayCount,
    zebra,
    dragState,
    selection,
    ganttSelection,
    handlers,
    today
}: CalendarRowProps) {
    const { siteId: dragSiteId, startIdx: dragStartIdx, endIdx: dragEndIdx, isDragging } = dragState;
    const { onMouseDown, onMouseEnter, onMouseUp, onReservationClick, onQuickCheckIn } = handlers;

    // Helper to check if a reservation arrives today
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
            className="grid relative"
            style={{ gridTemplateColumns: gridTemplate, minWidth: "900px" }}
        >
            {/* Site Info Column */}
            <div className={cn("px-3 py-3 sticky left-0 z-20 border-r border-slate-200 flex flex-col justify-center", zebra)}>
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{site.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {site.siteNumber}
                    </div>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>{site.siteType}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>Max {site.maxOccupancy}</span>
                </div>
            </div>

            {/* Grid Cells Container */}
            <div className="relative" style={{ gridColumn: "2 / -1" }}>
                {/* Background Grid */}
                <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(90px, 1fr))` }}>
                    {days.map((d, i) => {
                        const inSelection =
                            dragSiteId === site.id &&
                            dragStartIdx !== null &&
                            dragEndIdx !== null &&
                            i >= Math.min(dragStartIdx, dragEndIdx) &&
                            i <= Math.max(dragStartIdx, dragEndIdx);

                        return (
                            <div
                                key={i}
                                className={cn(
                                    "border-r border-slate-100 cursor-pointer transition-colors h-16", // Increased height
                                    zebra,
                                    d.isToday && "bg-blue-50/30",
                                    d.weekend && "bg-slate-50/80", // Subtle weekend shading
                                    inSelection && "bg-emerald-100/60 border-emerald-300",
                                    "hover:bg-slate-100"
                                )}
                                onMouseDown={() => onMouseDown(site.id, i)}
                                onMouseEnter={() => onMouseEnter(i)}
                                onMouseUp={() => onMouseUp(site.id, i)}
                            />
                        );
                    })}
                </div>

                {/* Overlay Layer (Selection & Reservations) */}
                <div
                    className="grid absolute inset-0 items-center pointer-events-none"
                    style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(90px, 1fr))` }}
                >
                    {/* Active Drag Selection Pill */}
                    {isDragging &&
                        dragSiteId === site.id &&
                        dragStartIdx !== null &&
                        dragEndIdx !== null &&
                        (() => {
                            const selStart = Math.min(dragStartIdx, dragEndIdx);
                            const selEnd = Math.max(dragStartIdx, dragEndIdx) + 1;
                            const span = Math.max(1, selEnd - selStart);
                            return (
                                <div
                                    key="selection-pill-active"
                                    className="mx-1 rounded-md bg-emerald-500/20 border-2 border-emerald-500 border-dashed h-12 z-10"
                                    style={{
                                        gridColumn: `${selStart + 1} / span ${span}`,
                                    }}
                                />
                            );
                        })()}

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
                                    className="mx-1 rounded-md bg-purple-500/20 border-2 border-purple-500 h-12 z-10 flex items-center justify-center"
                                    style={{
                                        gridColumn: `${selStartIdx + 1} / span ${span}`,
                                    }}
                                >
                                    <span className="text-xs font-bold text-purple-700 bg-white/80 px-2 py-0.5 rounded-full shadow-sm">
                                        Selected
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
                                className={cn(
                                    "relative h-full w-full",
                                    isDragging ? "pointer-events-none" : "pointer-events-auto"
                                )}
                                style={{
                                    gridColumn: `${startIdx + 1} / span ${span}`,
                                    zIndex: 20
                                }}
                            >
                                <ReservationPill
                                    reservation={res}
                                    isHighlighted={ganttSelection.highlightedId === res.id}
                                    style={{ width: "calc(100% - 4px)", left: "2px", right: "2px" }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onReservationClick(res.id);
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        // Implement drag move start here if needed
                                    }}
                                    onMouseUp={(e) => e.stopPropagation()}
                                    onQuickCheckIn={onQuickCheckIn}
                                    isArrivalToday={isArrivalToday(res)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
