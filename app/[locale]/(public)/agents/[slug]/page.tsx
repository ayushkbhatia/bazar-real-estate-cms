import { DEFAULT_LOCALE, asLocale, type Locale } from "@/lib/i18n/locales";
import { localeDateTag } from "@/lib/i18n/dates";
import { setRequestLocale } from "next-intl/server";
import * as React from "react";
import { getCardLabelResolver } from "@/lib/queries/card-labels";
import Image from "next/image";
import Link from "@/components/i18n/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Mail, MessageCircle, Phone, Star } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { getAgentBySlug, listAgents } from "@/lib/queries/agents";
import { listApprovedReviewsForAgent } from "@/lib/queries/reviews-by-subject";
import { listListingsByAgent } from "@/lib/queries/listings-by-agent";
import { propertyUrl } from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { realEstateAgentJsonLd, breadcrumbListJsonLd } from "@/lib/jsonld";
import { env } from "@/lib/env";
import { getAgentPageContent } from "@/lib/queries/subpages";
import { agentTokens, getAgentPageCopy } from "@/lib/queries/agent-page";
import { ListingCardPriced } from "../../_components/listing-card-priced";

export async function generateStaticParams() {
  // Pre-render every agent the DB exposes today; runtime requests for
  // newly-added slugs still server-render on demand.
  //
  // The locale is passed explicitly, as listAgents' own signature asks. Left
  // off, it resolves the ambient one — a dynamic API with no request behind
  // it here, which throws into the helper's catch and yields an empty roster.
  // Empty is indistinguishable from "no agents", so the route prerenders
  // nothing and every profile silently loses its CDN caching. Slugs do not
  // differ by locale, so the choice of locale only decides which twin of the
  // narrative fields is folded — none of which this function reads.
  const agents = await listAgents(DEFAULT_LOCALE);
  return agents.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: Locale }>;
}): Promise<Metadata> {
  const { slug, locale: raw } = await params;
  const locale = asLocale(raw);
  const agent = await getAgentBySlug(slug, locale);
  if (!agent) return { title: "Advisor not found" };
  // The fallback after the dash is the shared profile copy's, so an advisor
  // with no title reads the same in the tab as above their name.
  const copy = await getAgentPageCopy(agentTokens(agent.display_name), locale);
  return {
    title: `${agent.display_name} — ${agent.title ?? copy("hero", "title_fallback")}`,
    description: agent.bio ?? undefined,
  };
}

/*
 * The profile reads the CMS now — the shared copy and this advisor's own
 * document — so it takes the interval its sibling profile pages carry
 * (/developers/[slug]). Saves still revalidate on demand; this is what heals a
 * build that could not reach the database and baked the shipped copy.
 */
export const revalidate = 300;

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ slug: string; locale: Locale }>;
}) {
  /*
   * Locale from `params`, never ambient. An ambient read falls through to
   * `headers()` and takes the route off prerendering — check:routes caught
   * five of these at once.
   */
  const { slug, locale: raw } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  // Bound once, asked per row. The words are the client's now — see
  // lib/card-labels.ts — so the two catalogue strings this used to inline are
  // gone rather than moved.
  const cardLabels = await getCardLabelResolver(locale);
  const agent = await getAgentBySlug(slug, locale);
  if (!agent) notFound();

  /*
   * Every word on this page that is not the advisor's own comes from two
   * documents: the copy every profile shares (Pages & blocks → Sub-pages →
   * Agents → Page copy) and this advisor's own, which can override any of it
   * and decides which bands show. `copy` resolves a field through both, then
   * the shipped wording, with `{name}` / `{first_name}` filled.
   */
  const page = await getAgentPageContent(
    { user_id: agent.user_id, name: agent.display_name, slug: agent.slug },
    locale,
  );
  const copy = await getAgentPageCopy(
    agentTokens(agent.display_name),
    locale,
    page.sections,
  );

  // Reviews + active listings — both keyed on the agent's user_id. Skip
  // for seed-only agents (no DB id) so the section degrades cleanly.
  const isSeedOnly = agent.user_id.startsWith("seed:");
  const [reviews, activeListings] = isSeedOnly
    ? [[], []]
    : await Promise.all([
        listApprovedReviewsForAgent(agent.user_id),
        listListingsByAgent(agent.user_id, { limit: 6 }),
      ]);

  /*
   * Contact details from the advisor's own row.
   *
   * They used to come from the matching `SEED_AGENTS` entry, with hardcoded
   * placeholders when the slug missed — and `bazar-advisor`, the only
   * publishable advisor, misses. So this page published tel:+97120000000,
   * mailto:team@bazar.ae and wa.me/971500000000 beside the real number that
   * was sitting unread in the row. Each button now renders only when its
   * detail exists.
   *
   * The stats strip's years-in-market and closed figures have no column to
   * come from at all, so they stay as the em-dashes an unmatched slug already
   * produced; closed-QTD joins them rather than claiming a confident zero.
   * The pull quote has no column either, and does not need one: it is copy,
   * shared by every profile and overridable per advisor in Pages & blocks.
   */
  const phone = agent.phone;
  const email = agent.email;
  const whatsapp = agent.whatsapp;
  const pullQuote = copy("hero", "quote");

  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        copy("hero", "whatsapp_message"),
      )}`
    : null;

  const siteBase = (
    env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae"
  ).replace(/\/+$/, "");
  const agentLd = realEstateAgentJsonLd({
    slug: agent.slug,
    display_name: agent.display_name,
    title: agent.title,
    bio: agent.bio,
    brn: agent.brn,
    photo_url: agent.photo_url,
    languages: agent.languages,
  });
  const breadcrumbsLd = breadcrumbListJsonLd([
    { name: "Home", url: siteBase },
    { name: "Our team", url: `${siteBase}/agents` },
    { name: agent.display_name, url: `${siteBase}/agents/${agent.slug}` },
  ]);

  /*
   * The bands under the header, keyed by their section in the advisor's
   * document. The header is locked and always first; the rest render in that
   * document's order, and only while switched on — then each still drops out
   * on its own when there is nothing to put in it (no BRN, no reviews).
   */
  const bands: Record<string, React.ReactNode> = {
    /* Stats strip.

       Years-in-market, lifetime-closed and closed-QTD used to be read from the
       matching `SEED_AGENTS` entry — invented figures for invented advisors —
       and `staff` has no column for any of them, so there is nothing to put in
       those three tiles. Only the BRN, which is a real column, remains; the
       strip renders at all only when it is set. */
    credentials: agent.brn ? (
      <section
        key="credentials"
        className="border-y border-bz-border bg-bz-surface"
      >
        <div className="px-4 md:px-12 py-10 max-w-[1280px]">
          <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
            BRN
          </div>
          <div className="mono text-[20px] mt-2 text-bz-ink">{agent.brn}</div>
        </div>
      </section>
    ) : null,

    /* Specialties + languages.

       The "Areas" column is gone with the seed join that fed it: coverage was
       `SEED_AGENTS[slug].areas`, which is empty for anyone who isn't a seed,
       and `staff` has no column for it. */
    expertise: (
      <section key="expertise" className="px-4 md:px-12 py-16 max-w-[1280px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          <div>
            <Eyebrow>{copy("expertise", "specialties_eyebrow")}</Eyebrow>
            <ul className="mt-4 flex flex-col gap-2">
              {agent.specialties.map((s) => (
                <li key={s} className="text-[14px] text-bz-ink">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>{copy("expertise", "languages_eyebrow")}</Eyebrow>
            <ul className="mt-4 flex flex-col gap-2">
              {agent.languages.map((l) => (
                <li key={l} className="text-[14px] text-bz-ink">
                  · {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    ),

    reviews:
      reviews.length > 0 ? (
        <section key="reviews" className="border-t border-bz-border">
          <div className="px-4 md:px-12 py-16 max-w-[1280px]">
            <Eyebrow>{copy("reviews", "eyebrow")}</Eyebrow>
            <h2
              className="serif text-[32px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              {copy("reviews", "heading")}
            </h2>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {reviews.map((r) => (
                <figure
                  key={r.id}
                  className="rounded-md border border-bz-border bg-bz-surface p-6 flex flex-col gap-4"
                >
                  <div className="flex items-center gap-1 text-bz-accent">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star
                        key={i}
                        size={13}
                        strokeWidth={1.5}
                        fill="currentColor"
                      />
                    ))}
                  </div>
                  {r.title ? (
                    <div
                      className="serif text-[18px] leading-snug text-bz-ink"
                      style={{ letterSpacing: "-0.012em" }}
                    >
                      {r.title}
                    </div>
                  ) : null}
                  {r.body ? (
                    <blockquote className="text-[14px] text-bz-ink-2 leading-relaxed">
                      {r.body}
                    </blockquote>
                  ) : null}
                  <figcaption className="mt-auto pt-2 text-[12.5px] text-bz-muted">
                    {r.author_name ?? "Bazar client"} ·{" "}
                    <span className="mono">
                      {new Date(r.created_at).toLocaleDateString(
                        localeDateTag(locale),
                        { year: "numeric", month: "short" },
                      )}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null,

    listings: (
      <section
        key="listings"
        className="border-t border-bz-border bg-bz-surface"
      >
        <div className="px-4 md:px-12 py-16 max-w-[1280px]">
          <Eyebrow>{copy("listings", "eyebrow")}</Eyebrow>
          <h2
            className="serif text-[32px] mt-2 leading-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            {copy("listings", "heading")}
          </h2>
          {activeListings.length === 0 ? (
            <div className="mt-8 py-12 text-center text-[14px] text-bz-muted border border-dashed border-bz-border rounded-md">
              {copy("listings", "empty")}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeListings.map((row, index) => {
                const badges = cardLabels(row.flags);
                return (
                  <Link
                    key={row.reference}
                    href={propertyUrl(row)}
                    className="block"
                  >
                    <ListingCardPriced
                      priceAed={row.price_aed}
                      title={row.title}
                      location={row.areas?.name ?? "United Arab Emirates"}
                      beds={row.beds}
                      baths={row.baths}
                      area={row.built_up_ft2 ?? 0}
                      badges={badges}
                      imgLabel={row.reference}
                      heroSrc={
                        row.hero ? mediaPublicUrl(row.hero.storage_key) : null
                      }
                      heroAlt={row.hero?.alt_text ?? row.title}
                      priority={index === 0}
                      propertyId={row.id}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    ),

    cta: (
      <section key="cta" className="px-4 md:px-12 py-16 max-w-[1280px]">
        <div className="bg-bz-accent text-bz-accent-fg rounded-lg p-6 md:p-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <Eyebrow className="text-bz-accent-fg/70">
              {copy("cta", "eyebrow")}
            </Eyebrow>
            <h3
              className="serif text-[28px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.012em" }}
            >
              {copy("cta", "heading")}
            </h3>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">{copy("cta", "cta_label")}</Link>
          </Button>
        </div>
      </section>
    ),
  };

  return (
    <div className="bg-bz-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(agentLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsLd) }}
      />
      {/* Crumb */}
      <div className="px-4 md:px-12 pt-10 max-w-[1280px]">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-teal hover:text-bz-navy transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          {copy("hero", "back_label")}
        </Link>
      </div>

      {/* Hero */}
      <section className="px-4 md:px-12 pt-8 pb-14 max-w-[1280px]">
        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-8 md:gap-16 items-start">
          {/* The one image on this page that must not be lazy: `grid-cols-1`
              below md puts the portrait first and full-bleed, which makes it
              the LCP element on a phone. The slot is the fixed 360px track
              from md up, and the section's content width (viewport minus the
              two 16px gutters) below it — not 100vw, which would still hand
              a 390px phone the same crop as a 1440px laptop. */}
          {agent.photo_url ? (
            <div className="relative w-full aspect-[4/5] rounded-md overflow-hidden">
              <Image
                src={agent.photo_url}
                alt={agent.display_name}
                fill
                priority
                sizes="(min-width: 768px) 360px, calc(100vw - 32px)"
                className="object-cover"
              />
            </div>
          ) : (
            <PlaceholderImage
              label={agent.slug}
              className="w-full aspect-[4/5] rounded-md"
            />
          )}
          <div>
            <Eyebrow>{agent.title ?? copy("hero", "title_fallback")}</Eyebrow>
            <h1
              className="serif text-[32px] md:text-[56px] mt-3 font-normal leading-[1.02] max-w-[16ch]"
              style={{ letterSpacing: "-0.025em" }}
            >
              {agent.display_name}
            </h1>
            {agent.bio ? (
              <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
                {agent.bio}
              </p>
            ) : null}
            <blockquote
              className="serif italic text-[20px] mt-8 ps-5 border-s-2 border-bz-accent text-bz-ink leading-relaxed max-w-[56ch]"
              style={{ letterSpacing: "-0.005em" }}
            >
              &ldquo;{pullQuote}&rdquo;
            </blockquote>

            {/* Contact actions */}
            <div className="mt-8 flex flex-wrap gap-3">
              {phone ? (
                <Button asChild>
                  <a href={`tel:${phone.replace(/\s/g, "")}`}>
                    <Phone size={14} strokeWidth={1.7} />
                    {copy("hero", "call_label")}
                  </a>
                </Button>
              ) : null}
              {waUrl ? (
                <Button asChild variant="outline">
                  <a href={waUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={14} strokeWidth={1.7} />
                    {copy("hero", "whatsapp_label")}
                  </a>
                </Button>
              ) : null}
              {email ? (
                <Button asChild variant="ghost">
                  <a href={`mailto:${email}`}>
                    <Mail size={14} strokeWidth={1.7} />
                    {copy("hero", "email_label")}
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {page.order.filter((key) => key !== "hero").map((key) => bands[key] ?? null)}
    </div>
  );
}
