import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { cn } from "@/lib/utils";
import type { MasterPlanPin } from "@/lib/schemas/development";

/**
 * The site plan with its numbered pins — the figure inside a project page's
 * "Master plan" band.
 *
 * Lifted out of `developments/[slug]/page.tsx` so a campaign page built in the
 * Page Builder draws the same plan the same way; the band around it (eyebrow,
 * heading, padding) stays with each caller, because the project page and a
 * landing page space their sections differently.
 *
 * Pins are placed in percentages of the frame, which is why the image is
 * `object-cover` in a fixed-ratio box: the coordinates an editor clicked are
 * coordinates on this frame, not on the source file.
 */
export function MasterPlanFigure({
  image,
  placeholderLabel,
  pins,
  className,
}: {
  image: { url: string; alt: string } | null;
  /** Drawn in place of a missing plan. Callers that would rather show
   *  nothing don't render the figure at all. */
  placeholderLabel: string;
  pins: MasterPlanPin[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mt-6 rounded-lg overflow-hidden aspect-[21/9] bg-bz-surface-2",
        className,
      )}
    >
      {image ? (
        <Image
          src={image.url}
          alt={image.alt}
          fill
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <PlaceholderImage
          label={placeholderLabel}
          className="absolute inset-0 w-full h-full"
        />
      )}
      {pins.map((pin) => (
        <div
          key={pin.key}
          className="absolute"
          style={{
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-9 h-9 rounded-full bg-bz-accent text-white flex items-center justify-center text-[15px] font-semibold serif shadow-[0_4px_12px_rgba(0,0,0,.3)]">
            {pin.key}
          </div>
          <div className="absolute start-11 top-1.5 whitespace-nowrap bg-white/95 px-2.5 py-1 rounded text-[11px] font-medium text-bz-ink">
            {pin.label}
          </div>
        </div>
      ))}
    </div>
  );
}
