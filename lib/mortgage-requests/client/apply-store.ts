"use client";

/**
 * The wizard's store: ./apply-state.ts's state, kept in this tab's
 * sessionStorage, with a hook for the steps. Only metadata — file names and
 * sizes, never bytes.
 */

import { useCallback, useSyncExternalStore } from "react";
import { freshState, STORE_KEY, type ApplyState } from "./apply-state";

// ── The store ───────────────────────────────────────────────────

let current: ApplyState | null = null;
const listeners = new Set<() => void>();

function read(): ApplyState {
  if (current) return current;
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ApplyState) : null;
    current = parsed && parsed.v === 1 && typeof parsed.idempotencyKey === "string" ? parsed : freshState();
  } catch {
    current = freshState();
  }
  return current;
}

function write(next: ApplyState): void {
  current = next;
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota: the wizard still works for this page's life.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests: forget the in-memory copy so the next read goes to storage. */
export function resetStoreCache(): void {
  current = null;
}

export function getApplyState(): ApplyState {
  return read();
}

export function setApplyState(update: (state: ApplyState) => ApplyState): void {
  write(update(read()));
}

/**
 * The state, or null during server rendering and hydration — the store lives
 * in sessionStorage, which the server can't see. Pages render nothing
 * state-dependent until it arrives.
 */
export function useApplyState(): [ApplyState | null, (update: (state: ApplyState) => ApplyState) => void] {
  const state = useSyncExternalStore(subscribe, read, () => null);
  const update = useCallback((fn: (s: ApplyState) => ApplyState) => setApplyState(fn), []);
  return [state, update];
}

