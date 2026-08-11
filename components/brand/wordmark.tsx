import Image from "next/image";
import { cn } from "@/lib/utils";
import type { LogoStyle } from "@/lib/schemas/site-settings";

/**
 * The CMS-uploaded logo, if the operator has set one
 * (/admin/settings/brand). `style` decides whether it stands beside the
 * "Bazar" wordmark or replaces it — see LOGO_STYLES for why the file alone
 * cannot answer that.
 */
export type BrandLogo = {
  url: string;
  style: LogoStyle;
  /** Alt text when the logo stands alone. Defaults to "Bazar". */
  name?: string;
};

type WordmarkProps = {
  className?: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  logo?: BrandLogo | null;
};

const sizeMap = {
  sm: "text-[18px]",
  md: "text-[22px]",
  lg: "text-[28px]",
};

/**
 * Fixed boxes rather than `h-8 w-auto`, for two reasons.
 *
 * The box reserves its space before the image decodes, so the header does not
 * reflow around the logo on first paint. And `media_assets` never records
 * width/height (no upload path fills those columns), so the intrinsic ratio is
 * not knowable server-side — `object-contain` inside a known box is what keeps
 * an unexpected aspect ratio letterboxed instead of stretched.
 *
 * A mark is boxed square; a full lockup gets a wide box and is pinned left so
 * a narrow logo does not float away from the nav.
 *
 * `md` is 44px inside the 72px header. The first pass used 32px, which was
 * timid on its own and looked far worse than that in practice: an export with
 * generous artboard padding spends most of the box on transparency, so the
 * visible glyph was about a third of the height it appeared to be allotted.
 * The padding itself is dealt with at upload (see the settings field's trim);
 * this is the size the trimmed art deserves.
 */
const logoBoxMap: Record<"sm" | "md" | "lg", string> = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

/**
 * A lockup keeps the same heights but sizes its width from the art. `min-w`
 * reserves a floor so the header does not jump when the image decodes, and
 * `max-w` stops an unexpectedly wide export from crowding the nav.
 */
const logoOnlyHeightMap: Record<"sm" | "md" | "lg", string> = {
  sm: "h-8 min-w-8 max-w-[140px]",
  md: "h-11 min-w-11 max-w-[190px]",
  lg: "h-14 min-w-14 max-w-[240px]",
};

/** Widest the logo ever gets, so the optimizer picks a sane variant. */
const logoSizesMap: Record<"sm" | "md" | "lg", string> = {
  sm: "140px",
  md: "190px",
  lg: "240px",
};

export function Wordmark({
  className,
  sublabel = "Abu Dhabi",
  size = "md",
  logo = null,
}: WordmarkProps) {
  const logoOnly = logo?.style === "logo_only";

  return (
    <div
      className={cn(
        // Logo and type share a baseline only when there is type to share it
        // with; a lone image has no baseline worth aligning and centres.
        "flex gap-2",
        logo && !logoOnly ? "items-center" : "items-baseline",
        logoOnly && "items-center",
        className,
      )}
    >
      {logo ? (
        logoOnly ? (
          // A lockup's width is whatever its art says. Pinning it to a fixed
          // wide box left a square mark stranded at the left of 190px of dead
          // space, which then shoved the centred nav off-centre; letting the
          // width follow the height keeps the slot honest for both shapes.
          // `min-w` still reserves enough to stop the row jumping on decode.
          <Image
            src={logo.url}
            alt={logo.name ?? "Bazar"}
            // Hints for the optimizer only — the CSS below decides the drawn
            // size, so no server-side knowledge of the real ratio is needed.
            width={480}
            height={120}
            sizes={logoSizesMap[size]}
            className={cn(
              "w-auto shrink-0 object-contain object-left",
              logoOnlyHeightMap[size],
            )}
            priority
          />
        ) : (
          <span
            className={cn("relative block shrink-0", logoBoxMap[size])}
          >
            <Image
              src={logo.url}
              // Decorative when the name is spelled out beside it — announcing
              // "Bazar" twice is noise for a screen reader.
              alt=""
              aria-hidden
              fill
              sizes={logoSizesMap[size]}
              className="object-contain object-center"
              priority
            />
          </span>
        )
      ) : null}

      {logoOnly ? null : (
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "serif italic font-normal tracking-tight leading-none",
              sizeMap[size],
            )}
          >
            Bazar
          </span>
          {sublabel ? (
            <span className="text-[12px] text-bz-muted tracking-wider leading-none">
              · {sublabel}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
