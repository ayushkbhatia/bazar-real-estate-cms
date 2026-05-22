"use client";

import { createContext, useContext, useState, useCallback } from "react";

/**
 * Sprint 4 (backfilled): hover-sync context bridging the listing grid and
 * the map. A card hover sets `hoveredId`; the map highlights the
 * matching pin. Conversely, a pin mouseover lifts the same id so the
 * matching card can highlight on the list side.
 */
type Ctx = {
  hoveredId: string | null;
  setHovered: (id: string | null) => void;
};

const CardPinSyncContext = createContext<Ctx | null>(null);

export function CardPinSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const setHovered = useCallback((id: string | null) => setHoveredId(id), []);
  return (
    <CardPinSyncContext.Provider value={{ hoveredId, setHovered }}>
      {children}
    </CardPinSyncContext.Provider>
  );
}

export function useCardPinSync(): Ctx {
  const ctx = useContext(CardPinSyncContext);
  // The hook is safe to call outside a provider — returns a no-op shape
  // so the search-list components can opt in without forcing every
  // ancestor to wrap. Sprint 12 promotes the provider higher in the tree.
  if (!ctx) {
    return {
      hoveredId: null,
      setHovered: () => {
        /* no-op */
      },
    };
  }
  return ctx;
}
