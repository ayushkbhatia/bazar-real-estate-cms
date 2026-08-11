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
 */
const logoBoxMap: Record<"sm" | "md" | "lg", Record<LogoStyle, string>> = {
  sm: { mark_and_name: "h-6 w-6", logo_only: "h-6 w-[120px]" },
  md: { mark_and_name: "h-8 w-8", logo_only: "h-8 w-[160px]" },
  lg: { mark_and_name: "h-10 w-10", logo_only: "h-10 w-[200px]" },
};

/** Widest the box ever gets, so the optimizer picks a sane variant. */
const logoSizesMap: Record<"sm" | "md" | "lg", string> = {
  sm: "120px",
  md: "160px",
  lg: "200px",
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
        <span
          className={cn(
            "relative block shrink-0",
            logoBoxMap[size][logo.style],
          )}
        >
          <Image
            src={logo.url}
            // Decorative when the name is spelled out beside it — announcing
            // "Bazar" twice is noise for a screen reader.
            alt={logoOnly ? (logo.name ?? "Bazar") : ""}
            aria-hidden={logoOnly ? undefined : true}
            fill
            sizes={logoSizesMap[size]}
            className={cn(
              "object-contain",
              logoOnly ? "object-left" : "object-center",
            )}
            priority
          />
        </span>
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
