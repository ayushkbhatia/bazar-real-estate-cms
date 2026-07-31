import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import { HqMapCanvas } from "../contact/_components/hq-map-canvas";
import { PartnerEcosystemSection } from "../_components/partner-ecosystem-section";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { img, list, str, type ImageValue } from "@/lib/master-pages";

// Bazar HQ — Al Bateen, Abu Dhabi. Same coordinate as the /contact HQ map so
// the two location surfaces stay 1:1.
const HQ_LAT = 24.4619;
const HQ_LNG = 54.3487;
const HQ_DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${HQ_LAT},${HQ_LNG}`;

export const metadata: Metadata = {
  title: "About Bazar Real Estate",
  description:
    "A trusted name in UAE real estate since 2005 — over 20 years of trust, transparency, and proven market experience across Abu Dhabi and the wider UAE.",
  alternates: { canonical: "/about" },
};

export const revalidate = 300;

// ── code fallbacks ──────────────────────────────────────────────────────
// Kept in sync with the defaults in lib/master-pages/sections/about.ts. They
// only render when an editor has emptied the corresponding list; a list that
// has never been touched arrives populated from the registry.

const VALUES: [string, string][] = [
  ["Trust", "Transparency, reliability, and long-term confidence."],
  ["Excellence", "Premium standards across every client experience."],
  [
    "Access",
    "Strong connections with developers, banks, and industry partners.",
  ],
  ["Customer Focus", "Client satisfaction, success, and long-term value."],
  ["Innovation", "Smart solutions for evolving market needs."],
];

const EXPERTISE = [
  "Off-Plan Sales",
  "Secondary Market",
  "Listing Services",
  "Property Investment",
  "Property Management",
  "Real Estate Consulting",
  "Luxury Properties",
  "Commercial Real Estate",
  "Mortgage & Banking Guidance",
];

const PARTNERS = [
  "Aldar Properties",
  "Modon Properties",
  "Bloom Holding",
  "IMKAN Properties",
  "Reportage Properties",
  "Eagle Hills",
  "Radiant Real Estate",
  "Ohana Development",
  "Taraf",
];

const HIGHLIGHTS = [
  "Established in 2005",
  "Two decades of experience",
  "Award-winning UAE agency",
  "Strong Abu Dhabi presence",
  "Experienced local team",
  "Trusted developer relationships",
];

const STORY: { eyebrow: string; title: string; body: string }[] = [
  {
    eyebrow: "Beyond property",
    title: "A partner, not just a broker.",
    body: "At Bazar Real Estate, we go beyond property transactions. We act as a trusted partner for clients navigating Abu Dhabi and the wider UAE real estate market, combining local expertise with a modern, investor-focused approach.\n\nWith direct relationships with leading developers, financial partners, and key industry stakeholders, Bazar provides clients with the knowledge, access, and confidence needed to make informed property decisions.",
  },
  {
    eyebrow: "Our story",
    title: "Twenty years, built on the ground.",
    body: "Founded in Abu Dhabi in 2005 by Azmi Mohamdin, Bazar Real Estate was built on deep, hands-on knowledge of the local property market.\n\nOver the years, the company has grown into a trusted real estate partner, known for clear guidance, market insight, professionalism, transparency, and long-term value. Our journey reflects the growth of the UAE property sector itself — from established communities to landmark developments and emerging investment destinations.",
  },
];

const FOOTPRINT: { tag: string; name: string; desc: string; img: string }[] = [
  {
    tag: "Our home market",
    name: "Abu Dhabi",
    desc: "Abu Dhabi is our home market and core area of expertise. From prime island communities to the heart of the city, Bazar covers residential, investment, and commercial opportunities across the capital.",
    img: "abu dhabi · corniche",
  },
  {
    tag: "Selected opportunities",
    name: "Dubai & Wider UAE",
    desc: "Expanding beyond Abu Dhabi, Bazar connects clients to selected opportunities across Dubai and other key UAE markets — established communities, new developments, and investment-focused destinations.",
    img: "dubai skyline",
  },
];

// ── value readers ───────────────────────────────────────────────────────

type Item = Record<string, unknown>;

function s(item: Item, key: string): string | null {
  const v = item[key];
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function itemImage(item: Item, key = "image"): ImageValue | null {
  const v = item[key];
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as ImageValue)
    : null;
}

/** Enabled list items only — an item with no switch counts as visible. */
function enabled(items: Item[]): Item[] {
  return items.filter((i) => i.enabled !== false);
}

/** Newline-separated text as line-broken nodes. */
function Lines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </>
  );
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * A picked photo, or the striped placeholder it replaces. The ratio and the
 * rounding live on the wrapper the caller supplies, so an uploaded image of
 * any shape crops exactly where the placeholder sat.
 */
function Photo({
  image,
  label,
  className,
  sizes,
}: {
  image: ImageValue | null;
  label: string;
  className: string;
  sizes: string;
}) {
  if (image?.url) {
    return (
      <Image
        src={image.url}
        alt={image.alt ?? ""}
        fill
        sizes={sizes}
        className={`${className} object-cover`}
      />
    );
  }
  return <PlaceholderImage label={image?.label ?? label} className={className} />;
}

export default async function AboutPage() {
  const content = await getMasterPageContent("about");

  // Section copy, images and order come from /admin/pages/master/about.
  // Anything untouched falls back to the literals above.
  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const storyV = v("story");
  const missionV = v("mission");
  const valuesV = v("values");
  const footprintV = v("footprint");
  const expertiseV = v("expertise");
  const partnersV = v("partners");
  const locationV = v("location");

  const heroPhoto = img(heroV, "photo");

  const storyColumns = enabled(list<Item>(storyV, "columns"));
  const story =
    storyColumns.length > 0
      ? storyColumns.map((c) => ({
          eyebrow: s(c, "eyebrow") ?? "",
          title: s(c, "title") ?? "",
          body: s(c, "body") ?? "",
        }))
      : STORY;

  const valueItems = enabled(list<Item>(valuesV, "items"));
  const values: [string, string][] =
    valueItems.length > 0
      ? valueItems.map(
          (i) => [s(i, "name") ?? "", s(i, "desc") ?? ""] as [string, string],
        )
      : VALUES;

  const footprintCards = enabled(list<Item>(footprintV, "cards"));
  const footprint =
    footprintCards.length > 0
      ? footprintCards.map((c) => ({
          tag: s(c, "tag") ?? "",
          name: s(c, "name") ?? "",
          desc: s(c, "desc") ?? "",
          img: s(c, "img") ?? "",
          image: itemImage(c),
        }))
      : FOOTPRINT.map((c) => ({ ...c, image: null }));

  const chipItems = list<Item>(expertiseV, "chips");
  const chips =
    chipItems.length > 0
      ? chipItems.map((c) => ({ label: s(c, "label") ?? "", href: s(c, "href") }))
      : EXPERTISE.map((label) => ({ label, href: null }));

  const trackItems = list<Item>(expertiseV, "items");
  const highlights =
    trackItems.length > 0
      ? trackItems.map((i) => s(i, "label") ?? "")
      : HIGHLIGHTS;

  const partnerItems = list<Item>(partnersV, "items");
  const partners =
    partnerItems.length > 0
      ? partnerItems.map((p) => ({ label: s(p, "label") ?? "", href: s(p, "href") }))
      : PARTNERS.map((label) => ({ label, href: null }));

  const nodes: Record<string, React.ReactNode> = {
    /* Hero — text left, office image right, at the same level */
    hero: (
      <section
        key="hero"
        className="px-4 md:px-12 pt-10 md:pt-16 pb-12 md:pb-16"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
          <div>
            <Eyebrow>{str(heroV, "eyebrow") ?? "About Bazar Real Estate"}</Eyebrow>
            <h1
              className="serif mt-4"
              style={{
                fontSize: fluid(64),
                letterSpacing: "-0.03em",
                lineHeight: 1.0,
              }}
            >
              <Lines
                text={str(heroV, "title") ?? "A trusted name in UAE\nreal estate"}
              />
              {str(heroV, "title_emphasis") ? (
                <>
                  {" "}
                  <em className="italic">{str(heroV, "title_emphasis")}</em>
                </>
              ) : null}
            </h1>
            {str(heroV, "meta") ? (
              <div className="eyebrow mt-6">{str(heroV, "meta")}</div>
            ) : null}
            <div className="text-[15.5px] md:text-[17px] leading-[1.65] text-bz-ink-2 mt-3.5 max-w-[620px]">
              <p className="m-0">
                {str(heroV, "body_1") ??
                  "Established in Abu Dhabi in 2005, Bazar Real Estate L.L.C. is a leading award-winning real estate agency in the UAE, built on over 20 years of trust, transparency, and proven market experience."}
              </p>
              {str(heroV, "body_2") ? (
                <p className="mt-4">{str(heroV, "body_2")}</p>
              ) : null}
            </div>
          </div>
          <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
            <Photo
              image={heroPhoto}
              label="bazar office · al bateen · abu dhabi"
              className="absolute inset-0 h-full w-full rounded-xl"
              sizes="(max-width: 1023px) 100vw, 46vw"
            />
          </div>
        </div>
      </section>
    ),

    /* Beyond property + Our story */
    story: (
      <section
        key="story"
        className="px-4 md:px-12 py-14 md:py-18 border-t border-bz-border"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-[72px]">
          {story.map((column, index) => (
            <div key={index}>
              <div className="eyebrow">{column.eyebrow}</div>
              <h2
                className="serif mt-3.5"
                style={{
                  fontSize: fluid(36),
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                {column.title}
              </h2>
              {paragraphs(column.body).map((p, i) => (
                <p
                  key={i}
                  className="text-[15.5px] text-bz-ink-2 leading-[1.7] mt-4"
                >
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>
    ),

    /* Mission */
    mission: (
      <section
        key="mission"
        className="px-4 md:px-12 py-16 md:py-24 bg-bz-navy text-white text-center"
      >
        <div className="max-w-[1000px] mx-auto">
          <Eyebrow className="text-bz-taupe-light">
            {str(missionV, "eyebrow") ?? "Our mission"}
          </Eyebrow>
          <h2
            className="serif text-white mt-5 mx-auto"
            style={{
              fontSize: fluid(52),
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
            }}
          >
            {str(missionV, "title") ??
              "To guide clients through the UAE real estate market with clarity, integrity, and strategic insight."}
          </h2>
          <p className="text-[15px] md:text-[16px] text-white/75 leading-[1.7] mt-6 max-w-[700px] mx-auto">
            {str(missionV, "body") ??
              "Drawing on over 20 years of local expertise, strong developer relationships, and in-depth market knowledge, we deliver tailored property guidance that creates lasting value and a seamless client experience."}
          </p>
        </div>
      </section>
    ),

    /* Values */
    values: (
      <section
        key="values"
        className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border"
      >
        <div>
          <SectionHead
            eyebrow={str(valuesV, "eyebrow") ?? "Our values"}
            title={str(valuesV, "title") ?? "What we stand on."}
            size={44}
            className="mb-11"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 border-t border-bz-border">
            {values.map(([t, d], i) => (
              <div
                key={t}
                className="pt-9 pb-2 lg:pr-6 lg:border-r border-bz-border last:border-r-0 lg:[&:not(:first-child)]:pl-6"
              >
                <div className="serif italic text-bz-accent text-[30px]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  className="serif text-[24px] mt-3.5"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {t}
                </div>
                <p className="text-[13px] text-bz-muted leading-relaxed mt-2.5">
                  {d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),

    /* Footprint */
    footprint: (
      <section
        key="footprint"
        className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border bg-bz-surface-2"
      >
        <div>
          <SectionHead
            eyebrow={str(footprintV, "eyebrow") ?? "Our footprint"}
            title={
              str(footprintV, "title") ??
              "Rooted in Abu Dhabi, reaching the wider UAE."
            }
            size={44}
            className="mb-9"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {footprint.map((card, index) => (
              <article
                key={index}
                className="rounded-lg border border-bz-border bg-bz-surface overflow-hidden"
              >
                <div className="relative w-full" style={{ aspectRatio: "2/1" }}>
                  <Photo
                    image={card.image}
                    label={card.img}
                    className="absolute inset-0 h-full w-full"
                    sizes="(max-width: 767px) 100vw, 46vw"
                  />
                </div>
                <div className="p-7">
                  <div className="eyebrow">{card.tag}</div>
                  <div
                    className="serif text-[30px] mt-2"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {card.name}
                  </div>
                  <p className="text-[14.5px] text-bz-ink-2 leading-[1.65] mt-3">
                    {card.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    ),

    /* Expertise + track record */
    expertise: (
      <section
        key="expertise"
        className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-[72px] items-start">
          <div>
            <div className="eyebrow">
              {str(expertiseV, "eyebrow") ?? "Our areas of expertise"}
            </div>
            <h2
              className="serif mt-3.5"
              style={{
                fontSize: fluid(40),
                letterSpacing: "-0.025em",
                lineHeight: 1.05,
              }}
            >
              {str(expertiseV, "title") ?? "Where our knowledge runs deep."}
            </h2>
            <p className="text-[15px] text-bz-ink-2 leading-relaxed mt-3.5 max-w-[520px]">
              {str(expertiseV, "body") ??
                "We combine market expertise, strong industry relationships, and a client-focused approach to support buyers, investors, landlords, sellers, and tenants across the UAE."}
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {chips.map((chip) => {
                const className =
                  "px-4 py-2 rounded-full bg-bz-surface-2 border border-bz-border text-[13.5px]";
                return chip.href ? (
                  <Link key={chip.label} href={chip.href} className={className}>
                    {chip.label}
                  </Link>
                ) : (
                  <span key={chip.label} className={className}>
                    {chip.label}
                  </span>
                );
              })}
            </div>
            {str(expertiseV, "cta_label") ? (
              <Button
                asChild
                className="mt-7 bg-bz-ink text-bz-bg hover:bg-bz-ink/90"
              >
                <Link href={str(expertiseV, "cta_href") ?? "/services"}>
                  {str(expertiseV, "cta_label")}
                  <ArrowRight size={15} strokeWidth={1.7} />
                </Link>
              </Button>
            ) : null}
          </div>
          <div>
            <div className="eyebrow">
              {str(expertiseV, "track_eyebrow") ?? "Our track record"}
            </div>
            <div className="mt-4 border-t border-bz-border">
              {highlights.map((h) => (
                <div
                  key={h}
                  className="flex items-center gap-3.5 py-4 border-b border-bz-border text-[15.5px]"
                >
                  <Check size={16} strokeWidth={2} className="text-bz-accent" />
                  {h}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    ),

    /* Developer partners */
    partners: (
      <section
        key="partners"
        className="px-4 md:px-12 py-14 md:py-18 border-t border-bz-border"
      >
        <div>
          <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
            <SectionHead
              eyebrow={str(partnersV, "eyebrow") ?? "Our developer partners"}
              title={str(partnersV, "title") ?? "Trusted by the region's builders."}
              size={40}
            />
            {str(partnersV, "cta_label") ? (
              <Button asChild variant="outline">
                <Link href={str(partnersV, "cta_href") ?? "/developers"}>
                  {str(partnersV, "cta_label")}
                  <ArrowRight size={15} strokeWidth={1.7} />
                </Link>
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-bz-border border border-bz-border rounded-xl overflow-hidden">
            {partners.map((p) => {
              const className =
                "bg-bz-surface px-7 py-9 flex items-center justify-center serif text-[26px] min-h-[110px]";
              return p.href ? (
                <Link
                  key={p.label}
                  href={p.href}
                  className={className}
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {p.label}
                </Link>
              ) : (
                <div
                  key={p.label}
                  className={className}
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {p.label}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    ),

    /* Partner ecosystem — banking + regulatory (shared with home) */
    partner_ecosystem: <PartnerEcosystemSection key="partner_ecosystem" />,

    /* Location — 1:1 with the /contact HQ map + details */
    location: (
      <section
        key="location"
        className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-10 lg:gap-14 items-center">
          <div>
            <div className="eyebrow">
              {str(locationV, "eyebrow") ?? "Our location"}
            </div>
            <h2
              className="serif mt-3.5"
              style={{
                fontSize: fluid(40),
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
              }}
            >
              {str(locationV, "title") ?? "Based in Abu Dhabi, serving the UAE."}
            </h2>
            <div className="text-[16px] text-bz-ink-2 leading-[1.7] mt-5">
              <div className="font-medium text-bz-ink">
                {str(locationV, "company") ?? "Bazar Real Estate L.L.C."}
              </div>
              <Lines
                text={
                  str(locationV, "address") ??
                  "Sheikha Salama Building, Office 4\nZayed The First Street, Al Bateen\nAbu Dhabi, United Arab Emirates"
                }
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <a href={HQ_DIRECTIONS} target="_blank" rel="noopener noreferrer">
                  <Navigation size={15} strokeWidth={1.8} />
                  {str(locationV, "directions_label") ?? "Get directions"}
                </a>
              </Button>
              {str(locationV, "cta_label") ? (
                <Button asChild variant="outline">
                  <Link href={str(locationV, "cta_href") ?? "/contact"}>
                    <MapPin size={15} strokeWidth={1.8} />
                    {str(locationV, "cta_label")}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          <HqMapCanvas
            lat={HQ_LAT}
            lng={HQ_LNG}
            label="Bazar HQ — Al Bateen"
            className="w-full aspect-[16/10] rounded-xl overflow-hidden border border-bz-border"
          />
        </div>
      </section>
    ),
  };

  return (
    <div className="bg-bz-bg">
      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}
