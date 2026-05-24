"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type SavedIdsState = {
  ids: Set<string>;
  isAuthed: boolean;
  loaded: boolean;
};

const INITIAL_STATE: SavedIdsState = {
  ids: new Set(),
  isAuthed: false,
  loaded: false,
};

const SavedIdsContext = createContext<SavedIdsState>(INITIAL_STATE);

// Module-level cache: a single fetch services every consumer on a given page
// load. Subsequent client navigations re-use the resolved snapshot.
let cache: SavedIdsState | null = null;
let inflight: Promise<SavedIdsState> | null = null;

async function loadSavedIds(): Promise<SavedIdsState> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/saved-property-ids", {
    credentials: "include",
    cache: "no-store",
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`status ${r.status}`);
      return (await r.json()) as { ids: string[]; isAuthed: boolean };
    })
    .then((data) => {
      const next: SavedIdsState = {
        ids: new Set(data.ids ?? []),
        isAuthed: !!data.isAuthed,
        loaded: true,
      };
      cache = next;
      inflight = null;
      return next;
    })
    .catch(() => {
      const next: SavedIdsState = {
        ids: new Set(),
        isAuthed: false,
        loaded: true,
      };
      cache = next;
      inflight = null;
      return next;
    });
  return inflight;
}

export function SavedIdsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SavedIdsState>(
    () => cache ?? INITIAL_STATE,
  );

  useEffect(() => {
    // If the cache resolved before this provider mounted, useState() above
    // already picked it up — nothing more to do.
    if (cache) return;
    let alive = true;
    void loadSavedIds().then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SavedIdsContext.Provider value={state}>
      {children}
    </SavedIdsContext.Provider>
  );
}

export function useSavedIds(): SavedIdsState {
  return useContext(SavedIdsContext);
}

export function __resetSavedIdsCacheForTests() {
  cache = null;
  inflight = null;
}
