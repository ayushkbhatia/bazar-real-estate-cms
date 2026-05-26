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
  useState,
} from "react";
import {
  DEFAULT_PREFERENCES,
  type AreaUnit,
  type Currency,
  type Preferences,
} from "./types";
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

export function PreferencesProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Preferences;
}) {
  const [prefs, setPrefsState] = useState<Preferences>(
    initial ?? DEFAULT_PREFERENCES,
  );

  // Cross-tab sync: when another tab updates localStorage, re-decode and apply
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== LS_KEY) return;
      setPrefsState(decodePrefs(e.newValue ?? ""));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefsState((current) => {
      const next: Preferences = { ...current, ...patch };
      writeCookie(next);
      writeLocalStorage(next);
      return next;
    });
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
