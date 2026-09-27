import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import Link from "@/components/i18n/link";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { handoverQuarter, quarterArgs } from "@/lib/developments/handover";
import type { InternalLinkVariant } from "@/lib/internal-links/model";
import type { ResolvedInternalLink } from "@/lib/internal-links/types";
import { AreaText, PriceText } from "../../../_components/area-text";

type Parts = {
  /** Segments of the eyebrow, joined with a separator. */
  eyebrow: string[];
  subline: string | null;
  summary: string | null;
  /** The one figure worth reading first — a price. */
  highlight: ReactNode;
  facts: ReactNode[];
  cta: string;
};

/**
 * What a card says, per kind. Every value is either the live record's own
 * (already folded to the page's locale by the resolver) or a catalogue string
 * — nothing here is typed by the article's author, which is why an Arabic
 * reader gets an Arabic card on an article whose Arabic body is a copy of the
 * English one.
 */
function useCardParts(link: ResolvedInternalLink): Parts {
  const t = useTranslations("editorial.internalLink");
  const tListing = useTranslations("listing");
  const tDev = useTranslations("development.card");
  const tType = useTranslations("search.type");

  switch (link.kind) {
    case "area":
      return {
        eyebrow: [t("areaEyebrow")],
        subline: link.parent,
        summary: link.summary,
        highlight: null,
        facts:
          link.listings > 0 ? [t("areaHomes", { count: link.listings })] : [],
        cta: t("areaCta"),
      };

    case "development": {
      const handover = handoverQuarter(link.handoverDate);
      return {
        eyebrow: [t("projectEyebrow"), ...(link.developer ? [link.developer] : [])],
        subline: link.area,
        summary: link.tagline,
        highlight:
          link.startingPriceAed != null ? (
            <>
              {tDev("from")} <PriceText aed={link.startingPriceAed} />
            </>
          ) : (
            tDev("priceOnRequest")
          ),
        facts: handover ? [tDev("handover", quarterArgs(handover))] : [],
        cta: t("projectCta"),
      };
    }

    case "property": {
      const mode =
        link.mode === "rent"
          ? tListing("forRent")
          : link.mode === "off_plan"
            ? tListing("offPlan")
            : link.mode === "commercial"
              ? tType("commercial")
              : tListing("forSale");
      const type = tType.has(link.type) ? tType(link.type) : null;
      const facts: ReactNode[] = [];
      if (link.beds != null) facts.push(tListing("bedrooms", { count: link.beds }));
      if (link.baths != null) {
        facts.push(tListing("bathrooms", { count: link.baths }));
      }
      if (link.builtUpFt2) facts.push(<AreaText ft2={link.builtUpFt2} />);
      return {
        eyebrow: [mode, ...(type ? [type] : [])],
        subline: link.area,
        summary: null,
        highlight:
          link.priceAed != null ? (
            <PriceText aed={link.priceAed} />
          ) : (
            tListing("priceOnRequest")
          ),
        facts,
        cta: t("listingCta"),
      };
    }
  }
}

/**
 * Values in a row, dot-separated. Inline rather than flex, so a container can
 * wrap them or ellipsise them like any other line of text. Each value is
 * isolated because on /ar it may arrive in either script — a developer's name
 * with no Arabic twin stays Latin, and unisolated it drags the separators to
 * the wrong side.
 */
function Joined({ items }: { items: ReactNode[] }) {
  return (
    <>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <span aria-hidden className="mx-1.5 text-bz-muted-2">
              ·
            </span>
          ) : null}
          <bdi>{item}</bdi>
        </Fragment>
      ))}
    </>
  );
}

/**
 * An article's link to an area guide, a project or a listing.
 *
 * Rendered inside `.bz-prose`, which styles every `<a>` as an underlined
 * accent-coloured text link. Those rules live in `@layer components`, so the
 * utilities below outrank them without `!important` — that is the only
 * reason the card is not blue and underlined.
 *
 * The title is deliberately not a heading. The article's own h2/h3 are its
 * outline; a card is an aside, and four of them would read to a screen
 * reader (and a crawler) as four new sections.
 *
 * Laid out with logical utilities only, so the photograph moves to the right
 * and the arrow turns around under `dir="rtl"`.
 */
export function InternalLinkCard({
  link,
  variant,
}: {
  link: ResolvedInternalLink;
  variant: InternalLinkVariant;
}) {
  const parts = useCardParts(link);
  const placeholder =
    link.kind === "property" ? link.reference : link.slug.replace(/-/g, " ");

  if (variant === "compact") {
    const detail = [
      ...(parts.subline ? [parts.subline] : []),
      ...(parts.highlight ? [parts.highlight] : parts.facts.slice(0, 1)),
    ];
    return (
      <aside className="my-7" data-internal-link-card={link.kind}>
        <Link
          href={link.href}
          className="group flex items-center gap-3.5 rounded-lg border border-bz-border border-s-[3px] border-s-bz-teal bg-bz-surface p-3 pe-4 text-bz-ink no-underline transition-colors hover:border-bz-ink-2 hover:border-s-bz-navy hover:text-bz-ink"
        >
          <span className="relative size-14 shrink-0 overflow-hidden rounded bg-bz-surface-2">
            {link.image ? (
              <Image
                src={link.image.url}
                alt=""
                fill
                sizes="56px"
                loading="lazy"
                className="object-cover"
              />
            ) : (
              <span aria-hidden className="bz-img absolute inset-0" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="eyebrow block truncate">
              <Joined items={parts.eyebrow} />
            </span>
            <span className="truncate text-[15.5px] font-medium leading-snug">
              <bdi>{link.name}</bdi>
            </span>
            {detail.length > 0 ? (
              <span className="block truncate text-[12.5px] text-bz-muted">
                <Joined items={detail} />
              </span>
            ) : null}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-bz-teal transition-colors group-hover:text-bz-navy">
            <span className="hidden sm:inline">{parts.cta}</span>
            <ArrowRight
              size={15}
              strokeWidth={1.8}
              aria-hidden
              className="rtl:-scale-x-100"
            />
          </span>
        </Link>
      </aside>
    );
  }

  return (
    <aside className="my-9" data-internal-link-card={link.kind}>
      <Link
        href={link.href}
        className="group flex flex-col overflow-hidden rounded-lg border border-bz-border bg-bz-surface text-bz-ink no-underline transition-colors hover:border-bz-ink-2 hover:text-bz-ink sm:flex-row"
      >
        <span className="relative block aspect-[16/9] shrink-0 overflow-hidden bg-bz-surface-2 sm:aspect-auto sm:min-h-[176px] sm:w-[38%]">
          {link.image ? (
            <Image
              src={link.image.url}
              alt={link.image.alt}
              fill
              sizes="(min-width: 640px) 260px, 100vw"
              loading="lazy"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <PlaceholderImage
              label={placeholder}
              className="absolute inset-0"
            />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1 p-5 sm:p-6">
          <span className="eyebrow block">
            <Joined items={parts.eyebrow} />
          </span>
          <span
            className="serif mt-1 text-[22px] leading-[1.15]"
            style={{ letterSpacing: "-0.015em" }}
          >
            <bdi>{link.name}</bdi>
          </span>
          {parts.subline ? (
            <span className="text-[13px] text-bz-muted">
              <bdi>{parts.subline}</bdi>
            </span>
          ) : null}
          {parts.summary ? (
            <span className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-bz-ink-2">
              {/* A sentence the record owns: English on /ar until its twin
                  is written, so its punctuation must not follow the page. */}
              <bdi>{parts.summary}</bdi>
            </span>
          ) : null}
          {parts.highlight ? (
            <span className="mt-2 text-[16px] font-medium tracking-tight text-bz-navy">
              <bdi>{parts.highlight}</bdi>
            </span>
          ) : null}
          {parts.facts.length > 0 ? (
            <span className="block text-[12.5px] text-bz-muted">
              <Joined items={parts.facts} />
            </span>
          ) : null}
          <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[13px] font-medium text-bz-teal transition-colors group-hover:text-bz-navy">
            {parts.cta}
            <ArrowRight
              size={14}
              strokeWidth={1.8}
              aria-hidden
              className="rtl:-scale-x-100"
            />
          </span>
        </span>
      </Link>
    </aside>
  );
}
