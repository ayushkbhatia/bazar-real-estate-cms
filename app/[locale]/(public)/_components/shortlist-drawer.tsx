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
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
  // Which of the shortlist goes to the compare table. The shortlist holds up
  // to `SHORTLIST_CAP`; the table holds four columns, so with more than four
  // saved *something* has to choose — and letting it silently take the first
  // four is the behaviour splitting the caps was meant to kill. The visitor
  // picks. `null` = untouched, see `compareIds` below.
  const [picked, setPicked] = useState<string[] | null>(null);

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
    fetch(
      `/api/shortlist?ids=${encodeURIComponent(ids.join(","))}&locale=${locale}`,
    )
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
  }, [ids, open, locale]);

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
    setPicked(null);
  }, []);

  // `compareIds` is derived, not synced: `picked === null` means "hasn't
  // touched the checkboxes" and falls back to the first four, so the
  // one-click path stays intact for a small shortlist. Filtering against
  // `ids` on every render is what keeps a removed listing from lingering in
  // the selection, and avoids a reconciling effect (which
  // `react-hooks/set-state-in-effect` would reject anyway).
  const compareIds = (picked ?? ids.slice(0, COMPARE_CAP)).filter((id) =>
    ids.includes(id),
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
  const whatsappMessage = items.length
    ? `${t("shortlist.whatsappIntro", { count: items.length })}\n\n` +
      items.map(line).join("\n")
    : null;
  const whatsappHref = whatsappMessage
    ? buildAdvisorWhatsAppLink(whatsappMessage)
    : null;

  // T3-B cleanup: "Email me these" — mailto: with the shortlist pre-filled
  // as the email body. Sends to the visitor's own email by default (they
  // forward to whoever they want); on mobile this opens the system mail
  // composer with all the property refs baked in.
  const mailtoHref = items.length
    ? `mailto:?subject=${encodeURIComponent(t("shortlist.emailSubject"))}&body=${encodeURIComponent(
        `${t("shortlist.emailIntro", { count: items.length })}\n\n` +
          items
            .map(
              (i) =>
                `${line(i)}\n  ${isolateForLocale(`https://bazar.ae/p/${i.slug}-${i.reference}`, locale)}`,
            )
            .join("\n\n") +
          `\n\n${t("shortlist.emailSignoff")}`,
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
          aria-label={t("shortlist.triggerAria", { count: ids.length })}
          // Mobile sits above the floating-CTA dock (which is fixed to
          // bottom-0 and ~64px tall over the safe-area inset), so the two
          // don't overlap. Desktop keeps the original bottom-left corner,
          // opposite the desktop CTA column at bottom-right.
          className="fixed start-3 md:start-4 bottom-[calc(var(--bz-bar-safe)+64px)] md:bottom-6 z-40 inline-flex items-center gap-2 h-11 px-4 rounded-full bg-bz-ink text-bz-bg shadow-lg hover:bg-bz-ink/90 text-[13px]"
        >
          <Scale size={14} strokeWidth={1.8} />
          <span>
            {copy.trigger_label} · {ids.length}
          </span>
        </button>
      </SheetTrigger>
      {/* `data-[side=left]:w-full` rather than a bare `w-full`: the sheet
          primitive sets its width through `data-[side=left]:w-3/4`, and an
          attribute-qualified selector outranks a plain class, so a plain
          `w-full` loses and the panel renders three-quarter width with the
          page showing through beside it. Matching the modifier both wins on
          specificity and lets tailwind-merge drop the base. Desktop width is
          unaffected — the primitive's `data-[side=left]:sm:max-w-sm` caps it
          there, and outranks anything unqualified we'd add here. */}
      {/* `showCloseButton={false}` and our own X below. The primitive's is
          labelled with a hardcoded English "Close" — an unreadable control for
          the one group of visitors who depend on it most. `components/ui/*`
          are shadcn primitives we re-add rather than edit, so this composes
          around it the way FooterTrust composes around PublicFooter. The other
          three Sheets on the public site still carry the English label; see
          docs/FOLLOWUPS.md. */}
      <SheetContent
        side="left"
        showCloseButton={false}
        className="data-[side=left]:w-full p-0 flex flex-col"
      >
        <SheetClose className="absolute top-3 end-3 inline-flex items-center justify-center size-8 rounded-md text-bz-ink-2 hover:text-bz-ink hover:bg-bz-surface-2 transition-colors">
          <X size={16} strokeWidth={1.8} />
          <span className="sr-only">{t("close")}</span>
        </SheetClose>
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-bz-border">
          <SheetTitle className="serif text-[24px] leading-tight">
            {copy.title}
          </SheetTitle>
          <SheetDescription>
            {t("shortlist.savedCount", {
              count: ids.length,
              max: SHORTLIST_CAP,
              note: copy.storage_note,
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-[13px] text-bz-ink-2 italic">{t("shortlist.loading")}</p>
          ) : items.length === 0 ? (
            <p className="text-[13px] text-bz-ink-2">{copy.empty}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => {
                const inCompare = compareIds.includes(item.id);
                return (
                  <li key={item.id} className="flex gap-3">
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-bz-border flex flex-col gap-2">
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
          {items.length > COMPARE_CAP ? (
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
          {items.length > 0 ? (
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
