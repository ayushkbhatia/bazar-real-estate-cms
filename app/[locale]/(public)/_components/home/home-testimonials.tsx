import { Star } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { CarouselGrid } from "@/components/brand/mobile";
import { SEED_TESTIMONIALS } from "@/lib/seeds/awards";
import type { SectionCopy } from "./section-copy";

/**
 * Home "Testimonials" (handoff §8). Three review cards fed by the curated
 * SEED_TESTIMONIALS. Desktop 3-up grid, mobile snap carousel.
 */
function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function HomeTestimonials({
  eyebrow = "Testimonials",
  heading = "Reviews and comments",
}: SectionCopy = {}) {
  const reviews = SEED_TESTIMONIALS.slice(0, 3);
  if (reviews.length === 0) return null;

  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      <div className="mb-8 md:mb-11">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="serif mt-2 text-[28px] md:text-[44px] font-normal leading-[1.05] tracking-tight">
          {heading}
        </h2>
      </div>

      <CarouselGrid cols={3} itemWidth="85%">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="flex h-full flex-col rounded-lg border border-bz-border bg-bz-surface p-7"
          >
            <div
              className="flex gap-1 text-bz-accent"
              role="img"
              aria-label="Rated 5 out of 5 stars"
            >
              {[0, 1, 2, 3, 4].map((s) => (
                <Star key={s} size={16} fill="currentColor" strokeWidth={0} />
              ))}
            </div>
            <p
              className="serif mt-5 flex-1 text-[18px] md:text-[20px] leading-[1.4] tracking-tight"
              style={{ letterSpacing: "-0.01em" }}
            >
              &ldquo;{r.quote}&rdquo;
            </p>
            <div className="mt-7 flex items-center gap-3 border-t border-bz-border pt-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bz-surface-3 text-[13px] font-medium text-bz-ink">
                {initialsOf(r.attribution)}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-bz-ink-2">
                  {r.attribution}
                </div>
                {r.context ? (
                  <div className="text-[11.5px] text-bz-muted">{r.context}</div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </CarouselGrid>
    </section>
  );
}
