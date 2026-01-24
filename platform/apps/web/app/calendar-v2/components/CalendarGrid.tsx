"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtualizer, useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../../../lib/utils";
import { Card } from "../../../components/ui/card";
import { CalendarRow } from "./CalendarRow";
import {
  type ActiveSelection,
  type CalendarBlackout,
  type CalendarReservation,
  type CalendarSite,
  type DayMeta,
  type DensityMode,
  type DragState,
  type QuotePreview,
  DAY_MIN_WIDTH,
  DENSITY_CONFIG,
  SITE_COL_WIDTH,
} from "./types";

interface CalendarGridProps {
  days: DayMeta[];
  dayCount: number;
  isLoading: boolean;
  sites: CalendarSite[];
  reservationsBySite: Record<string, CalendarReservation[]>;
  blackoutsBySite: Record<string, CalendarBlackout[]>;
  selectionDraft: QuotePreview | null;
  onSelectionComplete: (siteId: string, arrival: Date, departure: Date) => void;
  onReservationClick: (id: string) => void;
  density: DensityMode;
}

export const CalendarGrid = memo(function CalendarGrid({
  days,
  dayCount,
  isLoading,
  sites,
  reservationsBySite,
  blackoutsBySite,
  selectionDraft,
  onSelectionComplete,
  onReservationClick,
  density,
}: CalendarGridProps) {
  const densityConfig = DENSITY_CONFIG[density];
  const gridRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<DragState>({
    siteId: null,
    startIdx: null,
    endIdx: null,
    isDragging: false,
    pointerId: null,
  });
  const dragRef = useRef<DragState>(dragState);

  const setDrag = useCallback((next: DragState) => {
    dragRef.current = next;
    setDragState(next);
  }, []);

  const clearDrag = useCallback(() => {
    setDrag({ siteId: null, startIdx: null, endIdx: null, isDragging: false, pointerId: null });
  }, [setDrag]);

  const resolveDragTarget = useCallback(
    (clientX: number, clientY: number) => {
      const grid = gridRef.current;
      if (!grid) return null;

      const elements =
        typeof document.elementsFromPoint === "function"
          ? document.elementsFromPoint(clientX, clientY)
          : [document.elementFromPoint(clientX, clientY)].filter(
              (el): el is Element => el !== null,
            );

      const cell = elements.find(
        (el): el is HTMLElement => el instanceof HTMLElement && el.dataset.dayIdx !== undefined,
      );

      if (cell) {
        const dayIdx = Number(cell.dataset.dayIdx);
        if (!Number.isNaN(dayIdx)) {
          return { dayIdx };
        }
      }

      const bounds = grid.getBoundingClientRect();
      if (clientX < bounds.left + SITE_COL_WIDTH || clientX > bounds.right) return null;
      const dayWidth = (bounds.width - SITE_COL_WIDTH) / dayCount;
      const offset = Math.max(0, clientX - bounds.left - SITE_COL_WIDTH);
      const idx = Math.floor(offset / Math.max(dayWidth, 1));
      const dayIdx = Math.min(dayCount - 1, Math.max(0, idx));
      return { dayIdx };
    },
    [dayCount],
  );

  const updateDragEnd = useCallback(
    (dayIdx: number) => {
      const current = dragRef.current;
      if (!current.isDragging || current.endIdx === dayIdx) return;
      setDrag({ ...current, endIdx: dayIdx });
    },
    [setDrag],
  );

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag.isDragging && drag.siteId && drag.startIdx !== null && drag.endIdx !== null) {
      const startIdx = Math.min(drag.startIdx, drag.endIdx);
      const endIdx = Math.max(drag.startIdx, drag.endIdx);

      const arrivalDate = new Date(days[startIdx].date);
      const departureDate = new Date(days[endIdx].date);
      departureDate.setDate(departureDate.getDate() + 1);

      onSelectionComplete(drag.siteId, arrivalDate, departureDate);
    }
    clearDrag();
  }, [days, onSelectionComplete, clearDrag]);

  useEffect(() => {
    const handlePointerUp = () => {
      if (dragRef.current.isDragging) {
        finishDrag();
      }
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [finishDrag]);

  const handleCellPointerDown = useCallback(
    (siteId: string, dayIdx: number, e: React.PointerEvent) => {
      e.preventDefault();
      const target = e.currentTarget;
      if (target instanceof HTMLElement && target.setPointerCapture) {
        try {
          target.setPointerCapture(e.pointerId);
        } catch {
          // ignore capture errors
        }
      }
      setDrag({
        siteId,
        startIdx: dayIdx,
        endIdx: dayIdx,
        isDragging: true,
        pointerId: e.pointerId,
      });
    },
    [setDrag],
  );

  const handleGridPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.isDragging) return;
      const target = resolveDragTarget(e.clientX, e.clientY);
      if (!target) return;
      updateDragEnd(target.dayIdx);
    },
    [resolveDragTarget, updateDragEnd],
  );

  const activeSelection = useMemo<ActiveSelection | null>(() => {
    if (
      !dragState.isDragging ||
      !dragState.siteId ||
      dragState.startIdx === null ||
      dragState.endIdx === null
    )
      return null;
    return { siteId: dragState.siteId, startIdx: dragState.startIdx, endIdx: dragState.endIdx };
  }, [dragState]);

  // Virtualization for large site lists (>30 sites)
  const useVirtual = sites.length > 30;
  const rowVirtualizer = useVirtualizer({
    count: sites.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => densityConfig.rowHeight + 1, // +1 for border
    overscan: 5,
    enabled: useVirtual,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!sites.length) {
    return (
      <Card className="p-6 border-dashed border-border text-center text-muted-foreground">
        No sites match the current filters.
      </Card>
    );
  }

  const gridTemplate = `${SITE_COL_WIDTH}px repeat(${dayCount}, minmax(${DAY_MIN_WIDTH}px, 1fr))`;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden min-w-0 w-full">
      <div className="overflow-x-auto">
        <div
          className="grid text-xs font-medium text-muted-foreground border-b border-border bg-muted/50"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="px-4 py-3 sticky left-0 z-20 bg-muted/40 border-r border-border">
            Sites
          </div>
          {days.map((d, idx) => (
            <div
              key={idx}
              className={cn(
                "px-2 py-3 text-center border-r border-border/60 last:border-r-0",
                d.isToday && "bg-primary/10 text-primary",
              )}
            >
              <div>{d.label}</div>
            </div>
          ))}
        </div>

        {useVirtual ? (
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ maxHeight: "calc(100vh - 400px)", minHeight: "400px" }}
          >
            <div
              ref={gridRef}
              style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
              onPointerMove={handleGridPointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const site = sites[virtualRow.index];
                return (
                  <div
                    key={site.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="border-b border-border/60"
                  >
                    <CalendarRow
                      site={site}
                      days={days}
                      dayCount={dayCount}
                      reservations={reservationsBySite[site.id] ?? []}
                      blackouts={blackoutsBySite[site.id] ?? []}
                      gridTemplate={gridTemplate}
                      zebra={virtualRow.index % 2 === 0 ? "bg-card" : "bg-muted/30"}
                      activeSelection={activeSelection}
                      draftSelection={selectionDraft}
                      onCellPointerDown={handleCellPointerDown}
                      onReservationClick={onReservationClick}
                      densityConfig={densityConfig}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="divide-y divide-border/60"
            onPointerMove={handleGridPointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            {sites.map((site, idx) => (
              <CalendarRow
                key={site.id}
                site={site}
                days={days}
                dayCount={dayCount}
                reservations={reservationsBySite[site.id] ?? []}
                blackouts={blackoutsBySite[site.id] ?? []}
                gridTemplate={gridTemplate}
                zebra={idx % 2 === 0 ? "bg-card" : "bg-muted/30"}
                activeSelection={activeSelection}
                draftSelection={selectionDraft}
                onCellPointerDown={handleCellPointerDown}
                onReservationClick={onReservationClick}
                densityConfig={densityConfig}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
