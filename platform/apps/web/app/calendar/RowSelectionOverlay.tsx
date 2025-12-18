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
            className="absolute inset-y-1 mx-1 rounded-lg bg-emerald-500/20 border-2 border-emerald-500 border-dashed z-30 pointer-events-none flex items-center justify-center overflow-hidden transition-all duration-75"
            style={{
                gridColumn: `${selStart + 1} / span ${span}`,
            }}
        >
            <div className="bg-emerald-600 text-[10px] font-bold text-white px-2 py-0.5 rounded shadow-sm animate-in fade-in zoom-in duration-200">
                Draft
            </div>
        </div>
    );
};
