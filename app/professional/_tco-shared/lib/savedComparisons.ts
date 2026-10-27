// Local-only "saved TCOs" list: no login, so this is deliberately just
// localStorage rather than a backend model. Losing it to a cache purge or a
// different browser/device is an accepted tradeoff, not a bug to fix later.
// Each calculator creates its own store under its own key.

export interface SavedComparison<State> {
  id: string;
  name: string;
  savedAt: string; // ISO timestamp
  state: State;
}

export interface SavedComparisonsStore<State> {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => SavedComparison<State>[];
  getServerSnapshot: () => SavedComparison<State>[];
  save: (name: string, state: State) => SavedComparison<State>;
  remove: (id: string) => void;
}

// Keeps the localStorage payload small and the list itself usable as a
// human-scannable menu, not a database; oldest entries silently drop off
// once a new save goes past this count.
const MAX_SAVED = 20;

export function createSavedComparisonsStore<State extends object>(storageKey: string, modelVersion: number): SavedComparisonsStore<State> {
  function readRaw(): SavedComparison<State>[] {
    try {
      const raw = window.localStorage.getItem(storageKey);
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
  let cachedSnapshot: SavedComparison<State>[] = [];
  // The server render has no localStorage at all; returning the same empty
  // array both there and as the hook's initial client value (before the real
  // snapshot is read) is what keeps hydration from ever seeing a mismatch.
  const serverSnapshot: SavedComparison<State>[] = [];

  function getSnapshot(): SavedComparison<State>[] {
    if (typeof window === "undefined") return serverSnapshot;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      return serverSnapshot;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedSnapshot = readRaw();
    }
    return cachedSnapshot;
  }

  // Same-tab writes don't fire the browser's native `storage` event — that
  // only fires in OTHER tabs/windows — so this app-level pub/sub is what
  // makes useSyncExternalStore notice a same-tab write.
  const listeners = new Set<() => void>();
  const emitChange = () => listeners.forEach((l) => l());

  function write(list: SavedComparison<State>[]) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {
      // Storage full or blocked: the save just doesn't persist.
    }
    emitChange();
  }

  return {
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    save(name, state) {
      const entry: SavedComparison<State> = {
        id: crypto.randomUUID(),
        name: name.trim() || "Untitled comparison",
        savedAt: new Date().toISOString(),
        state: { ...state, modelVersion },
      };
      write([entry, ...readRaw()].slice(0, MAX_SAVED));
      return entry;
    },
    remove(id) {
      write(readRaw().filter((c) => c.id !== id));
    },
  };
}
