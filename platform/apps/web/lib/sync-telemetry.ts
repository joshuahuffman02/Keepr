import { randomId } from "./random-id";

type TelemetryEvent = {
  id: string;
  source: string;
  type: "queue" | "cache" | "sync" | "error" | "conflict";
  status: "success" | "pending" | "failed" | "info" | "conflict";
  message: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

const STORAGE_KEY = "campreserv:syncTelemetry";
const MAX_EVENTS = 50;

export function recordTelemetry(event: Omit<TelemetryEvent, "id" | "createdAt">) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: TelemetryEvent[] = raw ? JSON.parse(raw) : [];
    const next: TelemetryEvent[] = [
      {
        ...event,
        id: randomId(),
        createdAt: new Date().toISOString(),
      },
      ...existing,
    ].slice(0, MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function getTelemetry(): TelemetryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
