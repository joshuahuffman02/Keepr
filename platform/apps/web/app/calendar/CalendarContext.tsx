import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import type { DragState, ReservationDragState, ReservationDragMode } from "./types";

interface CalendarContextType {
  dragState: DragState;
  setDragVisual: (
    state: { siteId: string | null; startIdx: number | null; endIdx: number | null } | null,
  ) => void;
  dragRef: React.MutableRefObject<DragState>;
  // Reservation drag state
  reservationDrag: ReservationDragState;
  startReservationDrag: (payload: {
    reservationId: string;
    siteId: string;
    arrival: string;
    departure: string;
    mode: ReservationDragMode;
  }) => void;
  updateReservationDrag: (payload: {
    currentSiteId?: string;
    currentStartIdx?: number;
    currentEndIdx?: number;
  }) => void;
  endReservationDrag: () => void;
}

const defaultReservationDrag: ReservationDragState = {
  reservationId: null,
  originalSiteId: null,
  originalArrival: null,
  originalDeparture: null,
  mode: null,
  currentSiteId: null,
  currentStartIdx: null,
  currentEndIdx: null,
  isDragging: false,
};

const CalendarContext = createContext<CalendarContextType | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [dragState, setDragState] = useState<DragState>({
    siteId: null,
    startIdx: null,
    endIdx: null,
    isDragging: false,
  });

  const dragRef = useRef<DragState>({
    siteId: null,
    startIdx: null,
    endIdx: null,
    isDragging: false,
  });

  const [reservationDrag, setReservationDrag] =
    useState<ReservationDragState>(defaultReservationDrag);

  const setDragVisual = useCallback(
    (state: { siteId: string | null; startIdx: number | null; endIdx: number | null } | null) => {
      if (!state) {
        setDragState({ siteId: null, startIdx: null, endIdx: null, isDragging: false });
        return;
      }

      setDragState({
        ...state,
        isDragging: state.siteId !== null,
      });
    },
    [],
  );

  const startReservationDrag = useCallback(
    (payload: {
      reservationId: string;
      siteId: string;
      arrival: string;
      departure: string;
      mode: ReservationDragMode;
    }) => {
      setReservationDrag({
        reservationId: payload.reservationId,
        originalSiteId: payload.siteId,
        originalArrival: payload.arrival,
        originalDeparture: payload.departure,
        mode: payload.mode,
        currentSiteId: payload.siteId,
        currentStartIdx: null,
        currentEndIdx: null,
        isDragging: true,
      });
    },
    [],
  );

  const updateReservationDrag = useCallback(
    (payload: { currentSiteId?: string; currentStartIdx?: number; currentEndIdx?: number }) => {
      setReservationDrag((prev) => ({
        ...prev,
        ...(payload.currentSiteId !== undefined && { currentSiteId: payload.currentSiteId }),
        ...(payload.currentStartIdx !== undefined && { currentStartIdx: payload.currentStartIdx }),
        ...(payload.currentEndIdx !== undefined && { currentEndIdx: payload.currentEndIdx }),
      }));
    },
    [],
  );

  const endReservationDrag = useCallback(() => {
    setReservationDrag(defaultReservationDrag);
  }, []);

  return (
    <CalendarContext.Provider
      value={{
        dragState,
        setDragVisual,
        dragRef,
        reservationDrag,
        startReservationDrag,
        updateReservationDrag,
        endReservationDrag,
      }}
    >
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
