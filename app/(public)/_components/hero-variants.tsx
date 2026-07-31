import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { HeroSearch } from "./hero-search";
import { HeroVideoBg } from "./hero-video-bg";

export type HeroVariant = "fullbleed" | "editorial" | "map" | "concierge";

/**
 * 4 hero variants picked by `site_settings.display.hero_variant` (edit at
 * /admin/settings/brand). The home page passes the resolved variant as a
 * prop — it deliberately does not accept a querystring override, since
 * reading `searchParams` would force the whole route into dynamic
 * (uncached) rendering.
 */
/**
 * Copy overrides from the master-page editor. Only the full-bleed hero — the
 * default and the one the home page ships with — is editable; the other three
 * variants keep their own copy.
 */
export type HeroCopy = {
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  link1?: { label?: string | null; href?: string | null };
  link2?: { label?: string | null; href?: string | null };
  /**
   * Background media picked in the master-page editor. Each part falls back
   * independently to the clip that ships in /public, so uploading only a
   * poster — or only a video — still renders a complete hero.
   */
  media?: {
    videoUrl?: string | null;
    videoMime?: string | null;
    posterUrl?: string | null;
  };
};

/** The clip that ships in /public, used until someone uploads one. */
const BUILT_IN_VIDEO = "/hero/home-hero.mp4";
const BUILT_IN_POSTER = "/hero/home-hero-poster.jpg";

/** Last resort when a stored asset has lost its mime_type row. */
function guessVideoMime(url: string): string {
  return url.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";
}

export function HeroFullBleed({ copy }: { copy?: HeroCopy } = {}) {
  const videoSrc = copy?.media?.videoUrl ?? BUILT_IN_VIDEO;
  return (
    <section className="relative min-h-[560px] md:h-[720px] bg-bz-ink overflow-hidden">
      <HeroVideoBg
        src={videoSrc}
        poster={copy?.media?.posterUrl ?? BUILT_IN_POSTER}
        mimeType={
          copy?.media?.videoUrl
            ? (copy.media.videoMime ?? guessVideoMime(videoSrc))
            : "video/mp4"
        }
      />
      {/* Scrim: keeps the white headline + search legible over the footage. */}
      <div className="absolute inset-0 bg-gradient-to-t from-bz-ink/95 via-bz-ink/55 to-bz-ink/35" />
      <div className="relative h-full px-4 md:px-12 flex flex-col justify-end pb-10 md:pb-16 pt-24 md:pt-0 text-white">
        <Eyebrow className="text-white/60 mb-4">
          {copy?.eyebrow ?? "Bazar · Abu Dhabi"}
        </Eyebrow>
        <h1
          className="serif text-[44px] md:text-[88px] leading-[0.98] font-normal max-w-[12ch]"
          style={{ letterSpacing: "-0.03em" }}
        >
          {copy?.title ?? "Find a home worth keeping."}
        </h1>
        <p className="mt-5 max-w-[60ch] text-[15px] md:text-[17px] leading-relaxed text-white/80">
          {copy?.subtitle ??
            "Curated marketplace and bespoke advisory for buyers, sellers, and investors across the United Arab Emirates."}
        </p>
        <HeroSearch />
        <div className="mt-5 flex gap-3 text-[13.5px]">
          <Link
            href={copy?.link1?.href ?? "/off-plan"}
            className="text-white/85 hover:text-white underline underline-offset-4 transition-colors"
          >
            {copy?.link1?.label ?? "Browse Properties"}
          </Link>
          <span className="text-white/30">·</span>
          <Link
            href={copy?.link2?.href ?? "/concierge"}
            className="text-white/85 hover:text-white underline underline-offset-4 transition-colors"
          >
            {copy?.link2?.label ?? "Talk to an Advisor"}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HeroEditorial() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 md:min-h-[640px] bg-bz-bg">
      <div className="px-4 py-12 md:px-12 md:py-20 flex flex-col justify-center order-2 md:order-1">
        <Eyebrow>The Bazar approach</Eyebrow>
        <h1
          className="serif text-[40px] md:text-[68px] mt-4 leading-[1.0] font-normal max-w-[15ch]"
          style={{ letterSpacing: "-0.028em" }}
        >
          Abu Dhabi, properly understood.
        </h1>
        <p className="mt-6 max-w-[52ch] text-[16px] text-bz-ink-2 leading-relaxed">
          Twelve capped senior advisors. Fiduciary-aligned. Off-market deal
          flow. We close fewer deals by design.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/about">About Bazar</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/agents">Meet the team</Link>
          </Button>
        </div>
      </div>
      <PlaceholderImage
        label="editorial · saadiyat"
        className="h-full w-full min-h-[240px] md:min-h-[640px] order-1 md:order-2"
      />
    </section>
  );
}

export function HeroMap() {
  return (
    <section className="relative min-h-[520px] md:h-[640px] bg-bz-surface overflow-hidden">
      <PlaceholderImage
        label="map · abu dhabi"
        className="absolute inset-0 w-full h-full"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bz-bg/85 via-bz-bg/40 to-transparent" />
      <div className="relative px-4 py-12 md:px-12 md:py-16">
        <Eyebrow>Start with the map</Eyebrow>
        <h1
          className="serif text-[40px] md:text-[64px] mt-4 leading-[1.02] font-normal max-w-[14ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          Draw the area you want.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16px] text-bz-ink-2 leading-relaxed">
          Filter by polygon, commute time, or pin density. The map is the
          primary view for advisors and serious buyers.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link href="/buy/search?view=map">Open the map</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function HeroConcierge() {
  return (
    <section className="bg-bz-ink text-white px-4 py-12 md:px-12 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_460px] gap-10 md:gap-16 items-start max-w-[1400px] mx-auto">
        <div>
          <Eyebrow className="text-white/60">AI concierge</Eyebrow>
          <h1
            className="serif text-[40px] md:text-[68px] mt-4 leading-[1.0] font-normal max-w-[15ch]"
            style={{ letterSpacing: "-0.028em" }}
          >
            Tell us the brief. We&apos;ll narrow it down.
          </h1>
          <p className="mt-6 max-w-[58ch] text-[16px] text-white/80 leading-relaxed">
            Talk to the Bazar concierge. We&apos;ll triangulate area,
            budget, timeline, and constraints — then hand you to the
            advisor who fits.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/concierge">Start a brief</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Link href="/contact">Talk to a human</Link>
            </Button>
          </div>
        </div>
        <aside className="rounded-lg border border-white/15 bg-white/5 backdrop-blur p-6">
          <div className="text-[11px] uppercase tracking-widest text-white/50 mb-3">
            Concierge brief · sample
          </div>
          <div className="flex flex-col gap-2 text-[13px]">
            <div className="rounded-md bg-white/10 px-3 py-2">
              Budget · <span className="mono">AED 6–9M</span>
            </div>
            <div className="rounded-md bg-white/10 px-3 py-2">
              Area · Saadiyat or Yas
            </div>
            <div className="rounded-md bg-white/10 px-3 py-2">
              Type · 3-bed apartment or villa
            </div>
            <div className="rounded-md bg-white/10 px-3 py-2">
              Timeline · Move-in by Q4
            </div>
            <div className="rounded-md bg-white/10 px-3 py-2">
              Constraint · Beachfront, school district
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function HeroForVariant({
  variant,
  copy,
}: {
  variant: HeroVariant;
  copy?: HeroCopy;
}) {
  switch (variant) {
    case "editorial":
      return <HeroEditorial />;
    case "map":
      return <HeroMap />;
    case "concierge":
      return <HeroConcierge />;
    case "fullbleed":
    default:
      return <HeroFullBleed copy={copy} />;
  }
}
