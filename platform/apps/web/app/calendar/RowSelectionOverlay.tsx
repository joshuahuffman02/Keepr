import React from "react";
import { useCalendarContext } from "./CalendarContext";
import { cn } from "../../lib/utils";

interface RowSelectionOverlayProps {
    siteId: string;
    dayCount: number;
}

export const RowSelectionOverlay = ({ siteId, dayCount }: RowSelectionOverlayProps) => {
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
            className="absolute inset-y-1 mx-0.5 rounded-lg bg-emerald-500/30 border-2 border-emerald-500 z-30 pointer-events-none flex items-center justify-center overflow-hidden transition-all duration-75 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            style={{
                gridColumn: `${selStart + 1} / span ${span}`,
            }}
        >
            <div className="bg-emerald-600/90 backdrop-blur-sm text-[11px] font-black text-white px-3 py-1 rounded-full shadow-lg animate-in fade-in zoom-in duration-200 border border-emerald-400/50">
                Draft Stay
            </div>
        </div>
    );
};
