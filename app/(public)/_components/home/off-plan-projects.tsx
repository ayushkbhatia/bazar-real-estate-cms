import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { CarouselGrid } from "@/components/brand/mobile";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { developmentUrl } from "@/lib/queries/development-utils";
import { mediaPublicUrl } from "@/lib/media";
import { PriceText } from "../area-text";
import {
  HOME_OFFPLAN_CARD_COUNT,
  type SectionCopy,
} from "./section-copy";

/**
 * Home "Off-plan projects" (handoff §2). Three live developments from
 * listPublishedDevelopments(). Desktop 3-up grid, mobile snap carousel.
 */
export async function OffPlanProjects({
  eyebrow = "Off-plan projects for sale",
  heading = "New developments in Abu Dhabi",
  body = "Explore the latest off-plan projects across top communities.",
  ctaLabel = "All developments",
  ctaHref = "/developments",
  featuredSlugs,
  developments: prefetched,
}: SectionCopy & {
  /**
   * Project pages chosen in the home master page, in display order. Empty ⇒
   * the three most recent published projects, which is what this section did
   * before it was editable.
   */
  featuredSlugs?: string[];
  /**
   * Rows the caller has already fetched. The page builder can put several of
   * these on one page, and `listPublishedDevelopments` is not React-cached, so
   * letting each instance fetch for itself would be one round-trip per section.
   */
  developments?: Awaited<ReturnType<typeof listPublishedDevelopments>>;
} = {}) {
  const developments = prefetched ?? (await listPublishedDevelopments());

  // A pick that no longer resolves — unpublished, renamed, deleted — is
  // dropped rather than rendering a card that links nowhere.
  const bySlug = new Map(developments.map((d) => [d.slug, d]));
  const picked = (featuredSlugs ?? [])
    .map((slug) => bySlug.get(slug))
    .filter((d): d is (typeof developments)[number] => d !== undefined);

  const projects =
    picked.length > 0
      ? picked
      : developments.slice(0, HOME_OFFPLAN_CARD_COUNT);
  if (projects.length === 0) return null;

  return (
    <section className="px-4 md:px-12 py-14 md:py-20 bg-bz-surface-2">
      <div className="mb-8 flex flex-col gap-5 md:mb-11 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="serif mt-2 text-[28px] md:text-[44px] font-normal leading-[1.05] tracking-tight">
            {heading}
          </h2>
          <p className="mt-4 max-w-[52ch] text-[14.5px] md:text-[15.5px] text-bz-ink-2 leading-relaxed">
            {body}
          </p>
        </div>
        <Button asChild variant="outline" className="self-start">
          <Link href={ctaHref ?? "/developments"}>{ctaLabel}</Link>
        </Button>
      </div>

      <CarouselGrid cols={3}>
        {projects.map((d, i) => (
          <Link key={d.id} href={developmentUrl(d)} className="group block">
            <div className="overflow-hidden rounded-lg border border-bz-border bg-bz-surface">
              <div className="relative aspect-[3/2]">
                {d.hero ? (
                  <Image
                    src={mediaPublicUrl(d.hero.storage_key)}
                    alt={d.hero.alt_text ?? d.name}
                    fill
                    sizes="(min-width: 1280px) 400px, (min-width: 768px) 33vw, 80vw"
                    className="object-cover"
                    priority={i === 0}
                  />
                ) : (
                  <PlaceholderImage
                    label={d.slug ?? d.name.toLowerCase()}
                    className="h-full w-full"
                  />
                )}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-bz-navy px-2.5 py-1 text-[11px] font-medium text-bz-bg">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  Off-plan
                </span>
              </div>
              <div className="p-5">
                {d.developer ? (
                  <div className="text-[10.5px] uppercase tracking-[0.05em] text-bz-muted">
                    {d.developer.name}
                  </div>
                ) : null}
                <div
                  className="serif mt-1.5 text-[22px] md:text-[24px] leading-tight group-hover:text-bz-accent transition-colors"
                  style={{ letterSpacing: "-0.012em" }}
                >
                  {d.name}
                </div>
                {d.area ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[13px] text-bz-muted">
                    <MapPin size={13} strokeWidth={1.7} /> {d.area.name}
                  </div>
                ) : null}
                <div className="mt-5 flex items-end justify-between border-t border-bz-border pt-4">
                  <div>
                    <div className="text-[11px] text-bz-muted">Starting from</div>
                    <div className="mt-0.5 text-[20px] font-medium tracking-tight text-bz-navy">
                      <PriceText
                        aed={d.starting_price}
                        fallback="Price on request"
                      />
                    </div>
                    {d.handover_date ? (
                      <div className="mt-1.5 text-[11px] text-bz-muted">
                        Handover {formatHandover(d.handover_date)}
                      </div>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[13px] text-bz-ink-2 group-hover:text-bz-accent transition-colors">
                    View <ArrowRight size={13} strokeWidth={1.7} />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </CarouselGrid>
    </section>
  );
}

/** "2027-11-01" → "Q4 2027"; passthrough if already free-text. */
function formatHandover(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}
