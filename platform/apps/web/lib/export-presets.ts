/**
 * Utilities for managing saved export presets in localStorage
 */

export interface ExportColumn {
  key: string;
  label: string;
  enabled: boolean;
}

export interface DateRangePreset {
  label: string;
  getValue: () => { start: Date; end: Date };
}

export interface ExportPreset {
  id: string;
  name: string;
  columns: string[];
  dateRangeType: 'today' | 'week' | 'month' | 'year' | 'custom';
  customDateStart?: string;
  customDateEnd?: string;
  format: 'csv' | 'xlsx';
  createdAt: string;
}

const STORAGE_KEY = 'campreserv:exportPresets';

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    label: 'Today',
    getValue: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      return { start: today, end: endOfDay };
    },
  },
  {
    label: 'This Week',
    getValue: () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const start = new Date(today);
      start.setDate(today.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    },
  },
  {
    label: 'This Month',
    getValue: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    },
  },
  {
    label: 'Last Month',
    getValue: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    },
  },
  {
    label: 'This Year',
    getValue: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end };
    },
  },
  {
    label: 'Last Year',
    getValue: () => {
      const today = new Date();
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return { start, end };
    },
  },
];

export function loadExportPresets(): ExportPreset[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load export presets:', error);
    return [];
  }
}

export function saveExportPreset(preset: Omit<ExportPreset, 'id' | 'createdAt'>): ExportPreset {
  if (typeof window === 'undefined') {
    throw new Error('Cannot save presets on server side');
  }

  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).slice(2, 9);
  const newPreset: ExportPreset = {
    ...preset,
    id: 'preset_' + timestamp + '_' + random,
    createdAt: new Date().toISOString(),
  };

  const presets = loadExportPresets();
  presets.push(newPreset);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return newPreset;
  } catch (error) {
    console.error('Failed to save export preset:', error);
    throw error;
  }
}

export function deleteExportPreset(id: string): void {
  if (typeof window === 'undefined') return;

  const presets = loadExportPresets();
  const filtered = presets.filter((p) => p.id !== id);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete export preset:', error);
    throw error;
  }
}

export function loadPresetById(id: string): ExportPreset | null {
  const presets = loadExportPresets();
  return presets.find((p) => p.id === id) || null;
}

export function updateExportPreset(id: string, updates: Partial<Omit<ExportPreset, 'id' | 'createdAt'>>): ExportPreset | null {
  if (typeof window === 'undefined') return null;

  const presets = loadExportPresets();
  const index = presets.findIndex((p) => p.id === id);
  
  if (index === -1) return null;

  const updated = { ...presets[index], ...updates };
  presets[index] = updated;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return updated;
  } catch (error) {
    console.error('Failed to update export preset:', error);
    throw error;
  }
}

export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function parseDateFromInput(dateString: string): Date {
  const parts = dateString.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
