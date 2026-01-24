import { format, parseISO } from "date-fns";

export const cellWidth = 110; // px per day for pill positioning fallback

export function diffInDays(a: Date, b: Date) {
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));
}

export function formatLocalDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseLocalDateInput(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toLocalDate(value: string | Date) {
  if (value instanceof Date) return value;
  if (!value) return new Date();
  if (value.includes("T")) {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}
