import { Star } from "lucide-react";
import { DLD_BROKER_PERMIT, getGoogleReviewsSnapshot } from "@/lib/queries/trust";
import { SEED_PRESS_LOGOS } from "@/lib/seeds/awards";

/**
 * Editorial trust strip surfaced on the home page (between the market stats
 * band and featured listings) and reused at the top of /about.
 *
 * Bazar's boutique voice argues for fewer, sharper trust signals — Google
 * rating, DLD broker permit, three press mentions. We deliberately stop
 * short of the half-dozen-badge stack Metropolitan uses.
 *
 * Contrast notes: every text colour here is calibrated to ≥ 4.5:1 against
 * the `bg-bz-surface-2` background (CI's axe-core gate enforces WCAG 2.1 AA).
 * That means `text-bz-ink-2` for low-emphasis labels, never `text-bz-muted`
 * on this surface, and no opacity dampers on the press logos.
 */
export async function TrustStrip() {
  const reviews = await getGoogleReviewsSnapshot();
  const stars = Math.round(reviews.rating);
  return (
    <section className="px-4 md:px-12 py-9 border-y border-bz-border bg-bz-surface-2">
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-10">
        {/* Google reviews */}
        <a
          href={reviews.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 group"
        >
          <div className="flex items-center gap-0.5" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
                strokeWidth={0}
                fill={i < stars ? "var(--bz-accent, #005777)" : "var(--bz-border)"}
              />
            ))}
          </div>
          <div>
            <div className="text-[14px] font-medium text-bz-ink">
              {reviews.rating.toFixed(1)} on {reviews.platform}
              <span className="text-bz-ink-2 font-normal">
                {" "}· {reviews.count} reviews
              </span>
            </div>
            <div className="text-[11.5px] text-bz-ink-2 group-hover:text-bz-ink transition-colors">
              Read every review →
            </div>
          </div>
        </a>

        {/* Press logos — serif wordmark fallback until real assets land.
            Kept at full opacity so the WCAG-AA contrast check passes. */}
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 md:justify-self-center text-bz-ink-2">
          {SEED_PRESS_LOGOS.slice(0, 4).map((p) => (
            <span
              key={p.id}
              className="serif text-[15px] tracking-tight whitespace-nowrap"
              style={{ letterSpacing: "-0.01em" }}
              title={`As referenced in ${p.label}`}
            >
              {p.label}
            </span>
          ))}
        </div>

        {/* Permit */}
        <div className="md:justify-self-end md:text-end">
          <div className="text-[11px] uppercase tracking-wider text-bz-ink-2">
            DLD broker permit
          </div>
          <div className="mono text-[12.5px] text-bz-ink mt-1">
            {DLD_BROKER_PERMIT}
          </div>
        </div>
      </div>
    </section>
  );
}
