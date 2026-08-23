"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringEnum,
  useQueryStates,
} from "nuqs";
import { Download, Share2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Client toolbar for the compare page. Owns:
 *   · the "Highlight differences" toggle (URL: ?diff=0 disables)
 *   · removing a property from the comparison (URL: ?ids=…)
 *   · stub PDF / Share / Save actions (Save needs the comparisons table
 *     which lands with the Phase 4c migration)
 *
 * The server page is the source of truth for what's rendered. We just
 * mutate the URL — Next re-fetches via the dynamic page.
 */
export function CompareToolbar({
  ids,
  showDiff,
  count,
}: {
  ids: string[];
  showDiff: boolean;
  count: number;
}) {
  const t = useTranslations("tools");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useQueryStates(
    {
      ids: parseAsArrayOf(parseAsString, ",").withDefault(ids),
      // ?diff=0 means "off"; absent or anything else means "on".
      diff: parseAsStringEnum(["0", "1"]).withDefault(showDiff ? "1" : "0"),
    },
    { shallow: false, history: "replace" },
  );

  const toggleDiff = useCallback(() => {
    startTransition(() => {
      setState({ diff: showDiff ? "0" : "1" });
    });
  }, [setState, showDiff]);

  const removeId = useCallback(
    (id: string) => {
      startTransition(() => {
        const next = (state.ids ?? ids).filter((x) => x !== id);
        setState({ ids: next.length > 0 ? next : null });
      });
    },
    [ids, state.ids, setState],
  );

  const share = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: t("compare.shareTitle") });
        return;
      } catch {
        // user dismissed; fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("compare.linkCopied"));
    } catch {
      toast.error(t("compare.linkCopyFailed"));
    }
  }, [t]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Both halves are needed. The UA paints a bare checkbox at ~13px, so
          `size-5` gives the box itself something a thumb can find, and
          `min-h-11` turns the label — text included — into a 44px band around
          it; a 20px control inside a 20px label still misses. `md:size-auto`
          is width/height back to their initial value, i.e. the UA box the
          desktop toolbar draws today. */}
      <label className="flex items-center gap-2 min-h-11 md:min-h-0 text-[13px] text-bz-ink-2 me-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showDiff}
          onChange={toggleDiff}
          aria-label={t("compare.highlightDifferences")}
          data-testid="diff-toggle"
          className="size-5 md:size-auto"
        />
        {t("compare.highlightDifferences")}
      </label>
      <div className="w-px h-6 bg-bz-border mx-1" />
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (ids.length === 0) {
            toast.error(t("compare.addFirst"));
            return;
          }
          window.location.href = `/api/pdf/compare?ids=${encodeURIComponent(ids.join(","))}`;
        }}
        title={t("compare.pdfTitle")}
      >
        <Download size={14} strokeWidth={1.6} />
        {t("compare.pdf")}
      </Button>
      <Button variant="outline" size="sm" onClick={share}>
        <Share2 size={14} strokeWidth={1.6} />
        {t("compare.share")}
      </Button>
      <Button
        size="sm"
        disabled
        title={t("compare.saveTitle")}
      >
        <Save size={14} strokeWidth={1.6} />
        {t("compare.save")}
      </Button>
      {/* Hidden control surface — each card calls back into here via
          a delegated click on the X button. We render small buttons
          here so the URL stays the toolbar's responsibility. */}
      {count > 0 ? (
        <RemoveButtons ids={ids} onRemove={removeId} />
      ) : null}
      {/* router prefetch nudges so swaps feel instant */}
      <ToolbarPrefetch router={router} />
    </div>
  );
}

function RemoveButtons({
  ids,
  onRemove,
}: {
  ids: string[];
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("tools");
  // The cards live in the server component and don't know how to fire
  // events back. We render screen-reader-only buttons positioned absolutely
  // *inside* each card via a global selector. That hidden-button approach
  // would couple too tightly to the DOM, so we instead surface them as a
  // small "Remove" menu in the toolbar — keyboard users still have access.
  return (
    <details className="relative">
      <summary
        /* A <summary> is the disclosure control, but it is not a <button>,
           <a> or role="button" — so neither the coarse-pointer floor in
           globals.css nor `e2e/mobile-geometry`'s touch-target sweep can see
           it. 36px, and it is the only way into the remove menu on a phone. */
        className="list-none cursor-pointer text-[12px] text-bz-muted hover:text-bz-ink h-11 md:h-9 px-2 inline-flex items-center"
        aria-label={t("compare.removeMenuAria")}
      >
        {t("compare.removeMenu")}
      </summary>
      <div className="absolute end-0 top-full mt-1 z-10 bg-bz-surface border border-bz-border rounded shadow-lg p-2 min-w-[180px] flex flex-col gap-1">
        {ids.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => onRemove(id)}
            data-testid={`remove-${i}`}
            /* ~27px rows (py-1.5 around a 12.5px line) stacked 4px apart in a
               menu whose every entry drops a property from the comparison.
               The sweep never reports these — they only exist while the
               <details> is open — but a thumb still has to hit one. */
            className="text-start text-[12.5px] px-2.5 py-1.5 min-h-11 md:min-h-0 rounded hover:bg-bz-surface-2 inline-flex items-center justify-between gap-2"
          >
            <span className="truncate mono">{id.slice(0, 8)}…</span>
            <X size={12} strokeWidth={1.8} className="text-bz-muted" />
          </button>
        ))}
      </div>
    </details>
  );
}

function ToolbarPrefetch({
  router,
}: {
  router: ReturnType<typeof useRouter>;
}) {
  // Reserved for hover-prefetch of related comparisons. Intentionally a no-op
  // for v1 — keeping the hook in place so adding it later doesn't change the
  // component shape.
  void router;
  return null;
}
