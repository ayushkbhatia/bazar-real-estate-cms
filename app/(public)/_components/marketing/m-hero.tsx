import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "./fluid";

type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Placeholder caption / eventual alt for the hero image. */
  image?: string;
  tall?: boolean;
  /** Bottom kicker stats: [value, label][]. */
  kicker?: [string, string][];
  children?: React.ReactNode;
};

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
  tall,
  kicker,
  children,
}: Props) {
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ minHeight: tall ? 620 : 520 }}
    >
      <PlaceholderImage
        label={image}
        dark
        className="absolute inset-0 h-full w-full"
      />
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
        )}
        style={{ minHeight: tall ? 620 : 520 }}
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
          <div className="mt-auto pt-10 flex flex-wrap gap-8 md:gap-14">
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
