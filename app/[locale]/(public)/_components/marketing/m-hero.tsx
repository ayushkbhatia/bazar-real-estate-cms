import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/eyebrow";
import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "./fluid";

type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Placeholder caption / eventual alt for the hero image. */
  image?: string;
  /** Resolved URL of the asset chosen in the master-page editor. */
  imageUrl?: string | null;
  imageAlt?: string | null;
  tall?: boolean;
  /** Bottom kicker stats: [value, label][]. */
  kicker?: [string, string][];
  children?: React.ReactNode;
};

/**
 * The band's height, phone then desktop.
 *
 * Held as whole class strings rather than built from `tall`, because Tailwind
 * scans source text: `min-h-[${n}px]` is invisible to it and produces no CSS.
 */
const MIN_H = {
  tall: "min-h-[480px] md:min-h-[620px]",
  short: "min-h-[420px] md:min-h-[520px]",
} as const;

/**
 * Full-bleed editorial image hero with gradient scrim, used on New Projects
 * and any master page wanting a photographic lead (the handoff's `MHero`).
 * Owns its own horizontal padding (full-bleed band).
 */
export function MHero({
  eyebrow,
  title,
  sub,
  image = "abu dhabi · corniche skyline",
  imageUrl,
  imageAlt,
  tall,
  kicker,
  children,
}: Props) {
  return (
    <section
      className={cn("relative overflow-hidden text-white", MIN_H[tall ? "tall" : "short"])}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={imageAlt ?? ""}
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <PlaceholderImage
        label={image}
        dark
        className="absolute inset-0 h-full w-full"
      />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,18,14,.35) 0%, rgba(20,18,14,.28) 40%, rgba(20,18,14,.72) 100%)",
        }}
      />
      <div
        className={cn(
          "relative flex flex-col px-4 md:px-12 pt-24 md:pt-[120px] pb-12 md:pb-16",
          MIN_H[tall ? "tall" : "short"],
        )}
      >
        <div className="max-w-[760px]">
          {eyebrow ? (
            <Eyebrow className="text-white/70">{eyebrow}</Eyebrow>
          ) : null}
          <h1
            className="serif text-white mt-4 mb-5"
            style={{
              fontSize: fluid(80),
              lineHeight: 0.98,
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </h1>
          {sub ? (
            <p
              className="text-[16px] md:text-[18px] leading-[1.55] max-w-[600px]"
              style={{ opacity: 0.88 }}
            >
              {sub}
            </p>
          ) : null}
        </div>
        {kicker ? (
          /*
             Below `md` the kicker is not drawn at all.

             On a phone the three stats stack — each is a 40px serif figure
             over a caption that wraps to two lines — and they were adding
             ~290px to a hero whose own content (eyebrow, headline, standfirst)
             comes to ~330px. The visitor met a screen and a half of
             market statistics before the first thing the page is for. They are
             supporting evidence for the headline, so a phone drops them and
             every width from `md` up draws exactly what it drew before. Same
             call as the home hero, which shrinks from 720px to 460px on a
             phone for the same reason.
           */
          <div className="mt-auto hidden pt-10 md:flex md:flex-wrap gap-8 md:gap-14">
            {kicker.map(([v, l]) => (
              <div key={l}>
                <div
                  className="serif text-white"
                  style={{ fontSize: fluid(40), letterSpacing: "-0.02em" }}
                >
                  {v}
                </div>
                <div
                  className="text-[12.5px] mt-0.5"
                  style={{ opacity: 0.75 }}
                >
                  {l}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
