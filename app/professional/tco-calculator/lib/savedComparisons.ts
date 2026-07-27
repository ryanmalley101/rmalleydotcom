import type { SharedState } from "./shareState";

// Local-only "saved TCOs" list: no login, so this is deliberately just
// localStorage rather than a backend model. Losing it to a cache purge or a
// different browser/device is an accepted tradeoff, not a bug to fix later.
export interface SavedComparison {
  id: string;
  name: string;
  savedAt: string; // ISO timestamp
  state: SharedState;
}

const STORAGE_KEY = "tco-calculator:saved-comparisons";
// Keeps the localStorage payload small and the list itself usable as a
// human-scannable menu, not a database; oldest entries silently drop off
// once a new save goes past this count.
const MAX_SAVED = 20;

function readRaw(): SavedComparison[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// useSyncExternalStore's getSnapshot must return a stable (===) reference
// across calls unless the underlying data actually changed, or it can spin
// into repeated re-renders — a fresh array/JSON.parse on every call wouldn't
// satisfy that, so the last read is cached and only replaced when the raw
// localStorage string itself has moved.
let cachedRaw: string | null = null;
let cachedSnapshot: SavedComparison[] = [];
const serverSnapshot: SavedComparison[] = [];

function getSnapshot(): SavedComparison[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = readRaw();
  }
  return cachedSnapshot;
}

// The server render has no localStorage at all; returning the same empty
// array both there and as this hook's initial client value (before the real
// snapshot is read) is what keeps hydration from ever seeing a mismatch.
export function getSavedComparisonsServerSnapshot(): SavedComparison[] {
  return serverSnapshot;
}

export function getSavedComparisonsSnapshot(): SavedComparison[] {
  if (typeof window === "undefined") return serverSnapshot;
  return getSnapshot();
}

const listeners = new Set<() => void>();

// Same-tab writes (saving/deleting from this app) don't fire the browser's
// native `storage` event — that only fires in OTHER tabs/windows — so this
// app-level pub/sub is what makes useSyncExternalStore actually notice a
// same-tab write instead of only cross-tab ones.
export function subscribeSavedComparisons(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emitChange() {
  listeners.forEach((l) => l());
}

export function saveComparison(name: string, state: SharedState): SavedComparison {
  const entry: SavedComparison = {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled comparison",
    savedAt: new Date().toISOString(),
    state,
  };
  const next = [entry, ...readRaw()].slice(0, MAX_SAVED);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitChange();
  return entry;
}

export function deleteSavedComparison(id: string): void {
  const next = readRaw().filter((c) => c.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitChange();
}
