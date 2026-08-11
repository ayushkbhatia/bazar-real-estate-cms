import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { fluid } from "../../../_components/marketing/fluid";

/**
 * The bands an area guide is built from, downstream of the section document at
 * `subpage/area/<slug>`.
 *
 * Every band takes already-resolved copy and items — the page does the reading
 * so these stay dumb — and every band returns null when it has nothing to
 * show. That is what lets one template serve both a fully-written island guide
 * and an area someone created in the CMS ten seconds ago: the unwritten bands
 * simply don't render.
 */

/** One row of a list field, after `attachImageUrls` has run over it. */
export type BandImage = { url?: string | null; alt?: string | null } | null;

export type BandItem = {
  enabled?: boolean;
  name?: string | null;
  desc?: string | null;
  href?: string | null;
  time?: string | null;
  img?: string | null;
  image?: BandImage;
};

const SECTION = "px-4 md:px-12";

/**
 * The card grid every gallery band uses.
 *
 * Auto-fill on a 360px track rather than a breakpoint ladder, the same move
 * /insights made in #270: the card keeps its size and the column count follows
 * the viewport instead of three cards stretching across a 2560px monitor. 360px
 * puts three across at 1280–1536 — the width the design is drawn at, and where
 * these read as proper cards rather than thumbnails — then four at 1600 and
 * five at 1920. The `min(…, 100%)` guard stops a track outgrowing its container
 * on a narrow phone and pushing the grid past the viewport.
 */
export const CARD_TRACK =
  "lg:grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))]";

const CARD_GRID = `grid gap-x-6 gap-y-9 grid-cols-1 sm:grid-cols-2 ${CARD_TRACK}`;

/**
 * Matches CARD_GRID's track so `next/image` requests a sensibly sized file.
 * The track is `minmax(360px, 1fr)`, so a column stretches past 360px until
 * there is room for another — a flat `360px` here under-requests and the photo
 * renders soft in a 470px card.
 */
const CARD_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1600px) 33vw, 25vw";

/** Eyebrow + serif heading + optional intro, at the guide's rhythm. */
export function BandHead({
  eyebrow,
  heading,
  intro,
  dark,
  size = 34,
}: {
  eyebrow?: string | null;
  heading?: string | null;
  intro?: string | null;
  dark?: boolean;
  size?: number;
}) {
  if (!eyebrow && !heading && !intro) return null;
  return (
    <div>
      {eyebrow ? (
        <Eyebrow className={dark ? "text-bz-taupe-light" : undefined}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      {heading ? (
        <h2
          className={`serif mt-2 font-normal leading-tight ${
            dark ? "text-white" : "text-bz-ink"
          }`}
          style={{ fontSize: fluid(size), letterSpacing: "-0.02em" }}
        >
          {heading}
        </h2>
      ) : null}
      {intro ? (
        <p
          className={`mt-4 text-[15.5px] leading-relaxed max-w-[68ch] ${
            dark ? "text-white/75" : "text-bz-ink-2"
          }`}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

function Footnote({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p className="mt-8 text-[12.5px] text-bz-muted leading-relaxed max-w-[80ch]">
      {children}
    </p>
  );
}

// ── 3 · Property market statistics ──────────────────────────────────────

export type BandStat = { value: string; label: string };

/**
 * Headline index figures. Editorial rather than computed: an area's sale and
 * rental indices are published by third parties (Bayut, DLD) on their own
 * cadence, so they are typed into the CMS with the month they belong to
 * rather than derived from our own listing table, which would drift.
 */
export function AreaStatsBand({
  heading,
  intro,
  stats,
  footnote,
}: {
  heading?: string | null;
  intro?: string | null;
  stats: BandStat[];
  footnote?: string | null;
}) {
  if (stats.length === 0) return null;
  return (
    <section className="border-y border-bz-border bg-bz-surface">
      <div className={`${SECTION} py-12 md:py-16`}>
        <BandHead heading={heading} intro={intro} size={30} />
        <div
          className={`mt-10 grid gap-x-10 gap-y-10 grid-cols-2 ${
            stats.length % 3 === 0 ? "md:grid-cols-3" : "md:grid-cols-4"
          }`}
        >
          {stats.map((s) => (
            <div key={`${s.value}-${s.label}`} className="border-t border-bz-border pt-4">
              <div
                className="serif leading-none text-bz-ink"
                style={{ fontSize: fluid(34), letterSpacing: "-0.018em" }}
              >
                {s.value}
              </div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted mt-2.5 leading-snug">
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <Footnote>{footnote}</Footnote>
      </div>
    </section>
  );
}

// ── 5 · Landmarks & attractions ─────────────────────────────────────────

/**
 * A photo grid rather than the source document's pipe-separated line: the
 * brief calls for an image per landmark, and a landmark without one still
 * reads as a card thanks to the brand placeholder.
 */
export function AreaLandmarks({
  heading,
  intro,
  items,
  footnote,
}: {
  heading?: string | null;
  intro?: string | null;
  items: BandItem[];
  footnote?: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <section className={`${SECTION} py-14 md:py-16 border-t border-bz-border`}>
      <BandHead eyebrow="Landmarks & attractions" heading={heading} intro={intro} />
      <ul className={`mt-9 ${CARD_GRID}`}>
        {items.map((item) => {
          const body = (
            <>
              {item.image?.url ? (
                <div className="relative w-full aspect-[16/11] overflow-hidden rounded-xl">
                  <Image
                    src={item.image.url}
                    alt={item.image.alt ?? item.name ?? ""}
                    fill
                    sizes={CARD_SIZES}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </div>
              ) : (
                <PlaceholderImage
                  label={item.img ?? item.name ?? ""}
                  className="w-full aspect-[16/11] rounded-xl"
                />
              )}
              <div
                className="serif mt-3.5 leading-tight text-bz-ink group-hover:text-bz-teal transition-colors"
                style={{ fontSize: fluid(22), letterSpacing: "-0.015em" }}
              >
                {item.name}
              </div>
            </>
          );
          return (
            <li key={item.name}>
              {item.href ? (
                <Link href={item.href} className="group block">
                  {body}
                </Link>
              ) : (
                <div className="group">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <Footnote>{footnote}</Footnote>
    </section>
  );
}

// ── 6 · Communities & developments ──────────────────────────────────────

/**
 * The area's residential communities, in two passes.
 *
 * `projects` are server-rendered `DevelopmentCard`s for the published projects
 * filed under this area — the same card the /off-plan rails use, with live
 * price, bedroom and handover data behind it. They lead, because a project we
 * actually have a page for is worth more to a visitor than a name.
 *
 * `items` are the editorial community list from the CMS. Most areas name
 * communities that have no project record — Nawayef Village, Al Bandar — and
 * dropping them to make room for the cards would lose real content. The page
 * filters out any whose name matches a card above, so the band never says the
 * same thing twice.
 */
export function AreaCommunities({
  heading,
  intro,
  items,
  projects = [],
  projectsTotal = 0,
  viewAllHref,
  footnote,
}: {
  heading?: string | null;
  intro?: string | null;
  items: BandItem[];
  projects?: React.ReactNode[];
  projectsTotal?: number;
  viewAllHref?: string;
  footnote?: string | null;
}) {
  if (items.length === 0 && projects.length === 0) return null;
  return (
    <section className="border-t border-bz-border bg-bz-surface">
      <div className={`${SECTION} py-14 md:py-16`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <BandHead eyebrow="Communities" heading={heading} intro={intro} />
          {projects.length > 0 && viewAllHref ? (
            <Button asChild variant="outline">
              <Link href={viewAllHref}>
                {projectsTotal > projects.length
                  ? `View all ${projectsTotal} projects`
                  : "View all projects"}
              </Link>
            </Button>
          ) : null}
        </div>

        {projects.length > 0 ? (
          <div className={`mt-9 ${CARD_GRID}`}>
            {projects.map((card, i) => (
              <React.Fragment key={i}>{card}</React.Fragment>
            ))}
          </div>
        ) : null}

        {items.length > 0 ? (
          <>
            {projects.length > 0 ? (
              <h3 className="mt-14 text-[11px] uppercase tracking-wider text-bz-muted">
                Other communities in this area
              </h3>
            ) : null}
            <ul className={`${projects.length > 0 ? "mt-5" : "mt-9"} ${CARD_GRID}`}>
              {items.map((item) => {
                const inner = (
                  <>
                    {item.image?.url ? (
                      <div className="relative w-full aspect-[16/11] overflow-hidden rounded-xl">
                        <Image
                          src={item.image.url}
                          alt={item.image.alt ?? item.name ?? ""}
                          fill
                          sizes={CARD_SIZES}
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      </div>
                    ) : (
                      <PlaceholderImage
                        label={item.img ?? item.name ?? ""}
                        className="w-full aspect-[16/11] rounded-xl"
                      />
                    )}
                    <div
                      className="serif mt-3.5 leading-tight text-bz-ink group-hover:text-bz-teal transition-colors"
                      style={{ fontSize: fluid(22), letterSpacing: "-0.015em" }}
                    >
                      {item.name}
                    </div>
                    {item.desc ? (
                      <p className="mt-1.5 text-[13.5px] text-bz-ink-2 leading-relaxed">
                        {item.desc}
                      </p>
                    ) : null}
                  </>
                );
                return (
                  <li key={item.name}>
                    {item.href ? (
                      <Link href={item.href} className="group block">
                        {inner}
                      </Link>
                    ) : (
                      <div className="group">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
        <Footnote>{footnote}</Footnote>
      </div>
    </section>
  );
}

// ── 9 · Nearby destinations ─────────────────────────────────────────────

export function AreaNearby({
  heading,
  intro,
  items,
  footnote,
}: {
  heading?: string | null;
  intro?: string | null;
  items: BandItem[];
  footnote?: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <section className={`${SECTION} py-14 md:py-16 border-t border-bz-border`}>
      <BandHead eyebrow="Connectivity" heading={heading} intro={intro} />
      <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-16">
        {items.map((item) => {
          const row = (
            <>
              <span className="text-[15px] text-bz-ink group-hover:text-bz-teal transition-colors">
                {item.name}
              </span>
              {item.time ? (
                <span className="mono text-[12.5px] text-bz-ink-2 shrink-0">
                  {item.time}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={item.name} className="border-b border-bz-border">
              {item.href ? (
                <Link
                  href={item.href}
                  className="group flex items-baseline justify-between gap-6 py-4"
                >
                  {row}
                </Link>
              ) : (
                <div className="group flex items-baseline justify-between gap-6 py-4">
                  {row}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Footnote>{footnote}</Footnote>
    </section>
  );
}

// ── 10 · Why choose this area ───────────────────────────────────────────

export function AreaWhy({
  heading,
  intro,
  items,
}: {
  heading?: string | null;
  intro?: string | null;
  items: BandItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="bg-bz-navy text-white">
      <div className={`${SECTION} py-16 md:py-20`}>
        <BandHead eyebrow="Why here" heading={heading} intro={intro} dark size={40} />
        <ul className="mt-11 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-9">
          {items.map((item, i) => (
            <li key={item.name} className="border-t border-white/25 pt-5">
              <div className="mono text-[11.5px] text-white/45">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="serif text-[21px] mt-2 leading-snug text-white">
                {item.name}
              </div>
              {item.desc ? (
                <p className="mt-2 text-[14px] leading-relaxed text-white/70">
                  {item.desc}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── 11 · Lead generation form ───────────────────────────────────────────

/**
 * Copy on one side, the consultation form on the other. The form itself is a
 * client component passed in as `children`, so this stays a server component
 * and the guide ships one interactive island rather than a whole page of them.
 */
export function AreaLeadBand({
  heading,
  intro,
  children,
}: {
  heading: string;
  intro?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className={`${SECTION} py-14 md:py-16 border-t border-bz-border`}>
      <div className="grid overflow-hidden rounded-2xl border border-bz-border bg-bz-surface md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 p-6 md:p-11 md:border-r border-bz-border">
          <Eyebrow>Free consultation</Eyebrow>
          <h2
            className="serif mt-2 font-normal leading-tight"
            style={{ fontSize: fluid(36), letterSpacing: "-0.02em" }}
          >
            {heading}
          </h2>
          {intro ? (
            <p className="mt-4 text-[15px] text-bz-ink-2 leading-relaxed max-w-[46ch]">
              {intro}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 p-6 md:p-11">{children}</div>
      </div>
    </section>
  );
}

// ── 13 · Final CTA ──────────────────────────────────────────────────────

export function AreaFinalCta({
  heading,
  intro,
  primary,
  secondary,
}: {
  heading: string;
  intro?: string | null;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string } | null;
}) {
  return (
    <section className="border-t border-bz-border bg-bz-surface-2">
      <div className={`${SECTION} py-16 md:py-20 text-center`}>
        <h2
          className="serif font-normal leading-tight mx-auto max-w-[22ch]"
          style={{ fontSize: fluid(44), letterSpacing: "-0.025em" }}
        >
          {heading}
        </h2>
        {intro ? (
          <p className="mt-4 text-[16px] text-bz-ink-2 leading-relaxed mx-auto max-w-[56ch]">
            {intro}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Button asChild size="lg">
            <Link href={primary.href}>
              {primary.label}
              <ArrowRight size={15} strokeWidth={1.7} />
            </Link>
          </Button>
          {secondary ? (
            <Button asChild size="lg" variant="outline">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
