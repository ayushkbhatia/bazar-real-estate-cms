import Image from "next/image";
import Link from "@/components/i18n/link";
import { ArrowUpRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listAgents } from "@/lib/queries/agents";
import { advisorOfMonth } from "@/lib/agents/desk";

/**
 * T3-A: editorial spotlight on the homepage rotating monthly through the
 * advisor roster. Pulls from the same `listAgents` source the team page
 * uses; the rotation is deterministic per ISO month so the spotlight
 * stays stable for the whole calendar month.
 *
 * Falls back to the first non-leadership advisor if the rotation function
 * returns null (empty roster).
 */
export async function AdvisorOfMonth() {
  const agents = await listAgents();
  const featured = advisorOfMonth(agents);
  if (!featured) return null;

  // Title is "Senior Advisor · Saadiyat & Yas" — the part after the bullet
  // is the practical specialism we want to surface in the spotlight.
  const focus = featured.title?.split("·")[1]?.trim();

  return (
    <section className="px-4 md:px-12 py-12 md:py-20 border-t border-bz-border">
      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-12 items-start max-w-[1200px]">
        <div className="relative aspect-[4/5] rounded-md overflow-hidden">
          {/* This section is on the home page, so the raw `<img>` here was a
              full-size Supabase original on the single most-visited route.
              `fill` reproduces the `absolute inset-0 w-full h-full` it
              replaced exactly; the slot is the fixed 360px grid track from md
              up and the section's content width (viewport minus the two 16px
              gutters) below that. Deliberately not `priority` — the spotlight
              sits well under the hero on a phone. */}
          {featured.photo_url ? (
            <Image
              src={featured.photo_url}
              alt={featured.display_name}
              fill
              sizes="(min-width: 768px) 360px, calc(100vw - 32px)"
              className="object-cover"
            />
          ) : (
            <PlaceholderImage
              label={featured.slug}
              className="absolute inset-0 w-full h-full"
            />
          )}
        </div>
        <div>
          <Eyebrow>Advisor of the month</Eyebrow>
          <h2
            className="serif text-[28px] md:text-[44px] mt-3 leading-[1.05]"
            style={{ letterSpacing: "-0.02em" }}
          >
            {featured.display_name}
          </h2>
          {focus ? (
            <div className="mt-2 text-[14px] text-bz-ink-2">{focus}</div>
          ) : null}
          {featured.bio ? (
            <p className="mt-6 text-[15.5px] text-bz-ink-2 leading-[1.7] max-w-[58ch]">
              {featured.bio}
            </p>
          ) : null}
          {featured.specialties.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {featured.specialties.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center h-7 px-2.5 rounded-sm border border-bz-border text-[12px] text-bz-ink-2"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-8">
            <Link
              href={`/agents/${featured.slug}`}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-bz-accent text-bz-accent-fg text-[13.5px] hover:bg-bz-accent-hover transition-colors"
            >
              Read the full profile
              <ArrowUpRight size={14} strokeWidth={1.7} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
