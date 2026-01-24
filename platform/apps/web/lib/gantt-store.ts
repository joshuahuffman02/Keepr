import { useSyncExternalStore } from "react";

type DragState = {
  isDragging: boolean;
  reservationId: string | null;
  siteId: string | null;
  startDate: string | null;
  endDate: string | null;
};

type SelectionState = {
  highlightedId: string | null;
  openDetailsId: string | null;
};

type StoreState = {
  drag: DragState;
  selection: SelectionState;
};

type Store = {
  getState: () => StoreState;
  setState: (updater: (prev: StoreState) => StoreState) => void;
  subscribe: (listener: () => void) => () => void;
  setDrag: (partial: Partial<DragState>) => void;
  startDrag: (payload: {
    reservationId: string;
    siteId: string;
    startDate: string;
    endDate: string;
  }) => void;
  resetDrag: () => void;
  setSelection: (partial: Partial<SelectionState>) => void;
};

const defaultDrag: DragState = {
  isDragging: false,
  reservationId: null,
  siteId: null,
  startDate: null,
  endDate: null,
};

const defaultSelection: SelectionState = {
  highlightedId: null,
  openDetailsId: null,
};

// Cached server snapshot to avoid infinite loop
const serverSnapshot: StoreState = { drag: defaultDrag, selection: defaultSelection };

function createStore(): Store {
  let state: StoreState = { drag: defaultDrag, selection: defaultSelection };
  const listeners = new Set<() => void>();

  const getState = () => state;
  const setState = (updater: (prev: StoreState) => StoreState) => {
    state = updater(state);
    listeners.forEach((l) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const setDrag = (partial: Partial<DragState>) =>
    setState((prev) => ({
      ...prev,
      drag: { ...prev.drag, ...partial },
    }));

  const startDrag = (payload: {
    reservationId: string;
    siteId: string;
    startDate: string;
    endDate: string;
  }) =>
    setState((prev) => ({
      ...prev,
      drag: {
        isDragging: true,
        reservationId: payload.reservationId,
        siteId: payload.siteId,
        startDate: payload.startDate,
        endDate: payload.endDate,
      },
    }));

  const resetDrag = () =>
    setState((prev) => ({
      ...prev,
      drag: defaultDrag,
    }));

  const setSelection = (partial: Partial<SelectionState>) =>
    setState((prev) => ({
      ...prev,
      selection: { ...prev.selection, ...partial },
    }));

  return { getState, setState, subscribe, setDrag, startDrag, resetDrag, setSelection };
}

const store = createStore();

// Cached getServerSnapshot function to avoid infinite loop
const getServerSnapshot = () => serverSnapshot;

export function useGanttStore() {
  const state = useSyncExternalStore(store.subscribe, store.getState, getServerSnapshot);
  return {
    ...state,
    setDrag: store.setDrag,
    startDrag: store.startDrag,
    resetDrag: store.resetDrag,
    setSelection: store.setSelection,
  };
}
