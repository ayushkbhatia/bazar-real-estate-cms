"use client";

import { useTranslations } from "next-intl";

/**
 * T3-B: floating shortlist drawer.
 *
 * Sits bottom-left (so it doesn't fight the advisor-contact rail at
 * bottom-right). Reads the existing compare-store localStorage IDs and
 * fetches a minimal property snapshot via `/api/shortlist`.  Clicking
 * `Compare side-by-side` routes to the existing `/tools/compare?ids=…`
 * page so we keep the deeper-experience flow intact.
 *
 * ## Where the words come from
 *
 * Two sources, split on one rule: **anything with a number in it stays in the
 * message catalogue.** Arabic agrees a sentence with its count across six
 * plural categories, which a CMS text input cannot express and an
 * English-reading reviewer cannot check — so the counts, the bed/bath line and
 * the compare button are ICU in the `common` catalogue.
 *
 * Everything else is `copy`, resolved from the `shortlist` library section and
 * threaded down from the public layout (this is a client component, so it
 * cannot read the document itself). That is what makes the panel editable at
 * /admin/pages/sub/section/shortlist, and it is also what gives it Arabic: a
 * library section's `text`/`textarea` fields get their `_ar` twin derived and
 * folded for free. See docs/I18N.md, "I added a new section".
 *
 * ## Why removal is deferred, and why the fetch is incremental
 *
 * Deleting a row used to blank the whole panel for a network round trip. The
 * chain was: write the store, `ids` changes identity, the fetch effect refires,
 * `setLoading(true)`, and the render swapped the entire list for a "Loading…"
 * line — then put back every row except the deleted one. Two separate causes,
 * fixed separately:
 *
 *   1. **The fetch only asks for ids it has no snapshot for.** Removing an id
 *      leaves nothing missing, so no request is made at all. The cache is
 *      merged into, never replaced, and only a *locale* change invalidates it
 *      (the titles and area names come back in the other language).
 *   2. **A populated list never yields to the loading state.** The skeleton is
 *      for a cold open, not for a refresh.
 *
 * The exit animation then rides on the deferral: the click marks the row
 * `data-exiting`, which collapses its grid row from `1fr` to `0fr`. The rows
 * below slide up continuously because the departing box is *shrinking* — no
 * FLIP measuring, no layout maths, and it is direction-agnostic, so Arabic
 * gets it for free (the only transform is on the Y axis). The store write
 * happens `EXIT_MS` later, which is what keeps `ids` — and therefore the row's
 * position and data — stable for the length of the animation.
 *
 * Deferring a write means it can be dropped, so it is flushed on unmount and
 * every commit re-reads the store rather than trusting a captured `ids`: two
 * quick deletes must not resurrect each other.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "@/components/i18n/link";
import { ArrowRight, Mail, Scale, Send, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPARE_CAP,
  COMPARE_STORAGE_KEY,
  SHORTLIST_CAP,
  loadCompareIds,
  saveCompareIds,
} from "@/lib/compare-store";
import {
  DEFAULT_PREFERENCES,
  formatPrice,
  usePreferences,
} from "@/lib/preferences";
import { buildAdvisorWhatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { useIsRtl } from "@/lib/dom/use-is-rtl";
import { isolateForLocale } from "@/lib/i18n/bidi";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { localeFromPathname } from "@/lib/i18n/routing";
import type { SectionCopy } from "@/lib/queries/content-sections";

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

/**
 * How long a row takes to collapse out of the list.
 *
 * Has to agree with the `duration-300` on the row's transition: too short and
 * the row unmounts mid-collapse, too long and an empty gap sits there after the
 * animation has finished.
 */
const EXIT_MS = 300;
/** Per-row delay when the whole list goes at once, so "Clear" cascades. */
const CLEAR_STAGGER_MS = 45;

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

export function ShortlistDrawer({ copy }: { copy: SectionCopy }) {
  // `common` is already client-global — these were simply never wired.
  const t = useTranslations("common");
  const rtl = useIsRtl();
  const { prefs } = usePreferences();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // The drawer's own URL, for the plain-text hand-offs and for deciding
  // whether a Latin run needs isolating. `usePathname` rather than
  // `useLocale()` for the reason `components/i18n/link.tsx` documents: this
  // component mounts in the layout, and the pathname needs no provider.
  const locale = localeFromPathname(pathname ?? "/") ?? DEFAULT_LOCALE;
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
  /*
   * Rows that have been deleted but are still on screen, collapsing.
   *
   * They are still in `ids` — the store write is what waits — so nothing about
   * their position or their data has to be remembered here. `clearing` is
   * separate because it is the only case that staggers, and a stagger applied
   * to a single delete would just make it feel slow.
   */
  const [exiting, setExiting] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);
  const timersRef = useRef<number[]>([]);
  const pendingRef = useRef<Set<string>>(new Set<string>());
  // Which of the shortlist goes to the compare table. The shortlist holds up
  // to `SHORTLIST_CAP`; the table holds four columns, so with more than four
  // saved *something* has to choose — and letting it silently take the first
  // four is the behaviour splitting the caps was meant to kill. The visitor
  // picks. `null` = untouched, see `compareIds` below.
  const [picked, setPicked] = useState<string[] | null>(null);

  /*
   * A locale change invalidates the snapshot cache.
   *
   * The rows carry `title` and `area_name` already folded to one language by
   * `/api/shortlist`, so they are wrong the moment the visitor switches. The
   * incremental fetch below would never notice — nothing is *missing* — so the
   * cache is dropped here and refilled. Adjusted during render rather than in
   * an effect, the same way `lastPath` below is, and for the same reason.
   */
  const [lastLocale, setLastLocale] = useState(locale);
  if (locale !== lastLocale) {
    setLastLocale(locale);
    setItems([]);
  }

  /*
   * Close when the URL changes.
   *
   * The drawer mounts in the public layout, so a client-side navigation out
   * of it re-renders `children` and leaves this component — and its `open`
   * state — exactly as it was. The Radix overlay therefore stayed on top of
   * the page it had just navigated to, which read as "Compare side-by-side
   * does nothing": the URL changed, the compare page rendered underneath,
   * and the visitor could not see any of it. Every listing link in the list
   * had the same problem.
   *
   * Adjusted during render rather than in an effect — React's own
   * prescription for "reset state when a prop changes", and it avoids
   * painting the stale-open panel for a frame the way an effect would.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  /*
   * The rows to render, in shortlist order.
   *
   * Ordered by `ids` rather than by the response, because the response now
   * only ever carries the ids that were missing — trusting its order would
   * shuffle the list every time a listing was added.
   *
   * Exiting rows are still in `ids`, so they are still here: that is what lets
   * them animate in place instead of vanishing.
   */
  const byId = new Map(rawItems.map((i) => [i.id, i]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((i): i is ShortlistItem => i !== undefined);

  /*
   * Ask only for what we do not already hold.
   *
   * This is the line that fixes the delete flash: after a removal nothing is
   * missing, so the effect does not fire, `loading` never goes true, and the
   * remaining rows are never unmounted. Joined into a string because the
   * array is a fresh identity every render and would re-run the effect
   * forever as a dependency.
   */
  const missingKey = ids.filter((id) => !byId.has(id)).join(",");

  useEffect(() => {
    if (!open) return; // lazy: only fetch when the drawer is opened
    if (missingKey === "") return;
    let cancelled = false;
    // Loading flag is a UI hint that has to fire before the network round
    // trip starts — the React Compiler lint rule is too strict for this
    // pre-fetch toggle pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(
      `/api/shortlist?ids=${encodeURIComponent(missingKey)}&locale=${locale}`,
    )
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items: ShortlistItem[] }) => {
        if (cancelled) return;
        // Merge, never replace: the response holds only the ids we asked
        // for, and everything already on screen has to survive it.
        setItems((prev) => {
          const merged = new Map(prev.map((i) => [i.id, i]));
          for (const item of data.items ?? []) merged.set(item.id, item);
          return [...merged.values()];
        });
      })
      .catch(() => {
        /* keep whatever is already on screen */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, missingKey, locale]);

  /**
   * Write the deletions we have been holding back.
   *
   * Reads the store rather than closing over `ids`: by the time a timer fires,
   * another removal may already have committed, and a captured array would put
   * its row back.
   */
  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (pending.size === 0) return;
    saveCompareIds(loadCompareIds().filter((x) => !pending.has(x)));
    pending.clear();
  }, []);

  /*
   * A deferred write can be lost — to a navigation, a tab close, the drawer
   * unmounting when the last row goes. Flushing on teardown is what makes the
   * deferral invisible rather than occasionally destructive.
   */
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers) window.clearTimeout(t);
      timers.length = 0;
      flushPending();
    };
  }, [flushPending]);

  const removeId = useCallback((id: string) => {
    if (pendingRef.current.has(id)) return; // already on its way out
    pendingRef.current.add(id);
    setExiting((prev) => (prev.includes(id) ? prev : [...prev, id]));
    timersRef.current.push(
      window.setTimeout(() => {
        pendingRef.current.delete(id);
        // `saveCompareIds` dispatches a synthetic storage event, so the
        // `useSyncExternalStore` subscription repaints with the new set —
        // and the row, already collapsed to nothing, unmounts unseen.
        saveCompareIds(loadCompareIds().filter((x) => x !== id));
        setExiting((prev) => prev.filter((x) => x !== id));
      }, EXIT_MS),
    );
  }, []);

  const clearAll = useCallback(() => {
    const live = loadCompareIds();
    if (live.length === 0) return;
    // Any single removal already in flight is folded into this one, so its
    // timer does not fire mid-cascade and un-mark a row that is still leaving.
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current.length = 0;
    for (const id of live) pendingRef.current.add(id);
    setClearing(true);
    setExiting(live);
    timersRef.current.push(
      window.setTimeout(
        () => {
          flushPending();
          setExiting([]);
          setClearing(false);
          setPicked(null);
        },
        EXIT_MS + (live.length - 1) * CLEAR_STAGGER_MS,
      ),
    );
  }, [flushPending]);

  /*
   * What the panel counts, links and sends.
   *
   * A row that is on its way out is gone as far as every number is concerned —
   * the header count, the compare button, the two hand-off payloads — even
   * though it is still on screen for another 300ms. Anything else would show
   * the visitor a count that contradicts what they just did.
   */
  const activeIds = exiting.length
    ? ids.filter((id) => !exiting.includes(id))
    : ids;
  const activeItems = exiting.length
    ? items.filter((i) => !exiting.includes(i.id))
    : items;

  // `compareIds` is derived, not synced: `picked === null` means "hasn't
  // touched the checkboxes" and falls back to the first four, so the
  // one-click path stays intact for a small shortlist. Filtering against
  // `ids` on every render is what keeps a removed listing from lingering in
  // the selection, and avoids a reconciling effect (which
  // `react-hooks/set-state-in-effect` would reject anyway).
  const compareIds = (picked ?? activeIds.slice(0, COMPARE_CAP)).filter((id) =>
    activeIds.includes(id),
  );
  const compareFull = compareIds.length >= COMPARE_CAP;

  // Plain function, not `useCallback`: it closes over the derived
  // `compareIds`, and the React Compiler infers a narrower dependency set
  // than a hand-written `[ids]`, which trips
  // `react-hooks/preserve-manual-memoization`. The compiler memoizes it.
  function togglePicked(id: string) {
    if (compareIds.includes(id)) {
      setPicked(compareIds.filter((x) => x !== id));
    } else if (!compareFull) {
      setPicked([...compareIds, id]);
    }
  }

  const compareHref = `/tools/compare?ids=${encodeURIComponent(compareIds.join(","))}`;
  // The two hand-off payloads below quote AED regardless of what the visitor
  // is looking at — `DEFAULT_PREFERENCES`, not `prefs`. A Bazar advisor reads
  // these, and the desk works in dirhams; a brief saying "$1.14M" makes them
  // convert back, and a rounding error in that direction is a commercial one.
  //
  // Both are plain text, so there is no element to hang a `dir` on and the
  // isolation has to be done with characters (docs/I18N.md). A reference like
  // `BAZ-AD-01302` renders as `01302-BAZ-AD` inside an Arabic line without it.
  // `isolateForLocale` leaves the English payloads byte-identical.
  const line = (i: ShortlistItem) =>
    `• ${isolateForLocale(i.title, locale)} (${isolateForLocale(i.reference, locale)}) — ${isolateForLocale(formatPrice(i.price_aed, DEFAULT_PREFERENCES), locale)}`;
  const whatsappMessage = activeItems.length
    ? `${t("shortlist.whatsappIntro", { count: activeItems.length })}\n\n` +
      activeItems.map(line).join("\n")
    : null;
  const whatsappHref = whatsappMessage
    ? buildAdvisorWhatsAppLink(whatsappMessage)
    : null;

  // T3-B cleanup: "Email me these" — mailto: with the shortlist pre-filled
  // as the email body. Sends to the visitor's own email by default (they
  // forward to whoever they want); on mobile this opens the system mail
  // composer with all the property refs baked in.
  const mailtoHref = activeItems.length
    ? `mailto:?subject=${encodeURIComponent(t("shortlist.emailSubject"))}&body=${encodeURIComponent(
        `${t("shortlist.emailIntro", { count: activeItems.length })}\n\n` +
          activeItems
            .map(
              (i) =>
                `${line(i)}\n  ${isolateForLocale(`https://bazar.ae/p/${i.slug}-${i.reference}`, locale)}`,
            )
            .join("\n\n") +
          `\n\n${t("shortlist.emailSignoff")}`,
      )}`
    : null;

  /*
   * Nothing saved and nothing open: no trigger, no panel.
   *
   * The `open` half matters — deleting the last row used to unmount the whole
   * component, so the panel the visitor was reading disappeared from under
   * them mid-animation. Now it stays and shows its empty line, and they close
   * it themselves.
   */
  if (ids.length === 0 && !open) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Hidden once the list is empty — the corner is not worth crowding for
          a visitor who has not engaged yet — but the panel above survives it. */}
      <SheetTrigger
        asChild
        className={activeIds.length === 0 ? "hidden" : undefined}
      >
        <button
          type="button"
          aria-label={t("shortlist.triggerAria", { count: activeIds.length })}
          // Mobile sits above the floating-CTA dock (which is fixed to
          // bottom-0 and ~64px tall over the safe-area inset), so the two
          // don't overlap. Desktop keeps the original bottom-left corner,
          // opposite the desktop CTA column at bottom-right.
          className="fixed start-3 md:start-4 bottom-[calc(var(--bz-bar-safe)+64px)] md:bottom-6 z-40 inline-flex items-center gap-2 h-11 px-4 rounded-full bg-bz-ink text-bz-bg shadow-lg hover:bg-bz-ink/90 text-[13px]"
        >
          <Scale size={14} strokeWidth={1.8} />
          <span>
            {copy.trigger_label} · {activeIds.length}
          </span>
        </button>
      </SheetTrigger>
      {/* `side` is a PROP, which is why a hardcoded "left" survived the
          physical→logical conversion: the guard in
          `lib/rtl/no-physical-utilities.test.ts` reads className strings, and
          there is no physical utility here to find. The primitive compiles it
          to `left-0` + `border-r` + `slide-in-from-left`, so under /ar the
          panel flew in from the physical left while its own trigger — `start-3`,
          logical — sat at the physical right, i.e. the opposite edge. The
          primitive is a shared file, so the flip happens here.

          `data-[side=…]:w-full` on both sides rather than a bare `w-full`: the
          sheet sets its width through `data-[side=left]:w-3/4`, and an
          attribute-qualified selector outranks a plain class, so a plain
          `w-full` loses and the panel renders three-quarter width with the
          page showing through beside it. Matching the modifier both wins on
          specificity and lets tailwind-merge drop the base. Desktop width is
          unaffected — the primitive's `sm:max-w-sm` caps it there for either
          side, and outranks anything unqualified we'd add here. */}
      {/* `showCloseButton={false}` and our own X below. The primitive's is
          labelled with a hardcoded English "Close" — an unreadable control for
          the one group of visitors who depend on it most. `components/ui/*`
          are shadcn primitives we re-add rather than edit, so this composes
          around it the way FooterTrust composes around PublicFooter. The other
          three Sheets on the public site still carry the English label; see
          docs/FOLLOWUPS.md. */}
      <SheetContent
        side={rtl ? "right" : "left"}
        showCloseButton={false}
        className="data-[side=left]:w-full data-[side=right]:w-full p-0 flex flex-col"
      >
        {/* The panel is `inset-y-0` and full-width on a phone, and the page
            sets viewport-fit=cover — so a bare `top-3` / `pt-6` puts the close
            control and the title under the status bar. `calc(env + …)` rather
            than `pt-safe`, because this sheet is not mobile-only: the token is
            0px wherever there is no inset, which keeps the desktop panel
            bit-identical instead of gaining the utility's 18px floor. */}
        <SheetClose className="absolute top-[calc(var(--bz-safe-top)+0.75rem)] end-3 inline-flex items-center justify-center size-8 rounded-md text-bz-ink-2 hover:text-bz-ink hover:bg-bz-surface-2 transition-colors">
          <X size={16} strokeWidth={1.8} />
          <span className="sr-only">{t("close")}</span>
        </SheetClose>
        <SheetHeader className="px-6 pt-[calc(var(--bz-safe-top)+1.5rem)] pb-3 border-b border-bz-border">
          <SheetTitle className="serif text-[24px] leading-tight">
            {copy.title}
          </SheetTitle>
          <SheetDescription>
            {t("shortlist.savedCount", {
              count: activeIds.length,
              max: SHORTLIST_CAP,
              note: copy.storage_note,
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* A populated list never yields to the loading state — that swap is
              what made deleting a row blank the panel. The skeleton is for a
              cold open only, and by then there is nothing to preserve. */}
          {loading && items.length === 0 ? (
            <SkeletonRows label={t("shortlist.loading")} />
          ) : items.length === 0 ? (
            <p className="text-[13px] text-bz-ink-2">{copy.empty}</p>
          ) : (
            /* `-mb-4` swallows the last row's `pb-4`. The spacing lives on the
               row rather than in a `gap` so that it collapses *with* the row —
               a gap would survive the exit and leave a 16px hole behind. */
            <ul className="flex flex-col -mb-4">
              {items.map((item, index) => {
                const inCompare = compareIds.includes(item.id);
                const isExiting = exiting.includes(item.id);
                return (
                  /* The exit: `1fr` → `0fr` on a single-row grid, with the
                     content clipped by the `overflow-hidden` child. The rows
                     below slide up because this box is shrinking, which is
                     why there is no FLIP maths here and why it needs nothing
                     for Arabic: a collapsing height and a 4px lift are both
                     on the Y axis, which RTL does not mirror. */
                  <li
                    key={item.id}
                    data-exiting={isExiting ? "true" : undefined}
                    style={
                      clearing
                        ? { transitionDelay: `${index * CLEAR_STAGGER_MS}ms` }
                        : undefined
                    }
                    className={cn(
                      "grid grid-rows-[1fr] ease-out",
                      // `translate`, NOT `transform`: Tailwind v4 compiles
                      // `-translate-y-1` to the standalone `translate` property,
                      // so naming `transform` here transitions a property the
                      // utility never sets and the 4px lift snaps instead of
                      // easing. Verified in the browser — `transform` stays
                      // `none` in both states while `translate` goes `0px -4px`.
                      "transition-[grid-template-rows,opacity,translate] duration-300",
                      "data-[exiting=true]:grid-rows-[0fr]",
                      "data-[exiting=true]:opacity-0",
                      "data-[exiting=true]:-translate-y-1",
                      "motion-reduce:transition-none",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="flex gap-3 pb-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none">
                        <label className="flex items-center shrink-0 self-stretch cursor-pointer">
                          <input
                            type="checkbox"
                            checked={inCompare}
                            disabled={!inCompare && compareFull}
                            onChange={() => togglePicked(item.id)}
                            className="w-4 h-4 accent-bz-accent disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={t(
                              inCompare
                                ? "shortlist.removeFromCompare"
                                : compareFull
                                  ? "shortlist.compareFull"
                                  : "shortlist.addToCompare",
                              { title: item.title },
                            )}
                          />
                        </label>
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
                            {item.area_name ?? copy.area_fallback}
                          </div>
                          <div className="mt-1 flex items-baseline justify-between gap-2">
                            <span className="mono text-[12.5px] text-bz-ink">
                              {formatPrice(item.price_aed, prefs)}
                            </span>
                            <span className="text-[11px] text-bz-ink-2">
                              {t("shortlist.bedsBaths", {
                                beds: item.beds,
                                baths: item.baths,
                              })}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeId(item.id)}
                          aria-label={t("shortlist.removeFromShortlist", {
                            title: item.title,
                          })}
                          className="text-bz-ink-2 hover:text-bz-ink transition-colors shrink-0"
                        >
                          <Trash2 size={14} strokeWidth={1.7} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Same reasoning as the header above, at the other end: the last
            button in this column sits on the bottom edge of a full-height
            fixed panel, i.e. under the home indicator. */}
        <div className="px-6 pt-4 pb-[calc(var(--bz-safe-bottom)+1rem)] border-t border-bz-border flex flex-col gap-2">
          {/* The table takes four columns, so say which four are going and
              let the count move as the visitor ticks boxes. `asChild` on a
              disabled Button still renders a live <Link>, so the
              under-two-selected case has to render as plain text instead. */}
          {compareIds.length < 2 ? (
            <Button disabled>
              <Scale size={14} strokeWidth={1.7} />
              {t("shortlist.selectTwo")}
            </Button>
          ) : (
            <Button asChild>
              <Link href={compareHref}>
                <Scale size={14} strokeWidth={1.7} />
                {t("shortlist.compareCta", { count: compareIds.length })}
                <ArrowRight size={14} strokeWidth={1.7} className="ms-auto" />
              </Link>
            </Button>
          )}
          {activeItems.length > COMPARE_CAP ? (
            <p className="text-[11.5px] text-bz-ink-2 -mt-0.5">
              {copy.pick_help}
            </p>
          ) : null}
          {whatsappHref ? (
            <Button asChild variant="outline">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <Send size={14} strokeWidth={1.7} />
                {copy.whatsapp_label}
              </a>
            </Button>
          ) : null}
          {mailtoHref ? (
            <Button asChild variant="outline">
              <a href={mailtoHref}>
                <Mail size={14} strokeWidth={1.7} />
                {copy.email_label}
              </a>
            </Button>
          ) : null}
          {activeItems.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-[12px] text-bz-ink-2 hover:text-bz-ink transition-colors mt-2 self-start"
            >
              {copy.clear_label}
            </button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The cold-open placeholder.
 *
 * Mirrors the real row's geometry — 80px thumbnail, three text lines — so the
 * panel does not jolt when the data lands. Purely decorative, hence
 * `aria-hidden`; the announcement is the visually-hidden status line, which is
 * also what keeps `shortlist.loading` a live catalogue key in both locales.
 */
function SkeletonRows({ label }: { label: string }) {
  return (
    <>
      <p role="status" className="sr-only">
        {label}
      </p>
      <ul className="flex flex-col -mb-4 animate-pulse" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3 pb-4">
            <div className="w-4 h-4 self-center shrink-0 rounded-sm bg-bz-surface-2" />
            <div className="w-20 h-20 shrink-0 rounded-md bg-bz-surface-2" />
            <div className="flex-1 min-w-0 pt-1.5">
              <div className="h-3 w-3/4 rounded bg-bz-surface-2" />
              <div className="h-2.5 w-1/2 rounded bg-bz-surface-2 mt-2" />
              <div className="h-3 w-2/5 rounded bg-bz-surface-2 mt-3.5" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
