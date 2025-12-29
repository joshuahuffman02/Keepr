import React, { useMemo, useCallback, useEffect } from "react";
import { CalendarRow } from "./CalendarRow";
import { useCalendarContext } from "./CalendarContext";
import { useCalendarData } from "./useCalendarData";
import { formatLocalDateInput, toLocalDate, parseLocalDateInput, diffInDays } from "./utils";
import type { ReservationDragMode, CalendarReservation } from "./types";

function Skeleton({ className }: { className?: string }) {
    return <div className={cn("animate-pulse bg-slate-200 rounded", className)} />;
}

import { cn } from "../../lib/utils";

interface CalendarGridProps {
    data: ReturnType<typeof useCalendarData>;
    onSelectionComplete: (siteId: string, arrival: Date, departure: Date) => void;
    onReservationMove?: (reservationId: string, siteId: string, arrivalDate: string, departureDate: string) => void;
}

export function CalendarGrid({ data, onSelectionComplete, onReservationMove }: CalendarGridProps) {
    const { setDragVisual, dragRef, reservationDrag, startReservationDrag, updateReservationDrag, endReservationDrag } = useCalendarContext();
    const gridRef = React.useRef<HTMLDivElement>(null);
    const { queries, derived, state, actions, mutations } = data;
    const { sites, reservations, blackouts } = queries;
    const { days, dayCount, reservationsBySite, ganttSelection } = derived;

    const gridTemplate = `180px repeat(${dayCount}, minmax(94px, 1fr))`;

    const resolveDragTarget = useCallback((clientX: number, clientY: number) => {
        const grid = gridRef.current;
        if (!grid) return null;

        const elements = typeof document.elementsFromPoint === "function"
            ? document.elementsFromPoint(clientX, clientY)
            : [document.elementFromPoint(clientX, clientY)].filter(Boolean);

        const cell = elements.find((el) =>
            el instanceof HTMLElement && (el as HTMLElement).dataset.dayIdx !== undefined
        ) as HTMLElement | undefined;

        if (!cell) return null;
        const row = cell.closest<HTMLElement>("[data-site-id]");
        const siteId = row?.dataset.siteId;
        if (!siteId || !grid.contains(row)) return null;

        const dayIdx = Number(cell.dataset.dayIdx);
        if (Number.isNaN(dayIdx)) return null;

        return { siteId, dayIdx };
    }, []);

    const handleDragStart = useCallback((siteId: string, dayIdx: number) => {
        dragRef.current = { siteId, startIdx: dayIdx, endIdx: dayIdx, isDragging: true };
        setDragVisual({ siteId, startIdx: dayIdx, endIdx: dayIdx });
        if (gridRef.current) {
            gridRef.current.classList.add("dragging-active");
            gridRef.current.style.setProperty("--drag-start-col", (dayIdx + 1).toString());
            gridRef.current.style.setProperty("--drag-span", "1");
        }
    }, [setDragVisual, dragRef]);

    const handleDragEnter = useCallback((siteId: string, dayIdx: number) => {
        const drag = dragRef.current;
        if (drag.siteId && drag.startIdx !== null && drag.endIdx !== dayIdx) {
            drag.endIdx = dayIdx;
            drag.isDragging = true;

            // Atomic visual update via CSS variables for 60fps
            if (gridRef.current) {
                const minIdx = Math.min(drag.startIdx, dayIdx);
                const maxIdx = Math.max(drag.startIdx, dayIdx);
                const span = maxIdx - minIdx + 1;
                gridRef.current.style.setProperty("--drag-start-col", (minIdx + 1).toString());
                gridRef.current.style.setProperty("--drag-span", span.toString());
            }

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

    const handleGridPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragRef.current.isDragging && !reservationDrag.isDragging) return;
        const target = resolveDragTarget(e.clientX, e.clientY);
        if (!target) return;

        if (dragRef.current.isDragging) {
            handleDragEnter(target.siteId, target.dayIdx);
        }

        if (reservationDrag.isDragging) {
            updateReservationDrag({
                currentSiteId: target.siteId,
                currentEndIdx: target.dayIdx,
            });
        }
    }, [dragRef, resolveDragTarget, handleDragEnter, reservationDrag.isDragging, updateReservationDrag]);

    // Handler for starting a reservation drag (move or extend)
    const handleReservationDragStart = useCallback((reservationId: string, mode: ReservationDragMode) => {
        const reservation = (reservations.data || []).find((r: CalendarReservation) => r.id === reservationId);
        if (!reservation || !reservation.siteId) return;

        startReservationDrag({
            reservationId,
            siteId: reservation.siteId,
            arrival: reservation.arrivalDate,
            departure: reservation.departureDate,
            mode,
        });
    }, [reservations.data, startReservationDrag]);

    // Handler for ending a reservation drag
    const handleReservationDragEnd = useCallback(() => {
        if (!reservationDrag.isDragging || !reservationDrag.reservationId) {
            endReservationDrag();
            return;
        }

        const { reservationId, originalSiteId, originalArrival, originalDeparture, mode, currentSiteId, currentEndIdx } = reservationDrag;

        if (currentEndIdx === null || !originalArrival || !originalDeparture) {
            endReservationDrag();
            return;
        }

        const startDate = days[0].date;
        const originalArrivalDate = parseLocalDateInput(originalArrival);
        const originalDepartureDate = parseLocalDateInput(originalDeparture);
        const originalStartIdx = diffInDays(originalArrivalDate, startDate);
        const originalEndIdx = diffInDays(originalDepartureDate, startDate);

        let newArrivalDate: Date;
        let newDepartureDate: Date;
        let newSiteId = originalSiteId;

        if (mode === "extend-end") {
            // Extend the departure date
            newArrivalDate = originalArrivalDate;
            newDepartureDate = new Date(days[currentEndIdx].date);
            newDepartureDate.setDate(newDepartureDate.getDate() + 1); // Departure is exclusive

            // Don't allow departure before arrival
            if (newDepartureDate <= newArrivalDate) {
                endReservationDrag();
                return;
            }
        } else if (mode === "extend-start") {
            // Extend the arrival date
            newArrivalDate = new Date(days[currentEndIdx].date);
            newDepartureDate = originalDepartureDate;

            // Don't allow arrival after departure
            if (newArrivalDate >= newDepartureDate) {
                endReservationDrag();
                return;
            }
        } else if (mode === "move") {
            // Move the entire reservation
            const nights = diffInDays(originalDepartureDate, originalArrivalDate);
            newArrivalDate = new Date(days[currentEndIdx].date);
            newDepartureDate = new Date(newArrivalDate);
            newDepartureDate.setDate(newDepartureDate.getDate() + nights);
            newSiteId = currentSiteId || originalSiteId;
        } else {
            endReservationDrag();
            return;
        }

        const newArrivalStr = formatLocalDateInput(newArrivalDate);
        const newDepartureStr = formatLocalDateInput(newDepartureDate);

        // Only update if something changed
        if (newArrivalStr !== originalArrival || newDepartureStr !== originalDeparture || newSiteId !== originalSiteId) {
            if (onReservationMove) {
                onReservationMove(reservationId, newSiteId!, newArrivalStr, newDepartureStr);
            } else {
                // Use the built-in mutation
                mutations.move.mutate({
                    id: reservationId,
                    siteId: newSiteId!,
                    arrivalDate: newArrivalStr,
                    departureDate: newDepartureStr,
                });
            }
        }

        endReservationDrag();
    }, [reservationDrag, days, endReservationDrag, onReservationMove, mutations.move]);

    useEffect(() => {
        const handleGlobalPointerUp = () => {
            if (dragRef.current.isDragging) {
                handleDragEnd(null, null);
            }
            if (reservationDrag.isDragging) {
                handleReservationDragEnd();
            }
        };

        const handleGlobalPointerMove = (e: PointerEvent) => {
            if (!dragRef.current.isDragging && !reservationDrag.isDragging) return;
            const target = resolveDragTarget(e.clientX, e.clientY);
            if (!target) return;

            if (dragRef.current.isDragging) {
                handleDragEnter(target.siteId, target.dayIdx);
            }
            if (reservationDrag.isDragging) {
                updateReservationDrag({
                    currentSiteId: target.siteId,
                    currentEndIdx: target.dayIdx,
                });
            }
        };

        window.addEventListener("pointerup", handleGlobalPointerUp);
        window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
        return () => {
            window.removeEventListener("pointerup", handleGlobalPointerUp);
            window.removeEventListener("pointermove", handleGlobalPointerMove);
        };
    }, [handleDragEnd, handleDragEnter, resolveDragTarget, dragRef, reservationDrag.isDragging, handleReservationDragEnd, updateReservationDrag]);

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
                "rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden select-none"
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
                    onPointerMove={handleGridPointerMove}
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
                                onQuickCheckIn: actions.handleQuickCheckIn,
                                onReservationDragStart: handleReservationDragStart,
                            }}
                            today={new Date()}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
