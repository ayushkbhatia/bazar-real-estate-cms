"use client";

/**
 * T3-B: floating shortlist drawer.
 *
 * Sits bottom-left (so it doesn't fight the advisor-contact rail at
 * bottom-right). Reads the existing compare-store localStorage IDs and
 * fetches a minimal property snapshot via `/api/shortlist`.  Clicking
 * `Compare side-by-side` routes to the existing `/tools/compare?ids=…`
 * page so we keep the deeper-experience flow intact.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Mail, Scale, Send, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  COMPARE_CAP,
  COMPARE_STORAGE_KEY,
  loadCompareIds,
  saveCompareIds,
} from "@/lib/compare-store";
import { formatAed } from "@/lib/compare";
import { buildAdvisorWhatsAppLink } from "@/lib/whatsapp";

type ShortlistItem = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  price_aed: number | null;
  beds: number;
  baths: number;
  area_name: string | null;
  hero_url: string | null;
  hero_alt: string | null;
};

// Cache the last snapshot we returned from `getCompareSnapshot` so React's
// snapshot-equality check can short-circuit re-renders. Re-deriving from
// localStorage on every call would return a fresh array each time and
// force an infinite render loop.
// Stable empty reference for the server/SSR snapshot. `useSyncExternalStore`
// calls `getServerSnapshot` more than once and compares by reference — a
// fresh `[]` each call reads as an ever-changing store and trips React's
// "getServerSnapshot should be cached to avoid an infinite loop" warning.
const EMPTY_COMPARE_IDS: string[] = [];
let cachedRaw = "";
let cachedSnapshot: string[] = EMPTY_COMPARE_IDS;
function getCompareSnapshot(): string[] {
  if (typeof window === "undefined") return cachedSnapshot;
  const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY) ?? "";
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = loadCompareIds();
  return cachedSnapshot;
}
function getServerCompareSnapshot(): string[] {
  return EMPTY_COMPARE_IDS;
}
function subscribeCompare(callback: () => void): () => void {
  function onStorage(e: StorageEvent) {
    if (e.key === COMPARE_STORAGE_KEY) {
      cachedRaw = ""; // invalidate so the next snapshot re-reads
      callback();
    }
  }
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function ShortlistDrawer() {
  const [open, setOpen] = useState(false);
  // `useSyncExternalStore` is the React-blessed bridge to localStorage —
  // gives us cross-tab + in-tab updates without the setState-in-effect
  // anti-pattern.
  const ids = useSyncExternalStore(
    subscribeCompare,
    getCompareSnapshot,
    getServerCompareSnapshot,
  );
  const [rawItems, setItems] = useState<ShortlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Drop stale items when the id set empties without needing a setState in
  // the subscription effect (which would trip
  // `react-hooks/set-state-in-effect`). Also filter to ensure removed
  // entries vanish even before the next fetch lands.
  const items =
    ids.length === 0 ? [] : rawItems.filter((i) => ids.includes(i.id));

  // Re-fetch when the drawer opens or the id-set changes. We deliberately
  // avoid clearing `items` here when `ids` becomes empty — the render path
  // derives the visible list from both, so an empty `ids` array naturally
  // hides everything without an unnecessary setState in the effect.
  useEffect(() => {
    if (ids.length === 0) return;
    if (!open) return; // lazy: only fetch when the drawer is opened
    let cancelled = false;
    // Loading flag is a UI hint that has to fire before the network round
    // trip starts — the React Compiler lint rule is too strict for this
    // pre-fetch toggle pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/shortlist?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items: ShortlistItem[] }) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids, open]);

  const removeId = useCallback(
    (id: string) => {
      // `saveCompareIds` already dispatches a synthetic storage event so
      // the subscribers (including this hook) repaint with the new set.
      saveCompareIds(ids.filter((x) => x !== id));
    },
    [ids],
  );

  const clearAll = useCallback(() => {
    saveCompareIds([]);
  }, []);

  const compareHref = `/tools/compare?ids=${encodeURIComponent(ids.join(","))}`;
  const whatsappMessage = items.length
    ? `Hi — I'd like to talk about these ${items.length} on bazar.ae:\n\n` +
      items
        .map(
          (i) =>
            `• ${i.title} (${i.reference}) — ${formatAed(i.price_aed)}`,
        )
        .join("\n")
    : null;
  const whatsappHref = whatsappMessage
    ? buildAdvisorWhatsAppLink(whatsappMessage)
    : null;

  // T3-B cleanup: "Email me these" — mailto: with the shortlist pre-filled
  // as the email body. Sends to the visitor's own email by default (they
  // forward to whoever they want); on mobile this opens the system mail
  // composer with all the property refs baked in.
  const mailtoHref = items.length
    ? `mailto:?subject=${encodeURIComponent("My Bazar shortlist")}&body=${encodeURIComponent(
        `Here are the ${items.length} ${items.length === 1 ? "property" : "properties"} I'm tracking on bazar.ae:\n\n` +
          items
            .map(
              (i) =>
                `• ${i.title} (${i.reference}) — ${formatAed(i.price_aed)}\n  https://bazar.ae/p/${i.slug}-${i.reference}`,
            )
            .join("\n\n") +
          "\n\n— Sent from Bazar Real Estate",
      )}`
    : null;

  // Hide the trigger entirely until there's at least one shortlisted item
  // so the corner isn't crowded for users who haven't engaged yet.
  if (ids.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Shortlist (${ids.length})`}
          className="fixed left-4 bottom-6 z-40 hidden md:inline-flex items-center gap-2 h-11 px-4 rounded-full bg-bz-ink text-bz-bg shadow-lg hover:bg-bz-ink/90 text-[13px]"
        >
          <Scale size={14} strokeWidth={1.8} />
          <span>Shortlist · {ids.length}</span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-bz-border">
          <SheetTitle className="serif text-[24px] leading-tight">
            Your shortlist
          </SheetTitle>
          <SheetDescription>
            {ids.length} of {COMPARE_CAP} · saved to this browser
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-[13px] text-bz-ink-2 italic">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-[13px] text-bz-ink-2">
              Nothing to show — try saving a few listings first.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <Link
                    href={`/p/${item.slug}-${item.reference}`}
                    className="block relative w-20 h-20 rounded-md overflow-hidden bg-bz-surface-2 shrink-0"
                  >
                    {item.hero_url ? (
                      <Image
                        src={item.hero_url}
                        alt={item.hero_alt ?? item.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : null}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/p/${item.slug}-${item.reference}`}
                      className="block text-[13.5px] font-medium text-bz-ink hover:text-bz-accent transition-colors truncate"
                    >
                      {item.title}
                    </Link>
                    <div className="text-[11.5px] text-bz-ink-2 mt-0.5 truncate">
                      {item.area_name ?? "United Arab Emirates"}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="mono text-[12.5px] text-bz-ink">
                        {formatAed(item.price_aed)}
                      </span>
                      <span className="text-[11px] text-bz-ink-2">
                        {item.beds}b · {item.baths}ba
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeId(item.id)}
                    aria-label={`Remove ${item.title} from shortlist`}
                    className="text-bz-ink-2 hover:text-bz-ink transition-colors shrink-0"
                  >
                    <Trash2 size={14} strokeWidth={1.7} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-bz-border flex flex-col gap-2">
          <Button asChild disabled={items.length < 2}>
            <Link href={compareHref}>
              <Scale size={14} strokeWidth={1.7} />
              Compare side-by-side
              <ArrowRight size={14} strokeWidth={1.7} className="ml-auto" />
            </Link>
          </Button>
          {whatsappHref ? (
            <Button asChild variant="outline">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <Send size={14} strokeWidth={1.7} />
                WhatsApp these to an advisor
              </a>
            </Button>
          ) : null}
          {mailtoHref ? (
            <Button asChild variant="outline">
              <a href={mailtoHref}>
                <Mail size={14} strokeWidth={1.7} />
                Email me these
              </a>
            </Button>
          ) : null}
          {items.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-[12px] text-bz-ink-2 hover:text-bz-ink transition-colors mt-2 self-start"
            >
              Clear shortlist
            </button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
