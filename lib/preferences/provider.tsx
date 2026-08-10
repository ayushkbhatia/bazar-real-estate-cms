"use client";

/**
 * Client-side preferences provider.
 *
 * The root layout reads the `bz_prefs` cookie server-side and passes the
 * initial value here, so SSR matches first paint (no hydration flicker).
 * Updates persist to both cookie (for SSR) and localStorage (for cross-tab
 * sync via the `storage` event).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_PREFERENCES,
  type AreaUnit,
  type Currency,
  type Preferences,
} from "./types";
import { setLiveRates } from "./rates";
import { PREFS_COOKIE, PREFS_COOKIE_MAX_AGE, encodePrefs, decodePrefs } from "./cookie";

type Ctx = {
  prefs: Preferences;
  setCurrency: (c: Currency) => void;
  setAreaUnit: (u: AreaUnit) => void;
  setPrefs: (p: Partial<Preferences>) => void;
};

const PreferencesContext = createContext<Ctx | null>(null);

const LS_KEY = "bz:prefs:v1";

function writeCookie(prefs: Preferences) {
  if (typeof document === "undefined") return;
  const value = encodePrefs(prefs);
  // Empty value still pins the default so server reads stay consistent.
  document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${PREFS_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function writeLocalStorage(prefs: Preferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, encodePrefs(prefs));
  } catch {
    /* quota / SSR no-op */
  }
}

/**
 * External-store snapshot for `useSyncExternalStore`. Reads the cookie
 * first (preferred — the popover writes it) and falls back to
 * localStorage. We memoise the last result so React's snapshot-equality
 * check can short-circuit re-renders.
 */
let cachedSnapshot: Preferences | null = null;
let lastSnapshotKey = "";

function readClientPrefs(): Preferences {
  if (typeof document === "undefined" && typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }
  const cookieMatch =
    typeof document !== "undefined"
      ? document.cookie.match(/(?:^|; )bz_prefs=([^;]*)/)
      : null;
  const raw = cookieMatch
    ? decodeURIComponent(cookieMatch[1]!)
    : (typeof window !== "undefined" &&
        window.localStorage.getItem(LS_KEY)) ||
      "";
  if (raw === lastSnapshotKey && cachedSnapshot) return cachedSnapshot;
  lastSnapshotKey = raw;
  cachedSnapshot = decodePrefs(raw);
  return cachedSnapshot;
}

function getServerSnapshot(): Preferences {
  return DEFAULT_PREFERENCES;
}

/**
 * Tiny pub/sub so updates from `setPrefs` flow through `useSyncExternalStore`.
 * `window.storage` events handle cross-tab; the in-tab listener set below
 * handles same-tab updates from the popover.
 */
const subscribers = new Set<() => void>();
function notifySubscribers() {
  cachedSnapshot = null;
  lastSnapshotKey = "";
  subscribers.forEach((cb) => cb());
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  function onStorage(e: StorageEvent) {
    if (e.key === LS_KEY) callback();
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    subscribers.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/**
 * Pull the live EUR rate once per page load and push it into the rates
 * module, then nudge subscribers so anything already rendered with the
 * static fallback re-formats.
 *
 * Module-level so it runs at most once per document even though the
 * provider can in principle mount more than once (dual-tree chrome). The
 * fetch is cheap and heavily cached, but a double-mount refetch would show
 * up in the network panel and invite a bug report.
 */
let fxRequested = false;

async function loadFxRates(onLoaded: () => void) {
  if (fxRequested) return;
  fxRequested = true;
  try {
    const res = await fetch("/api/fx");
    if (!res.ok) return;
    const body: { rates?: Record<string, number> } = await res.json();
    if (!body?.rates) return;
    setLiveRates(body.rates);
    onLoaded();
  } catch {
    // Offline or blocked — STATIC_RATES already covers this.
  }
}

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // useSyncExternalStore is React's blessed way to subscribe to an external
  // store without the setState-in-effect anti-pattern. On the server it
  // returns DEFAULT_PREFERENCES (matching the static HTML); on the client
  // it reads the cookie/localStorage and re-renders if the snapshot differs.
  const prefs = useSyncExternalStore(
    subscribe,
    readClientPrefs,
    getServerSnapshot,
  );

  useEffect(() => {
    void loadFxRates(notifySubscribers);
  }, []);

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    const current = readClientPrefs();
    const next: Preferences = { ...current, ...patch };
    writeCookie(next);
    writeLocalStorage(next);
    notifySubscribers();
  }, []);

  const setCurrency = useCallback((c: Currency) => setPrefs({ currency: c }), [setPrefs]);
  const setAreaUnit = useCallback((u: AreaUnit) => setPrefs({ area_unit: u }), [setPrefs]);

  const value = useMemo<Ctx>(
    () => ({ prefs, setCurrency, setAreaUnit, setPrefs }),
    [prefs, setCurrency, setAreaUnit, setPrefs],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

/**
 * Hook for client components. Safe to call from anywhere inside the public
 * route group; throws (in dev) when used outside the provider so we catch
 * the misuse quickly.
 */
export function usePreferences(): Ctx {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        "usePreferences must be used inside <PreferencesProvider>",
      );
    }
    // In prod, return a no-op fallback so we don't crash the page.
    return {
      prefs: DEFAULT_PREFERENCES,
      setCurrency: () => {},
      setAreaUnit: () => {},
      setPrefs: () => {},
    };
  }
  return ctx;
}
