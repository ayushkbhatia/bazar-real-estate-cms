import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fluid } from "./fluid";

type Props = {
  eyebrow?: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  align?: "left" | "center";
  /** Desktop serif size in px (scales down fluidly on mobile). */
  size?: number;
  dark?: boolean;
  className?: string;
};

/**
 * Eyebrow + serif headline + optional sub-copy. The section-header rhythm used
 * across every master page (the handoff's `MHead`).
 */
export function SectionHead({
  eyebrow,
  title,
  sub,
  align = "left",
  size = 44,
  dark,
  className,
}: Props) {
  const centered = align === "center";
  return (
    <div className={cn(centered && "text-center", className)}>
      {eyebrow ? (
        <Eyebrow className={dark ? "text-white/65" : undefined}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      {title ? (
        <h2
          className={cn(
            "serif mt-3 font-normal",
            dark ? "text-white" : "text-bz-ink",
            centered && "mx-auto",
          )}
          style={{
            fontSize: fluid(size),
            letterSpacing: "-0.025em",
            lineHeight: 1.04,
            maxWidth: centered ? "18ch" : undefined,
          }}
        >
          {title}
        </h2>
      ) : null}
      {sub ? (
        <p
          className={cn(
            "mt-4 text-[16px] md:text-[17px] leading-relaxed",
            dark ? "text-white/75" : "text-bz-ink-2",
            centered && "mx-auto",
          )}
          style={{ maxWidth: "42ch" }}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
