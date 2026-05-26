import { Quote } from "lucide-react";
import { SEED_TESTIMONIALS } from "@/lib/seeds/awards";

/**
 * Client testimonials section — usable on home (subset) and /about (full).
 * Voice-led, editorial. Three quotes is the soft cap; more than that the
 * section starts to feel performative.
 *
 * Contrast note: the section uses `bg-bz-surface-2`, which the `.eyebrow`
 * default text colour (`text-bz-muted`) fails WCAG-AA against. We render
 * the eyebrow inline with `text-bz-ink-2` here rather than the shared
 * `<Eyebrow>` component so the home-page axe gate stays green.
 */
export function ClientWords({ limit = 3 }: { limit?: number }) {
  const items = SEED_TESTIMONIALS.slice(0, limit);
  return (
    <section className="px-12 py-16 border-t border-bz-border bg-bz-surface-2">
      <div className="text-[11px] font-medium uppercase text-bz-ink-2" style={{ letterSpacing: "0.12em" }}>
        Client words
      </div>
      <h2
        className="serif text-[36px] mt-2 leading-tight max-w-[24ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        Three things people tell us.
      </h2>
      <ul className="mt-9 grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map((t) => (
          <li
            key={t.id}
            className="rounded-lg border border-bz-border bg-bz-surface p-6 flex flex-col gap-4 h-full"
          >
            <Quote
              size={20}
              strokeWidth={1.4}
              className="text-bz-muted"
              aria-hidden="true"
            />
            <p className="text-[15.5px] text-bz-ink leading-[1.7] flex-1">
              {t.quote}
            </p>
            <div className="pt-3 border-t border-bz-border">
              <div className="text-[12.5px] font-medium text-bz-ink-2">
                {t.attribution}
              </div>
              {t.context ? (
                <div className="text-[11.5px] text-bz-muted mt-0.5">
                  {t.context}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
