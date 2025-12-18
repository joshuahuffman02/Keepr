import React, { useMemo, useCallback, useEffect } from "react";
import { CalendarRow } from "./CalendarRow";
import { useCalendarContext } from "./CalendarContext";
import { useCalendarData } from "./useCalendarData";
import { formatLocalDateInput, toLocalDate, parseLocalDateInput } from "./utils";

function Skeleton({ className }: { className?: string }) {
    return <div className={cn("animate-pulse bg-slate-200 rounded", className)} />;
}

import { cn } from "../../lib/utils";

interface CalendarGridProps {
    data: ReturnType<typeof useCalendarData>;
    onSelectionComplete: (siteId: string, arrival: Date, departure: Date) => void;
}

export function CalendarGrid({ data, onSelectionComplete }: CalendarGridProps) {
    const { setDragVisual, dragRef } = useCalendarContext();
    const gridRef = React.useRef<HTMLDivElement>(null);
    const { queries, derived, state, actions } = data;
    const { sites, reservations, blackouts } = queries;
    const { days, dayCount, reservationsBySite, ganttSelection } = derived;

    const gridTemplate = `180px repeat(${dayCount}, minmax(94px, 1fr))`;

    const handleDragStart = useCallback((siteId: string, dayIdx: number) => {
        dragRef.current = { siteId, startIdx: dayIdx, endIdx: dayIdx, isDragging: true };
        setDragVisual({ siteId, startIdx: dayIdx, endIdx: dayIdx });
        if (gridRef.current) gridRef.current.classList.add("dragging-active");
    }, [setDragVisual, dragRef]);

    const handleDragEnter = useCallback((siteId: string, dayIdx: number) => {
        const drag = dragRef.current;
        if (drag.siteId && drag.startIdx !== null && drag.endIdx !== dayIdx) {
            drag.endIdx = dayIdx;
            drag.isDragging = true;
            setDragVisual({ siteId: drag.siteId, startIdx: drag.startIdx, endIdx: dayIdx });
        }
    }, [setDragVisual, dragRef]);

    const handleDragEnd = useCallback(async (siteId: string | null, dayIdx: number | null) => {
        const drag = dragRef.current;
        if (drag.siteId && drag.startIdx !== null && drag.endIdx !== null) {
            const finalSiteId = drag.siteId; // ALWAYS use the starting site
            const startIdx = Math.min(drag.startIdx, drag.endIdx);
            const endIdx = Math.max(drag.startIdx, drag.endIdx);

            const arrivalDate = new Date(days[startIdx].date);
            const departureDate = new Date(days[endIdx].date);
            departureDate.setDate(departureDate.getDate() + 1); // Exclusive

            if (drag.isDragging) {
                onSelectionComplete(finalSiteId, arrivalDate, departureDate);
            }
        }

        dragRef.current = { siteId: null, startIdx: null, endIdx: null, isDragging: false };
        setDragVisual(null);
        if (gridRef.current) gridRef.current.classList.remove("dragging-active");
    }, [days, onSelectionComplete, setDragVisual, dragRef]);

    useEffect(() => {
        const handleGlobalPointerUp = () => {
            if (dragRef.current.isDragging) {
                handleDragEnd(null, null);
            }
        };

        const handleGlobalPointerMove = (e: PointerEvent) => {
            const drag = dragRef.current;
            if (drag.isDragging && gridRef.current) {
                const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
                const cell = target?.closest("[data-day-idx]") as HTMLElement | null;
                const dayIdxAttr = cell?.getAttribute("data-day-idx");

                if (dayIdxAttr !== null && dayIdxAttr !== undefined) {
                    const idx = parseInt(dayIdxAttr, 10);
                    // Update visual state WITHOUT React re-render for 60fps
                    const startIdx = drag.startIdx ?? idx;
                    const minIdx = Math.min(startIdx, idx);
                    const maxIdx = Math.max(startIdx, idx);
                    const span = maxIdx - minIdx + 1;

                    gridRef.current.style.setProperty("--drag-start-col", (minIdx + 1).toString());
                    gridRef.current.style.setProperty("--drag-span", span.toString());

                    // Still call the handler for the final state, but throttle or just let it update ref
                    drag.endIdx = idx;
                }
            }
        };

        window.addEventListener("pointerup", handleGlobalPointerUp);
        window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
        return () => {
            window.removeEventListener("pointerup", handleGlobalPointerUp);
            window.removeEventListener("pointermove", handleGlobalPointerMove);
        };
    }, [handleDragEnd, dragRef]);

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
        <div
            id="calendar-grid-root"
            className={cn(
                "rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden select-none",
                state.viewMode === ("timeline" as any) ? "cursor-crosshair" : ""
            )}
        >
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

                <div
                    ref={gridRef}
                    className="divide-y divide-slate-100"
                    onPointerUp={() => handleDragEnd(null, null)}
                >
                    <style>{`
                        .dragging-active .reservation-wrapper {
                            pointer-events: none !important;
                            opacity: 0.6;
                        }
                    `}</style>
                    {(sites.data || []).map((site, idx) => (
                        <CalendarRow
                            key={site.id}
                            site={site}
                            days={days}
                            reservations={reservationsBySite[site.id] || []}
                            gridTemplate={gridTemplate}
                            dayCount={dayCount}
                            zebra={idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}
                            selection={state.reservationDraft ? {
                                siteId: state.reservationDraft.siteId,
                                arrival: state.reservationDraft.arrival,
                                departure: state.reservationDraft.departure
                            } : null}
                            ganttSelection={ganttSelection}
                            handlers={{
                                onDragStart: handleDragStart,
                                onDragEnter: handleDragEnter,
                                onDragEnd: handleDragEnd,
                                onReservationClick: actions.setSelectedReservationId,
                                onQuickCheckIn: actions.handleQuickCheckIn
                            }}
                            today={new Date()}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
