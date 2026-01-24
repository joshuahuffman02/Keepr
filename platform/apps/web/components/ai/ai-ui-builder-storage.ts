import { randomId } from "@/lib/random-id";
import type { AiUiBuilderTree } from "@/lib/api-client";
import type { AiUiBuilderId } from "./ai-ui-builder-config";

export type SavedAiUiLayout = {
  id: string;
  builderId: AiUiBuilderId;
  campgroundId: string | null;
  name: string;
  prompt: string;
  tree: AiUiBuilderTree;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "campreserv:ai-ui-builder-layouts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBuilderId = (value: unknown): value is AiUiBuilderId =>
  value === "dashboard" || value === "report" || value === "workflow";

const isSavedLayout = (value: unknown): value is SavedAiUiLayout => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isBuilderId(value.builderId) &&
    (typeof value.campgroundId === "string" || value.campgroundId === null) &&
    typeof value.name === "string" &&
    typeof value.prompt === "string" &&
    isRecord(value.tree) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

const loadAll = (): SavedAiUiLayout[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedLayout);
  } catch {
    return [];
  }
};

const saveAll = (layouts: SavedAiUiLayout[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
};

export const listAiUiLayouts = (builderId?: AiUiBuilderId, campgroundId?: string | null) => {
  const layouts = loadAll();
  return layouts.filter((layout) => {
    if (builderId && layout.builderId !== builderId) return false;
    if (campgroundId !== undefined && layout.campgroundId !== campgroundId) return false;
    return true;
  });
};

export const saveAiUiLayout = (
  layout: Omit<SavedAiUiLayout, "id" | "createdAt" | "updatedAt"> & { id?: string },
) => {
  const all = loadAll();
  const now = new Date().toISOString();
  const existingIndex = layout.id ? all.findIndex((entry) => entry.id === layout.id) : -1;
  const final: SavedAiUiLayout = {
    id: layout.id ?? randomId("ai-layout"),
    createdAt: existingIndex >= 0 ? all[existingIndex].createdAt : now,
    updatedAt: now,
    ...layout,
    campgroundId: layout.campgroundId ?? null,
  };

  if (existingIndex >= 0) {
    all[existingIndex] = final;
  } else {
    all.unshift(final);
  }

  saveAll(all);
  return final;
};

export const deleteAiUiLayout = (layoutId: string) => {
  const next = loadAll().filter((layout) => layout.id !== layoutId);
  saveAll(next);
};
