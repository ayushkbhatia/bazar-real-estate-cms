import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Mail, MessageCircle, Phone, Star } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { getAgentBySlug, listAgents } from "@/lib/queries/agents";
import { listApprovedReviewsForAgent } from "@/lib/queries/reviews-by-subject";
import { listListingsByAgent } from "@/lib/queries/listings-by-agent";
import {
  propertyUrl,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { getSeedAgentBySlug } from "@/lib/seeds/agents";
import { getSeedAreaGuideBySlug } from "@/lib/seeds/areas";
import {
  realEstateAgentJsonLd,
  breadcrumbListJsonLd,
} from "@/lib/jsonld";
import { env } from "@/lib/env";
import { ListingCardPriced } from "../../_components/listing-card-priced";

export async function generateStaticParams() {
  // Pre-render every agent the DB exposes today; runtime requests for
  // newly-added slugs still server-render on demand.
  const agents = await listAgents();
  return agents.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  if (!agent) return { title: "Advisor not found" };
  return {
    title: `${agent.display_name} — ${agent.title ?? "Advisor"}`,
    description: agent.bio ?? undefined,
  };
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();

  // Reviews + active listings — both keyed on the agent's user_id. Skip
  // for seed-only agents (no DB id) so the section degrades cleanly.
  const isSeedOnly = agent.user_id.startsWith("seed:");
  const [reviews, activeListings] = isSeedOnly
    ? [[], []]
    : await Promise.all([
        listApprovedReviewsForAgent(agent.user_id),
        listListingsByAgent(agent.user_id, { limit: 6 }),
      ]);

  // Stats + contact metadata that the DB schema doesn't yet expose
  // continue to come from the matching seed entry. When the field is
  // missing (a real DB agent not in seeds) we surface neutral defaults.
  const supplementary = getSeedAgentBySlug(slug);
  const phone = supplementary?.phone ?? "+971 2 000 0000";
  const email = supplementary?.email ?? "team@bazar.ae";
  const whatsapp = supplementary?.whatsapp ?? "+971500000000";
  const yearsInMarket = supplementary?.years_in_market ?? null;
  const closedLifetime = supplementary?.closed_aed_lifetime ?? "—";
  const closedQtd = supplementary?.closed_qtd ?? 0;
  const pullQuote =
    supplementary?.pull_quote ??
    `${agent.display_name.split(" ")[0]} works the full advisory cycle end to end.`;
  const areaSlugs = supplementary?.areas ?? [];
  const areas = areaSlugs
    .map((a) => getSeedAreaGuideBySlug(a))
    .filter((a) => a != null);

  const waUrl = `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hi ${agent.display_name.split(" ")[0]}, I'd like to talk about a Bazar engagement.`,
  )}`;

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
          Our team
        </Link>
      </div>

      {/* Hero */}
      <section className="px-4 md:px-12 pt-8 pb-14 max-w-[1280px]">
        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-8 md:gap-16 items-start">
          {agent.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.photo_url}
              alt={agent.display_name}
              className="w-full aspect-[4/5] rounded-md object-cover"
            />
          ) : (
            <PlaceholderImage
              label={agent.slug}
              className="w-full aspect-[4/5] rounded-md"
            />
          )}
          <div>
            <Eyebrow>{agent.title ?? "Advisor"}</Eyebrow>
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
              <Button asChild>
                <a href={`tel:${phone.replace(/\s/g, "")}`}>
                  <Phone size={14} strokeWidth={1.7} />
                  Call
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} strokeWidth={1.7} />
                  WhatsApp
                </a>
              </Button>
              <Button asChild variant="ghost">
                <a href={`mailto:${email}`}>
                  <Mail size={14} strokeWidth={1.7} />
                  Email
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-bz-border bg-bz-surface">
        <div className="px-4 md:px-12 py-10 max-w-[1280px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Years in market
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {yearsInMarket ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                BRN
              </div>
              <div className="mono text-[20px] mt-2 text-bz-ink">
                {agent.brn ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Closed lifetime
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {closedLifetime}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Closed QTD
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {closedQtd}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specialties + languages + areas */}
      <section className="px-4 md:px-12 py-16 max-w-[1280px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10">
          <div>
            <Eyebrow>Specialties</Eyebrow>
            <ul className="mt-4 flex flex-col gap-2">
              {agent.specialties.map((s) => (
                <li key={s} className="text-[14px] text-bz-ink">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Languages</Eyebrow>
            <ul className="mt-4 flex flex-col gap-2">
              {agent.languages.map((l) => (
                <li key={l} className="text-[14px] text-bz-ink">
                  · {l}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Areas</Eyebrow>
            <ul className="mt-4 flex flex-col gap-2">
              {areas.map((a) =>
                a ? (
                  <li key={a.slug}>
                    <Link
                      href={`/areas/${a.slug}`}
                      className="text-[14px] text-bz-ink hover:text-bz-accent transition-colors"
                    >
                      · {a.name}
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 ? (
        <section className="border-t border-bz-border">
          <div className="px-4 md:px-12 py-16 max-w-[1280px]">
            <Eyebrow>What clients say</Eyebrow>
            <h2
              className="serif text-[32px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              Working with {agent.display_name.split(" ")[0]}.
            </h2>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {reviews.map((r) => (
                <figure
                  key={r.id}
                  className="rounded-md border border-bz-border bg-bz-surface p-6 flex flex-col gap-4"
                >
                  <div className="flex items-center gap-1 text-bz-accent">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} size={13} strokeWidth={1.5} fill="currentColor" />
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
                      {new Date(r.created_at).toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "short",
                      })}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Active listings */}
      <section className="border-t border-bz-border bg-bz-surface">
        <div className="px-4 md:px-12 py-16 max-w-[1280px]">
          <Eyebrow>Active listings</Eyebrow>
          <h2
            className="serif text-[32px] mt-2 leading-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            What {agent.display_name.split(" ")[0]} is bringing to market.
          </h2>
          {activeListings.length === 0 ? (
            <div className="mt-8 py-12 text-center text-[14px] text-bz-muted border border-dashed border-bz-border rounded-md">
              No public listings on the desk this week. Open a brief to discuss
              what {agent.display_name.split(" ")[0]} is working on off-market.
            </div>
          ) : (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeListings.map((row, index) => {
                  const badge = row.flags?.exclusive
                    ? { label: "Exclusive", kind: "ink" as const }
                    : row.flags?.vacant_on_transfer
                    ? { label: "Vacant on transfer", kind: "accent" as const }
                    : undefined;
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
                        badge={badge?.label}
                        badgeKind={badge?.kind}
                        imgLabel={row.reference}
                        heroSrc={
                          row.hero
                            ? mediaPublicUrl(row.hero.storage_key)
                            : null
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

      {/* CTA */}
      <section className="px-4 md:px-12 py-16 max-w-[1280px]">
        <div className="bg-bz-accent text-bz-accent-fg rounded-lg p-6 md:p-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <Eyebrow className="text-bz-accent-fg/70">Get in touch</Eyebrow>
            <h3
              className="serif text-[28px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.012em" }}
            >
              Work with {agent.display_name.split(" ")[0]}.
            </h3>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">Send a brief</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
