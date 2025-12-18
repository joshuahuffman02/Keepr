import React, { useMemo, useCallback } from "react";
import { CalendarRow } from "./CalendarRow";
import { useCalendarContext } from "./CalendarContext";
import { useCalendarData } from "./useCalendarData";
import { formatLocalDateInput, toLocalDate } from "./utils";

function Skeleton({ className }: { className?: string }) {
    return <div className={cn("animate-pulse bg-slate-200 rounded", className)} />;
}

import { cn } from "../../lib/utils";

interface CalendarGridProps {
    data: ReturnType<typeof useCalendarData>;
    onSelectionComplete: (siteId: string, arrival: Date, departure: Date) => void;
}

export function CalendarGrid({ data, onSelectionComplete }: CalendarGridProps) {
    const { dragState, setDragVisual, dragRef } = useCalendarContext();
    const { queries, derived, state, actions } = data;
    const { sites, reservations, blackouts } = queries;
    const { days, dayCount, reservationsBySite, ganttSelection } = derived;

    const gridTemplate = `180px repeat(${dayCount}, minmax(94px, 1fr))`;

    const handleDragStart = useCallback((siteId: string, dayIdx: number) => {
        dragRef.current = { siteId, startIdx: dayIdx, endIdx: dayIdx, isDragging: false };
        setDragVisual({ siteId, startIdx: dayIdx, endIdx: dayIdx });
    }, [setDragVisual, dragRef]);

    const handleDragEnter = useCallback((siteId: string, dayIdx: number) => {
        const drag = dragRef.current;
        if (drag.siteId && drag.startIdx !== null) {
            drag.endIdx = dayIdx;
            drag.isDragging = true;
            setDragVisual({ siteId: drag.siteId, startIdx: drag.startIdx, endIdx: dayIdx });
        }
    }, [setDragVisual, dragRef]);

    const handleDragEnd = useCallback(async (siteId: string, dayIdx: number) => {
        const drag = dragRef.current;
        if (drag.siteId === siteId && drag.startIdx !== null && drag.endIdx !== null) {
            const startIdx = Math.min(drag.startIdx, drag.endIdx);
            const endIdx = Math.max(drag.startIdx, drag.endIdx);

            const arrivalDate = new Date(days[startIdx].date);
            const departureDate = new Date(days[endIdx].date);
            departureDate.setDate(departureDate.getDate() + 1); // Exclusive

            if (drag.isDragging) {
                onSelectionComplete(siteId, arrivalDate, departureDate);
            }
        }

        dragRef.current = { siteId: null, startIdx: null, endIdx: null, isDragging: false };
        setDragVisual(null);
    }, [days, onSelectionComplete, setDragVisual, dragRef]);

    if (sites.isLoading || reservations.isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden select-none">
            <div className="overflow-x-auto">
                {/* Header Row */}
                <div
                    className="grid text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50/50"
                    style={{ gridTemplateColumns: gridTemplate }}
                >
                    <div className="px-4 py-3 sticky left-0 z-30 bg-slate-50 border-r border-slate-200">
                        Sites
                    </div>
                    {days.map((d, idx) => (
                        <div
                            key={idx}
                            className={`px-2 py-3 text-center border-r border-slate-100 last:border-r-0 relative ${d.isToday ? "bg-blue-50 text-blue-700" : ""}`}
                        >
                            {d.label}
                            {d.isToday && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full mx-2" />}
                        </div>
                    ))}
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-100">
                    {(sites.data || []).map((site, idx) => (
                        <CalendarRow
                            key={site.id}
                            site={site}
                            days={days}
                            reservations={reservationsBySite[site.id] || []}
                            gridTemplate={gridTemplate}
                            dayCount={dayCount}
                            zebra={idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}
                            selection={null} // TODO: Handle stored selection
                            ganttSelection={{ highlightedId: null, openDetailsId: null }} // TODO
                            handlers={{
                                onDragStart: handleDragStart,
                                onDragEnter: handleDragEnter,
                                onDragEnd: handleDragEnd,
                                onReservationClick: (id) => console.log("Click", id),
                            }}
                            onDragStart={(e: React.DragEvent) => e.preventDefault()}
                            today={new Date()}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
