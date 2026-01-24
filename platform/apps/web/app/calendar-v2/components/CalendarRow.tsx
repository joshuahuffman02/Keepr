"use client";

import React, { memo } from "react";
import { Ban } from "lucide-react";
import { cn } from "../../../lib/utils";
import { diffInDays, parseLocalDateInput, toLocalDate } from "../../calendar/utils";
import { ReservationChip } from "./ReservationChip";
import {
  type ActiveSelection,
  type CalendarBlackout,
  type CalendarReservation,
  type CalendarSite,
  type DayMeta,
  type DensityMode,
  type QuotePreview,
  DAY_MIN_WIDTH,
  DENSITY_CONFIG,
  SITE_TYPE_STYLES,
} from "./types";

interface CalendarRowProps {
  site: CalendarSite;
  days: DayMeta[];
  dayCount: number;
  reservations: CalendarReservation[];
  blackouts: CalendarBlackout[];
  gridTemplate: string;
  zebra: string;
  activeSelection: ActiveSelection | null;
  draftSelection: QuotePreview | null;
  onCellPointerDown: (siteId: string, dayIdx: number, e: React.PointerEvent) => void;
  onReservationClick: (id: string) => void;
  densityConfig: (typeof DENSITY_CONFIG)[DensityMode];
}

export const CalendarRow = memo(function CalendarRow({
  site,
  days,
  dayCount,
  reservations,
  blackouts,
  gridTemplate,
  zebra,
  activeSelection,
  draftSelection,
  onCellPointerDown,
  onReservationClick,
  densityConfig,
}: CalendarRowProps) {
  const active = activeSelection?.siteId === site.id ? activeSelection : null;
  const typeKey = (site.siteType ?? "").toLowerCase();
  const typeMeta = SITE_TYPE_STYLES[typeKey] ?? SITE_TYPE_STYLES.default;

  const activeStart = active ? Math.min(active.startIdx, active.endIdx) : null;
  const activeEnd = active ? Math.max(active.startIdx, active.endIdx) : null;
  const activeSpan = activeStart !== null && activeEnd !== null ? activeEnd - activeStart + 1 : 0;
  const activeLabel = activeSpan === 1 ? "night" : "nights";

  const selectionHeightClass =
    densityConfig.rowHeight === 40 ? "h-6" : densityConfig.rowHeight === 88 ? "h-16" : "h-12";

  return (
    <div
      className="grid relative group"
      style={{ gridTemplateColumns: gridTemplate }}
      data-site-id={site.id}
    >
      <div
        className={cn(
          "px-4 sticky left-0 z-10 border-r border-l-4 border-border",
          zebra,
          typeMeta.border,
          densityConfig.padding,
        )}
      >
        <div
          className={cn(
            "font-bold text-foreground truncate",
            densityConfig.rowHeight === 40 ? "text-xs" : "text-sm",
          )}
          title={site.name}
        >
          {site.name}
        </div>
        {densityConfig.showDetails && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
            <span className={cn("px-2 py-0.5 rounded-full font-bold", typeMeta.badge)}>
              {typeMeta.label}
            </span>
            {site.siteNumber ? (
              <span className="text-muted-foreground/70">#{site.siteNumber}</span>
            ) : null}
          </div>
        )}
      </div>

      <div className="relative" style={{ gridColumn: "2 / -1" }}>
        <div
          className="grid h-full"
          style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(${DAY_MIN_WIDTH}px, 1fr))` }}
        >
          {days.map((d, i) => (
            <div
              key={i}
              data-day-idx={i}
              className={cn(
                "border-r border-border/60 cursor-crosshair transition-colors select-none touch-none",
                zebra,
                d.weekend && "bg-muted/50",
                d.isToday && "bg-primary/10",
                "hover:bg-primary/10",
              )}
              style={{ height: `${densityConfig.rowHeight}px` }}
              onPointerDown={(e) => onCellPointerDown(site.id, i, e)}
            />
          ))}
        </div>

        <div
          className="grid absolute inset-0 items-center pointer-events-none"
          style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(${DAY_MIN_WIDTH}px, 1fr))` }}
        >
          {active && activeStart !== null && activeEnd !== null && (
            <div
              className={cn(
                "my-1 mx-1 rounded-xl bg-primary/20 border border-primary/60 shadow-lg flex items-center justify-center z-20",
                selectionHeightClass,
              )}
              style={{ gridColumn: `${activeStart + 1} / span ${activeSpan}` }}
            >
              <div
                className={cn(
                  "px-3 py-1 rounded-full bg-action-primary text-action-primary-foreground font-black uppercase tracking-widest flex items-center gap-2",
                  densityConfig.fontSize,
                )}
              >
                {densityConfig.showDetails && <span className="opacity-80">{site.name}</span>}
                <span>
                  {activeSpan} {activeLabel}
                </span>
              </div>
            </div>
          )}

          {draftSelection?.siteId === site.id ? (
            <DraftSelectionOverlay
              draftSelection={draftSelection}
              days={days}
              dayCount={dayCount}
              selectionHeightClass={selectionHeightClass}
              densityConfig={densityConfig}
            />
          ) : null}

          {blackouts.map((blackout) => (
            <BlackoutOverlay
              key={blackout.id}
              blackout={blackout}
              days={days}
              dayCount={dayCount}
            />
          ))}

          {reservations.map((res) => {
            const start = days[0].date;
            const resStart = toLocalDate(res.arrivalDate);
            const resEnd = toLocalDate(res.departureDate);
            const startIdx = Math.max(0, diffInDays(resStart, start));
            const endIdx = Math.min(dayCount, diffInDays(resEnd, start));
            if (endIdx <= 0 || startIdx >= dayCount) return null;
            const span = Math.max(1, endIdx - startIdx);

            return (
              <div
                key={res.id}
                className="relative h-full w-full pointer-events-auto z-10"
                style={{ gridColumn: `${startIdx + 1} / span ${span}` }}
              >
                <ReservationChip
                  reservation={res}
                  onClick={() => onReservationClick(res.id)}
                  densityConfig={densityConfig}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

const DraftSelectionOverlay = memo(function DraftSelectionOverlay({
  draftSelection,
  days,
  dayCount,
  selectionHeightClass,
  densityConfig,
}: {
  draftSelection: QuotePreview;
  days: DayMeta[];
  dayCount: number;
  selectionHeightClass: string;
  densityConfig: (typeof DENSITY_CONFIG)[DensityMode];
}) {
  const start = days[0].date;
  const resStart = parseLocalDateInput(draftSelection.arrival);
  const resEnd = parseLocalDateInput(draftSelection.departure);
  const startIdx = Math.max(0, diffInDays(resStart, start));
  const endIdx = Math.min(dayCount, diffInDays(resEnd, start));
  if (endIdx <= 0 || startIdx >= dayCount) return null;
  const span = Math.max(1, endIdx - startIdx);

  return (
    <div
      className={cn(
        "mx-1 rounded-lg bg-status-info/10 border-2 border-status-info/40 border-dashed flex items-center justify-center z-10",
        selectionHeightClass,
      )}
      style={{ gridColumn: `${startIdx + 1} / span ${span}` }}
    >
      <span
        className={cn(
          "font-bold text-status-info bg-card/90 px-2 py-0.5 rounded",
          densityConfig.fontSize,
        )}
      >
        Draft
      </span>
    </div>
  );
});

const BlackoutOverlay = memo(function BlackoutOverlay({
  blackout,
  days,
  dayCount,
}: {
  blackout: CalendarBlackout;
  days: DayMeta[];
  dayCount: number;
}) {
  const start = days[0].date;
  const blackoutStart = toLocalDate(blackout.startDate);
  const blackoutEnd = toLocalDate(blackout.endDate);
  const startIdx = Math.max(0, diffInDays(blackoutStart, start));
  const endIdx = Math.min(dayCount, diffInDays(blackoutEnd, start) + 1);

  if (endIdx <= 0 || startIdx >= dayCount) return null;

  const span = Math.max(1, endIdx - startIdx);

  return (
    <div
      className="relative h-full w-full pointer-events-none"
      style={{
        gridColumn: `${startIdx + 1} / span ${span}`,
        zIndex: 15,
      }}
      title={blackout.reason ?? "Blocked"}
    >
      <div className="absolute inset-0 mx-0.5 my-1 rounded-md bg-destructive/10 border border-destructive/30 flex items-center justify-center overflow-hidden">
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
            color: "hsl(var(--destructive))",
          }}
        />
        <div className="relative z-10 flex items-center gap-1 bg-card/90 px-2 py-0.5 rounded text-[10px] font-medium text-destructive">
          <Ban className="h-3 w-3" />
          <span className="truncate max-w-[80px]">{blackout.reason ?? "Blocked"}</span>
        </div>
      </div>
    </div>
  );
});
