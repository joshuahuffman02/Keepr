import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import type { DragState } from "./types";

interface CalendarContextType {
    dragState: DragState;
    setDragVisual: (state: { siteId: string | null; startIdx: number | null; endIdx: number | null } | null) => void;
    dragRef: React.MutableRefObject<DragState>;
}

const CalendarContext = createContext<CalendarContextType | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
    const [dragState, setDragState] = useState<DragState>({
        siteId: null,
        startIdx: null,
        endIdx: null,
        isDragging: false
    });

    const dragRef = useRef<DragState>({
        siteId: null,
        startIdx: null,
        endIdx: null,
        isDragging: false
    });

    const setDragVisual = useCallback((state: { siteId: string | null; startIdx: number | null; endIdx: number | null } | null) => {
        if (!state) {
            setDragState({ siteId: null, startIdx: null, endIdx: null, isDragging: false });
            return;
        }

        setDragState({
            ...state,
            isDragging: state.startIdx !== state.endIdx
        });
    }, []);

    return (
        <CalendarContext.Provider value={{ dragState, setDragVisual, dragRef }}>
            {children}
        </CalendarContext.Provider>
    );
}

export function useCalendarContext() {
    const context = useContext(CalendarContext);
    if (!context) {
        throw new Error("useCalendarContext must be used within a CalendarProvider");
    }
    return context;
}
