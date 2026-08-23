import { Eyebrow } from "@/components/brand/eyebrow";
import { SEED_TESTIMONIALS, type Testimonial } from "@/lib/seeds/awards";
import { TESTIMONIALS_MAX } from "@/lib/master-pages/library";
import { TestimonialCarousel } from "./testimonial-carousel";
import type { SectionCopy } from "./section-copy";

/**
 * How many reviews a caller should fetch when it has not decided yet.
 *
 * This used to be 3 and was the *display* cap as well — the section sliced the
 * list itself, so a fourth review could be typed into the CMS and would never
 * appear anywhere. It is now the ceiling of the list rather than an opinion
 * about the layout: the carousel shows however many it is handed, and the page
 * placing it decides the count (`/admin/pages/master/home` → Testimonials, or
 * the block's "How many to show" on a landing page).
 */
export const HOME_TESTIMONIAL_COUNT = TESTIMONIALS_MAX;

/**
 * Home "Testimonials" (handoff §8). The section header plus the review
 * carousel — see `TestimonialCarousel` for why the three-up grid went.
 *
 * `items` comes from the section library (`/admin/pages/sub/section/testimonials`),
 * already folded to the request's locale by `resolveSections`, so this component
 * never learns Arabic exists. `SEED_TESTIMONIALS` stays as the fallback for a
 * caller that passes nothing — the same relationship every other section here
 * has with the literals it ships with.
 */
export function HomeTestimonials({
  eyebrow = "Testimonials",
  heading = "Reviews and comments",
  items,
  limit,
}: SectionCopy & { items?: Testimonial[]; limit?: number } = {}) {
  const all = items ?? SEED_TESTIMONIALS;
  // `limit` is what the placing page asked for; undefined means "all of them",
  // which is the point of the carousel. Clamped to the list's own ceiling so a
  // stale stored value can never ask for more than can exist.
  const reviews =
    typeof limit === "number" && limit > 0
      ? all.slice(0, Math.min(limit, TESTIMONIALS_MAX))
      : all;
  if (reviews.length === 0) return null;

  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      <div className="mb-8 md:mb-11">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="serif mt-2 text-[28px] md:text-[44px] font-normal leading-[1.05] tracking-tight">
          {heading}
        </h2>
      </div>

      <TestimonialCarousel items={reviews} />
    </section>
  );
}
