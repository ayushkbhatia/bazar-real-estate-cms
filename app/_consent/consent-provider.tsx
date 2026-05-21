"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CONSENT_COOKIE_NAME,
  parseConsent,
  serialiseConsent,
  type ConsentCategory,
  type ConsentState,
} from "@/lib/consent";

const LOCAL_STORAGE_KEY = "bz_consent";

function readClientConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLs = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = parseConsent(fromLs);
    if (parsed) return parsed;
  } catch {
    // localStorage unavailable — fall back to cookie below.
  }
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`));
    if (match) {
      return parseConsent(
        decodeURIComponent(match.slice(match.indexOf("=") + 1)),
      );
    }
  } catch {
    // ignore
  }
  return null;
}

function writeClientConsent(state: ConsentState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, serialiseConsent(state));
  } catch {
    // ignore — cookie is the durable copy
  }
}

type ConsentContextValue = {
  state: ConsentState | null;
  setState: (next: ConsentState) => void;
  isGranted: (category: ConsentCategory) => boolean;
  bannerOpen: boolean;
  openCustomize: boolean;
  setOpenCustomize: (open: boolean) => void;
  dismissBanner: () => void;
  hydrated: boolean;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used inside <ConsentProvider>");
  }
  return ctx;
}

export type ConsentProviderProps = {
  children: React.ReactNode;
};

export function ConsentProvider({ children }: ConsentProviderProps) {
  // Initial render is server-safe: no state until hydration. This keeps
  // the SSR output identical regardless of the user's stored decision,
  // so static pages stay static and analytics components stay un-mounted
  // until the client has a verdict.
  const [state, setStateRaw] = useState<ConsentState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [openCustomize, setOpenCustomize] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // One-shot hydration from localStorage / cookie at mount time. The
  // alternative — a useState lazy initializer — would mismatch the SSR
  // output (which can't see browser storage) on first paint, forcing
  // every consumer page off SSG.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const local = readClientConsent();
    if (local) setStateRaw(local);
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setState = useCallback((next: ConsentState) => {
    writeClientConsent(next);
    setStateRaw(next);
    setOpenCustomize(false);
    setDismissed(false);
  }, []);

  const isGranted = useCallback(
    (category: ConsentCategory) => {
      if (category === "essential") return true;
      if (!state || state.decided_at == null) return false;
      return Boolean(state[category]);
    },
    [state],
  );

  // Banner is open once the client has hydrated AND the user has not decided.
  // We never show it during SSR — that would force every page off SSG.
  const bannerOpen = hydrated && !dismissed && (!state || state.decided_at == null);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      state,
      setState,
      isGranted,
      bannerOpen,
      openCustomize,
      setOpenCustomize,
      dismissBanner,
      hydrated,
    }),
    [state, setState, isGranted, bannerOpen, openCustomize, dismissBanner, hydrated],
  );

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}
