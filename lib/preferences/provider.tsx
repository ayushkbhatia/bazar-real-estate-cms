"use client";

/**
 * Client-side preferences provider.
 *
 * There is deliberately **no** server-seeded initial value. Reading the
 * `bz_prefs` cookie in the root layout would call `cookies()`, which takes all
 * ~40 public routes fully dynamic and silently discards their
 * `export const revalidate` (home 60, every `/p/[slug]` 60, most others 300).
 * So `getServerSnapshot` returns `DEFAULT_PREFERENCES`, SSR renders AED/ft²,
 * and a visitor who picked something else gets one re-render after hydration.
 * That one frame is the price of keeping the marketplace statically cached —
 * see the same trade spelled out in `app/layout.tsx`.
 *
 * Updates persist to both the cookie (1 year, read by the PDF routes, which
 * have no `revalidate` to lose) and localStorage (cross-tab sync via the
 * `storage` event).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_PREFERENCES,
  type AreaUnit,
  type Currency,
  type Preferences,
} from "./types";
import { DEFAULT_UNIT_LABELS, type UnitLabels } from "./unit-labels";
import {
  PREFS_COOKIE,
  PREFS_COOKIE_MAX_AGE,
  encodePrefs,
  decodePrefs,
} from "./cookie";

/**
 * The preferences a component reads, with the currency / area-unit dictionary
 * for the current locale already attached.
 *
 * `labels` rides ON the prefs object rather than beside it so that
 * `formatPrice(aed, prefs)` — which is how roughly twenty components already
 * call it — picks the visitor's language up for free. It never reaches the
 * cookie: `encodePrefs` writes three named keys and ignores everything else,
 * and `setPrefs` rebuilds from `readClientPrefs()`, which has no labels on it.
 */
export type LabelledPreferences = Preferences & { labels: UnitLabels };

type Ctx = {
  prefs: Preferences;
  setCurrency: (c: Currency) => void;
  setAreaUnit: (u: AreaUnit) => void;
  setPrefs: (p: Partial<Preferences>) => void;
};

const PreferencesContext = createContext<Ctx | null>(null);

/**
 * The dictionary, resolved on the server and handed down.
 *
 * A SEPARATE provider from `PreferencesProvider`, and mounted lower — in
 * `(public)/layout.tsx` rather than the root layout. Two reasons, both load
 * bearing:
 *
 * - The root layout deliberately does no data reads and no `cookies()` call,
 *   because either would take all ~78 public routes dynamic and discard their
 *   `revalidate`. The public layout already makes five cookie-free reads
 *   through the public Supabase client, so a sixth costs a round trip and not
 *   the subtree's render mode.
 * - `/admin` sits outside it. The CMS is English-only, so its components read
 *   `DEFAULT_UNIT_LABELS` through the fallback below and keep rendering "AED"
 *   and "ft²" exactly as they always have — without a single admin file
 *   learning that a dictionary exists.
 *
 * The preferences provider therefore sits ABOVE this one, which is why the
 * dictionary is merged onto `prefs` inside `usePreferences()` and not inside
 * `PreferencesProvider` — see the note on that hook.
 */
const UnitLabelsContext = createContext<UnitLabels | null>(null);

export function UnitLabelsProvider({
  labels,
  children,
}: {
  labels: UnitLabels;
  children: React.ReactNode;
}) {
  return (
    <UnitLabelsContext.Provider value={labels}>
      {children}
    </UnitLabelsContext.Provider>
  );
}

/** The active dictionary, or the shipped English one outside the provider. */
export function useUnitLabels(): UnitLabels {
  return useContext(UnitLabelsContext) ?? DEFAULT_UNIT_LABELS;
}

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
    : (typeof window !== "undefined" && window.localStorage.getItem(LS_KEY)) ||
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

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    const current = readClientPrefs();
    const next: Preferences = { ...current, ...patch };
    writeCookie(next);
    writeLocalStorage(next);
    notifySubscribers();
  }, []);

  const setCurrency = useCallback(
    (c: Currency) => setPrefs({ currency: c }),
    [setPrefs],
  );
  const setAreaUnit = useCallback(
    (u: AreaUnit) => setPrefs({ area_unit: u }),
    [setPrefs],
  );

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

type LabelledCtx = Omit<Ctx, "prefs"> & { prefs: LabelledPreferences };

const NOOP_CTX: Ctx = {
  prefs: DEFAULT_PREFERENCES,
  setCurrency: () => {},
  setAreaUnit: () => {},
  setPrefs: () => {},
};

/**
 * Hook for client components. Safe to call from anywhere inside the public
 * route group; throws (in dev) when used outside the provider so we catch
 * the misuse quickly.
 *
 * The dictionary is attached HERE rather than inside `PreferencesProvider`,
 * and the distinction is the whole reason the first attempt at this rendered
 * English on every Arabic page while the flight payload plainly carried the
 * Arabic words.
 *
 * `PreferencesProvider` sits in the ROOT layout, deliberately — it must not
 * read cookies or data, or all ~78 public routes go dynamic. `UnitLabelsProvider`
 * sits in the PUBLIC layout, one level down, because that is the layout allowed
 * to make a database read. So the preferences provider is ABOVE the dictionary
 * provider, and a `useUnitLabels()` called inside it resolves at its own
 * position in the tree — above the value — and gets the English fallback,
 * for ever, with no error anywhere.
 *
 * A hook body runs at the CONSUMER's position, which is below both. So the
 * merge belongs here, and only here.
 */
export function usePreferences(): LabelledCtx {
  const ctx = useContext(PreferencesContext);
  // Unconditional: hooks cannot sit behind the null check below.
  const labels = useUnitLabels();
  const missing = !ctx;
  const base = ctx ?? NOOP_CTX;
  const value = useMemo<LabelledCtx>(
    () => ({ ...base, prefs: { ...base.prefs, labels } }),
    [base, labels],
  );
  if (missing && process.env.NODE_ENV !== "production") {
    throw new Error("usePreferences must be used inside <PreferencesProvider>");
  }
  return value;
}
