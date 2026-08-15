"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Plus, Heart, Clock, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { COMPARE_CAP, loadCompareIds } from "@/lib/compare-store";
import { formatPrice, usePreferences } from "@/lib/preferences";

/**
 * Sprint 5b (backfilled): picker drawer for empty compare slots.
 *
 * Three tabs — Saved, Recently viewed, Search. Saved and Recently viewed
 * were originally backed by customer accounts; when those were removed
 * ([ADR-0005](docs/decisions/ADR-0005-remove-customer-accounts.md)) both were
 * reduced to a link to /buy, and the whole component stopped being mounted
 * anywhere.
 *
 * Saved is real again: the shortlist holds up to `SHORTLIST_CAP` ids in
 * localStorage, which is exactly the list this tab always wanted. It reads
 * them, hydrates through `/api/shortlist`, and hides anything already in the
 * comparison. Recently viewed still has no client-side source — nothing
 * records views since the accounts removal — so it keeps its honest empty
 * state rather than pretending.
 */
type SavedItem = {
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

export function PickerDrawer({
  requestedIds = [],
  children,
}: {
  /** Ids already in the comparison — excluded from Saved, and the base the
   *  picked id is appended to. */
  requestedIds?: string[];
  /** Trigger override. The default is a full-size dashed panel meant to *be*
   *  the empty slot; a caller that already draws its own dashed card passes
   *  something compact so the two don't nest. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("tools");
  const { prefs } = usePreferences();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"saved" | "recent" | "search">("saved");
  const [saved, setSaved] = useState<SavedItem[] | null>(null);

  // Lazy: only read localStorage and hit the API once the drawer is actually
  // open. `saved === null` means "not fetched yet" and drives the loading
  // line, which is why this doesn't initialise to [].
  useEffect(() => {
    if (!open) return;
    const ids = loadCompareIds();
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/shortlist?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items: SavedItem[] }) => {
        if (!cancelled) setSaved(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setSaved([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Anything already on the table is not worth offering again.
  const candidates = (saved ?? []).filter(
    (item) => !requestedIds.includes(item.id),
  );
  const slotsLeft = COMPARE_CAP - requestedIds.length;

  /** Appending to the URL is the whole interaction — the page reads `ids`. */
  function hrefWith(id: string): string {
    const next = [...requestedIds, id].slice(0, COMPARE_CAP);
    return `/tools/compare?ids=${encodeURIComponent(next.join(","))}`;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children ?? (
          <button
            type="button"
            className="inline-flex items-center justify-center w-full h-full min-h-[180px] rounded-lg border-2 border-dashed border-bz-border bg-bz-surface text-bz-muted hover:border-bz-border-strong hover:text-bz-ink-2 transition-colors"
          >
            <div className="text-center">
              <Plus size={20} strokeWidth={1.5} className="mx-auto mb-1.5" />
              <span className="text-[12.5px]">{t("picker.addToCompare")}</span>
            </div>
          </button>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="data-[side=right]:w-full sm:w-[400px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{t("picker.addToCompare")}</SheetTitle>
        </SheetHeader>

        <div className="px-6 pt-2">
          <div
            role="tablist"
            aria-label={t("picker.source")}
            className="border-b border-bz-border flex gap-4"
          >
            <TabBtn active={tab === "saved"} onClick={() => setTab("saved")}>
              <Heart size={12} strokeWidth={1.7} />
              {t("picker.tabSaved")}
              {candidates.length > 0 ? (
                <span className="mono text-[10.5px] text-bz-muted">
                  {candidates.length}
                </span>
              ) : null}
            </TabBtn>
            <TabBtn active={tab === "recent"} onClick={() => setTab("recent")}>
              <Clock size={12} strokeWidth={1.7} />
              {t("picker.tabRecent")}
            </TabBtn>
            <TabBtn active={tab === "search"} onClick={() => setTab("search")}>
              <Search size={12} strokeWidth={1.7} />
              {t("picker.tabSearch")}
            </TabBtn>
          </div>

          <div className="mt-6">
            {tab === "saved" ? (
              saved === null ? (
                <p className="py-10 text-center text-[12.5px] text-bz-ink-2 italic">
                  {t("picker.loading")}
                </p>
              ) : candidates.length === 0 ? (
                <EmptyPanel
                  title={t(
                    (saved?.length ?? 0) > 0
                      ? "picker.allHereTitle"
                      : "picker.noneTitle",
                  )}
                  body={t(
                    (saved?.length ?? 0) > 0
                      ? "picker.allHereBody"
                      : "picker.noneBody",
                  )}
                  href="/buy"
                  cta={t("picker.browseListings")}
                />
              ) : (
                <>
                  <p className="text-[11.5px] text-bz-muted">
                    {t("picker.slotsLeft", { count: slotsLeft })}{" "}
                    {t("picker.pickOne")}
                  </p>
                  <ul className="mt-3 flex flex-col divide-y divide-bz-border">
                    {candidates.map((item) => (
                      <li key={item.id}>
                        {/* Plain <a>, deliberately not next/link: a
                            client-side navigation on this route leaves the
                            re-rendered slot grid without its client
                            components, so the *next* empty slot would come
                            back with a dead picker and the visitor would
                            have to reload to add a fourth. The same thing
                            happens through the pre-existing per-card remove
                            control, so it's the route rather than this
                            drawer — see the hydration-error entry in
                            docs/FOLLOWUPS.md. A full load is cheap here
                            (the page is already `force-dynamic`) and is
                            correct regardless of how that's resolved. */}
                        <a
                          href={hrefWith(item.id)}
                          className="flex gap-3 py-3 group"
                        >
                          <span className="relative w-16 h-16 rounded-md overflow-hidden bg-bz-surface-2 shrink-0 block">
                            {item.hero_url ? (
                              <Image
                                src={item.hero_url}
                                alt={item.hero_alt ?? item.title}
                                fill
                                sizes="64px"
                                className="object-cover"
                              />
                            ) : null}
                          </span>
                          <span className="flex-1 min-w-0 block">
                            <span className="block text-[13px] font-medium text-bz-ink truncate group-hover:text-bz-accent transition-colors">
                              {item.title}
                            </span>
                            <span className="block text-[11.5px] text-bz-ink-2 mt-0.5 truncate">
                              {item.area_name ?? t("picker.fallbackArea")}
                            </span>
                            <span className="mt-1 flex items-baseline justify-between gap-2">
                              <span className="mono text-[12px] text-bz-ink">
                                {formatPrice(item.price_aed, prefs)}
                              </span>
                              <span className="text-[11px] text-bz-ink-2">
                                {t("picker.bedsBaths", {
                                  beds: item.beds,
                                  baths: item.baths,
                                })}
                              </span>
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )
            ) : tab === "recent" ? (
              <EmptyPanel
                title={t("picker.recentTitle")}
                body={t("picker.recentBody")}
                href="/buy"
                cta={t("picker.browseListings")}
              />
            ) : (
              <EmptyPanel
                title={t("picker.searchTitle")}
                body={t("picker.searchBody")}
                href="/buy"
                cta={t("picker.openSearch")}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "py-2 inline-flex items-center gap-1.5 text-[12.5px] border-b-2 border-bz-teal text-bz-teal -mb-px"
          : "py-2 inline-flex items-center gap-1.5 text-[12.5px] border-b-2 border-transparent text-bz-muted hover:text-bz-ink-2 -mb-px"
      }
    >
      {children}
    </button>
  );
}

function EmptyPanel({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="py-10 text-center max-w-[36ch] mx-auto">
      <p className="text-[14px] text-bz-ink-2 font-medium">{title}</p>
      <p className="mt-2 text-[12.5px] text-bz-muted leading-relaxed">
        {body}
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
