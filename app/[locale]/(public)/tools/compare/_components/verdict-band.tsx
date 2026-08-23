import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { SEED_AGENTS } from "@/lib/seeds/agents";

/**
 * Sprint 5b: "Advisor's verdict" dark band on the compare page. A
 * qualitative judgment beside the numbers — design's centrepiece.
 *
 * Sprint 9 wires this to a real `comparisons.verdict_text` field set by
 * the advisor when the user asks for a recommendation. For now it
 * surfaces a static editorial block plus a CTA to escalate.
 */
export async function VerdictBand({
  references,
  locale,
}: {
  references: string[];
  locale: string;
}) {
  if (references.length < 2) return null;
  const advisor = SEED_AGENTS[0];
  // Locale threaded from the page rather than read ambiently: this renders
  // inside a route with `dynamic = "force-dynamic"` today, but an ambient
  // `getTranslations()` here would keep it that way for the wrong reason.
  const t = await getTranslations({ locale, namespace: "tools" });

  return (
    <section className="bg-bz-ink text-white rounded-lg overflow-hidden">
      {/*
        The portrait track was 180px at every width, and `1fr` is
        `minmax(auto, 1fr)` — its floor is the quote's min-content, not zero.
        At 390px the row wanted 180 + 32 + ~105px of longest-word inside a
        294px content box, so the text column sat at ~105px and the surplus
        ran off the right edge, where the section's own `overflow-hidden`
        sliced the pull-quote through the middle of a word. Stacking below
        `md` gives the quote the full column; `[&>*]:min-w-0` drops the track
        floor so the same squeeze can't reappear at the narrow end of `md`.
      */}
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-8 items-center px-8 py-8 [&>*]:min-w-0">
        <PlaceholderImage
          label={advisor.slug}
          dark
          className="w-[140px] h-[170px] rounded-md"
        />
        <div>
          <Eyebrow className="text-white/60">
            {t("compare.verdictEyebrow", { advisor: advisor.display_name })}
          </Eyebrow>
          {/*
            The reference used to sit in its own `.mono` span mid-sentence,
            which made the quotation three JSX children and pinned the
            reference to a position English chose. One message, one
            placeholder — the mono face is the cost, and a reference is
            already Latin and already reads left-to-right.
          */}
          <p
            className="serif italic text-[22px] mt-3 leading-relaxed max-w-[68ch]"
            style={{ letterSpacing: "-0.005em" }}
          >
            {t("compare.verdictBody", {
              count: references.length,
              reference: references[0]!,
            })}
          </p>
          <p className="mt-4 text-[12.5px] text-white/60">
            {t("compare.verdictNote")}
          </p>
        </div>
      </div>
    </section>
  );
}
