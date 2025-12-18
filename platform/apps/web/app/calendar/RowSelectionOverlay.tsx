import React from "react";
import { useCalendarContext } from "./CalendarContext";
import { cn } from "../../lib/utils";

interface RowSelectionOverlayProps {
    siteId: string;
    siteName: string;
    dayCount: number;
}

export const RowSelectionOverlay = ({ siteId, siteName, dayCount }: RowSelectionOverlayProps) => {
    const { dragState } = useCalendarContext();
    const { siteId: dragSiteId, startIdx, endIdx, isDragging } = dragState;

    if (!isDragging || dragSiteId !== siteId || startIdx === null || endIdx === null) {
        return null;
    }

    const selStart = Math.min(startIdx, endIdx);
    const selEnd = Math.max(startIdx, endIdx) + 1;
    const span = Math.max(1, selEnd - selStart);

    return (
        <div
            className="absolute inset-y-1 mx-0.5 rounded-lg bg-blue-500/30 border-2 border-blue-500 z-30 pointer-events-none flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            style={{
                gridColumn: isDragging
                    ? "var(--drag-start-col, 1) / span var(--drag-span, 1)"
                    : `${selStart + 1} / span ${span}`,
            }}
        >
            <div className="bg-blue-600/95 backdrop-blur-md text-[10px] sm:text-[11px] font-black text-white px-3 py-1 rounded-full shadow-xl animate-in fade-in zoom-in duration-200 border border-blue-400/50 flex items-center gap-2 whitespace-nowrap">
                <span className="opacity-70">{siteName}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span>Selected Dates</span>
            </div>

            {/* Checkout indicator on the last night */}
            <div className="absolute right-0 inset-y-0 w-8 bg-gradient-to-l from-blue-500/20 to-transparent flex items-center justify-end pr-1">
                <div className="w-1 h-4 bg-blue-400/50 rounded-full" />
            </div>
        </div>
    );
};
