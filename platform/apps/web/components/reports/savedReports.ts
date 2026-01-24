import { randomId } from "@/lib/random-id";

export type SavedReport = {
  id: string;
  name: string;
  description?: string;
  tab: string;
  subTab?: string | null;
  dateRange?: { start: string; end: string };
  filters?: {
    status: string;
    siteType: string;
    groupBy: string;
  };
  campgroundId?: string | null;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "campreserv:savedReports";

function loadAll(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveAll(reports: SavedReport[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function listSavedReports(campgroundId?: string | null) {
  const all = loadAll();
  return campgroundId ? all.filter((r) => r.campgroundId === campgroundId) : all;
}

export function saveReport(
  report: Omit<SavedReport, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  const all = loadAll();
  const now = new Date().toISOString();
  const existingIdx = report.id ? all.findIndex((r) => r.id === report.id) : -1;
  const existingPinned = existingIdx >= 0 ? all[existingIdx].pinned : undefined;
  const final: SavedReport = {
    id: report.id || randomId(),
    createdAt: existingIdx >= 0 ? all[existingIdx].createdAt : now,
    updatedAt: now,
    ...report,
    pinned: report.pinned ?? existingPinned ?? false,
  };
  if (existingIdx >= 0) {
    all[existingIdx] = final;
  } else {
    all.unshift(final);
  }
  saveAll(all);
  return final;
}

export function deleteReport(id: string) {
  const all = loadAll().filter((r) => r.id !== id);
  saveAll(all);
}

export function findReport(id: string) {
  return loadAll().find((r) => r.id === id);
}

export function togglePinnedReport(id: string, pinned?: boolean) {
  const all = loadAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const nextPinned = pinned ?? !all[idx].pinned;
  all[idx] = {
    ...all[idx],
    pinned: nextPinned,
    updatedAt: new Date().toISOString(),
  };
  saveAll(all);
  return all[idx];
}
