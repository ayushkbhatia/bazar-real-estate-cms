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
export function VerdictBand({ references }: { references: string[] }) {
  if (references.length < 2) return null;
  const advisor = SEED_AGENTS[0];

  return (
    <section className="bg-bz-ink text-white rounded-lg overflow-hidden">
      <div className="grid grid-cols-[180px_1fr] gap-8 items-center px-8 py-8">
        <PlaceholderImage
          label={advisor.slug}
          dark
          className="w-[140px] h-[170px] rounded-md"
        />
        <div>
          <Eyebrow className="text-white/60">{advisor.display_name}&apos;s verdict</Eyebrow>
          <p
            className="serif italic text-[22px] mt-3 leading-relaxed max-w-[68ch]"
            style={{ letterSpacing: "-0.005em" }}
          >
            &ldquo;Of these {references.length}, I&apos;d sit with{" "}
            <span className="mono not-italic">{references[0]}</span>{" "}
            first — the yield is comparable, but the building maintenance
            track record is materially better. The third option scores
            higher on view but loses on service charge.&rdquo;
          </p>
          <p className="mt-4 text-[12.5px] text-white/60">
            Sprint 9 ships an advisor-written verdict per comparison; until
            then this is a placeholder. Ask Bazar for a real one via the
            advisor card on any of the columns.
          </p>
        </div>
      </div>
    </section>
  );
}
