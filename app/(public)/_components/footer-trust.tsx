import { Star } from "lucide-react";
import { DLD_BROKER_PERMIT, getGoogleReviewsSnapshot } from "@/lib/queries/trust";

/**
 * T1.5 quick win: single-line trust strip above the global footer.
 *
 * Lighter than the home page's `<TrustStrip>` — just the Google rating
 * badge + DLD broker permit number, surfaced on every public page via the
 * (public)/layout. Wraps the locked `PublicFooter` from outside rather
 * than editing it.
 */
export async function FooterTrust() {
  const reviews = await getGoogleReviewsSnapshot();
  const stars = Math.round(reviews.rating);

  return (
    <section
      aria-label="Trust signals"
      className="px-12 py-5 border-t border-bz-border bg-bz-surface-2 flex items-center justify-between gap-6 flex-wrap"
    >
      <a
        href={reviews.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 group"
      >
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={12}
              strokeWidth={0}
              fill={
                i < stars
                  ? "var(--bz-accent, #4B5A4C)"
                  : "var(--bz-border)"
              }
            />
          ))}
        </span>
        <span className="text-[12.5px] text-bz-ink-2 group-hover:text-bz-ink transition-colors">
          {reviews.rating.toFixed(1)} on {reviews.platform}
          {" · "}
          <span className="text-bz-ink-2">
            {reviews.count} review{reviews.count === 1 ? "" : "s"}
          </span>
        </span>
      </a>
      <div className="text-[11.5px] text-bz-ink-2">
        DLD broker permit ·{" "}
        <span className="mono text-bz-ink">{DLD_BROKER_PERMIT}</span>
      </div>
    </section>
  );
}
