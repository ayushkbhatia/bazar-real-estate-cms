import * as React from "react";
import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import { fluid } from "../../_components/marketing/fluid";

type Props = {
  eyebrow: string | null;
  title: string | null;
  titleEmphasis: string | null;
  /** The larger line directly under the headline. Consultation only. */
  lede?: string | null;
  sub: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Anchor id, so the closing CTA can jump back up to the form. */
  formAnchor: string;
  /** The lead card. */
  form: React.ReactNode;
};

/**
 * Copy left, lead card right — the hero both service landings open with.
 *
 * The layout is the one /services/sell established, including the two-pass
 * gradient: the horizontal pass carries the desktop split and the vertical one
 * does the work on mobile once the columns stack. Either alone leaves a corner
 * of the photo unreadable behind white type.
 *
 * On mobile the form comes first. Someone who tapped "Property Management" in
 * the menu should land on the first question, not on the pitch.
 */
export function ServiceHero({
  eyebrow,
  title,
  titleEmphasis,
  lede,
  sub,
  imageUrl,
  imageAlt,
  formAnchor,
  form,
}: Props) {
  const lines = (title ?? "").split("\n");

  return (
    <section
      className={cn(
        "px-4 md:px-12 pt-10 md:pt-[72px] pb-14 md:pb-20",
        // Only becomes a media hero once a photo is picked; without one the
        // section keeps the plain page treatment. `bg-bz-navy` is what shows
        // in the moment before the photo decodes, instead of the cream page
        // background flashing behind white type.
        imageUrl && "relative overflow-hidden bg-bz-navy",
      )}
    >
      {imageUrl ? (
        <>
          {/* Photo and scrim are ordinary positioned siblings, not a negative
              z-index: behind the section they would sit below the opaque page
              wrapper in axe's background stack, which reads every white string
              here as white-on-cream. */}
          <Image
            src={imageUrl}
            alt={imageAlt ?? ""}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,.52) 0%, rgba(0,0,0,.26) 55%, rgba(0,0,0,.10) 100%), linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.22) 100%)",
            }}
          />
        </>
      ) : null}

      <div
        className={cn(
          "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 lg:gap-[72px] items-start max-w-[1280px]",
          imageUrl && "relative",
        )}
      >
        {/* The light copy belongs to this column, not to the section: on the
            section it also cascades into the form card, whose surface stays
            white — leaving its labels and the visitor's typed input
            white-on-white. */}
        <div className={cn("order-2 lg:order-1 lg:pt-2", imageUrl && "text-white")}>
          {eyebrow ? (
            <Eyebrow className={imageUrl ? "text-white/80" : undefined}>
              {eyebrow}
            </Eyebrow>
          ) : null}
          <h1
            className="serif mt-3.5"
            style={{
              fontSize: fluid(58),
              letterSpacing: "-0.03em",
              lineHeight: 1.03,
            }}
          >
            {lines.map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <br /> : null}
                {line}
              </React.Fragment>
            ))}
            {titleEmphasis ? (
              <>
                {lines.length > 0 ? " " : null}
                <em className="italic">{titleEmphasis}</em>
              </>
            ) : null}
          </h1>
          {lede ? (
            <p
              className={cn(
                "mt-5 text-[18px] md:text-[20px] leading-snug max-w-[26ch]",
                imageUrl ? "text-white/90" : "text-bz-ink",
              )}
            >
              {lede}
            </p>
          ) : null}
          {sub ? (
            <p
              className={cn(
                "text-[16px] md:text-[17px] leading-relaxed mt-4 max-w-[52ch]",
                imageUrl ? "text-white/85" : "text-bz-ink-2",
              )}
            >
              {sub}
            </p>
          ) : null}
        </div>

        <div id={formAnchor} className="order-1 lg:order-2 scroll-mt-24">
          {form}
        </div>
      </div>
    </section>
  );
}
