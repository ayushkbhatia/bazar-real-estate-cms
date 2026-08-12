import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import {
  countDeveloperListings,
  getDeveloperBySlug,
  listDeveloperListings,
} from "@/lib/queries/developers-extras";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { mediaPublicUrl } from "@/lib/media";
import { propertyUrl } from "@/lib/queries/property-utils";
import { DevelopmentCard } from "../../_components/marketing/development-card";
import { ListingCardPriced } from "../../_components/listing-card-priced";
import { entryLogo, findDirectoryEntry, listDirectory } from "../_directory";

/**
 * Both sources, not just the code-owned one: a developer created in the CMS is
 * advertised by the sitemap the moment it exists, so it has to be a known
 * param rather than relying on the dynamic fallback.
 */
export async function generateStaticParams() {
  const directory = await listDirectory();
  return directory.map((d) => ({ slug: d.slug }));
}

/** Fallback mark for a developer with no logo in the directory. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [entry, detail] = await Promise.all([
    findDirectoryEntry(slug),
    getDeveloperBySlug(slug),
  ]);
  const name = entry?.name ?? detail?.name;
  if (!name) return { title: "Developer not found" };
  return {
    title: `${name} · Bazar Real Estate`,
    description: detail?.description ?? entry?.blurb ?? undefined,
    // A developer the catalogue also carries is reachable at two slugs — the
    // shipped `modon` and the row's `modon-properties`. The grid links to the
    // row, and only the row's page has the projects, so that is the canonical.
    alternates: { canonical: `/developers/${entry?.slug ?? slug}` },
  };
}

export default async function DeveloperProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Identity resolves from either side. The directory carries the logo and
  // descriptor for the 30 curated partners, so a developer listed there
  // renders even before it has a DB row. A developer created in the CMS has
  // the mirror problem — a row but no directory entry — and must resolve too,
  // because app/sitemap.ts advertises every DB developer and a 404 on an
  // advertised URL is a soft-404 against the whole section.
  const [entry, detail] = await Promise.all([
    findDirectoryEntry(slug),
    getDeveloperBySlug(slug),
  ]);
  if (!entry && !detail) notFound();
  // Draft: off the grid, off the sitemap, and gone from its own URL. Anything
  // less and "unpublish" would leave a page anyone with the link could reach.
  if (entry && !entry.published) notFound();

  const name = detail?.name ?? entry?.name ?? "";
  const developerId =
    detail && !detail.id.startsWith("seed:") ? detail.id : null;
  const [developments, listings, listingTotal] = await Promise.all([
    developerId
      ? listPublishedDevelopments({ developerId })
      : Promise.resolve([]),
    developerId ? listDeveloperListings(developerId, 9) : Promise.resolve([]),
    developerId ? countDeveloperListings(developerId) : Promise.resolve(0),
  ]);
  const description = detail?.description ?? entry?.blurb ?? null;
  // Upload first, then the shipped art. An uploaded logo reaches the entry via
  // the directory merge; `detail.logo_url` covers a slug the merge didn't
  // fold (the superseded directory slug), so both paths land on the same mark.
  const logo = entryLogo(
    entry && detail?.logo_url ? { ...entry, uploaded: detail.logo_url } : entry,
  );

  return (
    <div className="bg-bz-bg">
      {/* Crumb */}
      <div className="px-4 md:px-12 pt-10">
        <Link
          href="/developers"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-teal hover:text-bz-navy transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          All developers
        </Link>
      </div>

      {/* Hero — logo, name, short description */}
      <section className="px-4 md:px-12 pt-8 pb-14 md:pb-16 border-b border-bz-border">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 md:gap-12 items-center">
          <div className="flex items-center justify-center bg-white rounded-xl border border-bz-border w-[160px] h-[160px] md:w-[200px] md:h-[200px] p-7">
            {logo ? (
              <Image
                src={logo.src}
                alt={name}
                width={logo.w}
                height={logo.h}
                className="h-full w-full object-contain"
                sizes="200px"
                priority
              />
            ) : (
              // No art on either side. Initials stand in until a logo is
              // uploaded on the developer's record.
              <span
                className="serif text-[44px] leading-none text-bz-ink-2"
                aria-hidden="true"
              >
                {initials(name)}
              </span>
            )}
          </div>
          <div>
            <Eyebrow>Developer</Eyebrow>
            <h1
              className="serif text-[40px] md:text-[64px] mt-3 font-normal leading-[1.02]"
              style={{ letterSpacing: "-0.025em" }}
            >
              {name}
            </h1>
            {description ? (
              <p className="mt-6 text-[16px] md:text-[17px] text-bz-ink-2 leading-relaxed max-w-[64ch]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Developments */}
      <section className="px-4 md:px-12 py-14 md:py-20">
        <div className="flex items-end justify-between gap-8 flex-wrap">
          <div>
            <Eyebrow>Developments</Eyebrow>
            <h2
              className="serif text-[30px] md:text-[36px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              {name}&apos;s projects.
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/off-plan">Browse all off-plan</Link>
          </Button>
        </div>

        {developments.length === 0 ? (
          <div className="mt-10 py-16 text-center border border-dashed border-bz-border rounded-xl">
            <p className="text-[14px] text-bz-ink-2">
              No developments published for {name} yet.
            </p>
            <Button asChild variant="ghost" className="mt-4">
              <Link href="/off-plan">Explore the wider off-plan market</Link>
            </Button>
          </div>
        ) : (
          // The same card /off-plan and /developments render — cover image,
          // tagline pill, and the From / Bedrooms / Handover strip. This
          // section used to draw a bespoke text-only tile, so a project looked
          // materially thinner here than everywhere else it appears.
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {developments.map((d) => (
              <DevelopmentCard key={d.id} d={d} />
            ))}
          </div>
        )}
      </section>

      {/* Listings filed under this developer */}
      {listings.length > 0 ? (
        <section className="px-4 md:px-12 pb-14 md:pb-20">
          <div className="flex items-end justify-between gap-8 flex-wrap">
            <div>
              <Eyebrow>Associated listings</Eyebrow>
              <h2
                className="serif text-[30px] md:text-[36px] mt-2 leading-tight"
                style={{ letterSpacing: "-0.02em" }}
              >
                Properties from this developer.
              </h2>
            </div>
            {/* No "view all" link: the search has no developer facet, so one
                would drop the visitor into unfiltered results. State the count
                instead until that filter exists. */}
            {listingTotal > listings.length ? (
              <span className="text-[12.5px] text-bz-muted">
                Showing {listings.length} of {listingTotal}
              </span>
            ) : null}
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((row, index) => (
              <Link
                key={row.id}
                href={propertyUrl(row)}
                className="block"
              >
                <ListingCardPriced
                  priceAed={row.price_aed}
                  title={row.title}
                  location={row.area?.name ?? "United Arab Emirates"}
                  beds={row.beds}
                  baths={row.baths}
                  area={row.built_up_ft2 ?? 0}
                  badge={
                    row.flags?.exclusive
                      ? "Exclusive"
                      : row.flags?.vacant_on_transfer
                        ? "Vacant on transfer"
                        : undefined
                  }
                  badgeKind={row.flags?.exclusive ? "ink" : "accent"}
                  imgLabel={row.reference}
                  heroSrc={
                    row.hero ? mediaPublicUrl(row.hero.storage_key) : null
                  }
                  heroAlt={row.hero?.alt_text ?? row.title}
                  priority={index < 2}
                  propertyId={row.id}
                  verified={Boolean(row.flags?.verified)}
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
