import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

type Props = {
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLabel?: string | null;
  caption?: string | null;
  tall?: boolean;
};

/**
 * A single full-width photograph.
 *
 * `fill` plus an explicit `sizes` rather than intrinsic dimensions, because
 * `media_assets.width`/`height` are never written — no upload path fills them —
 * so there is no height to lay out against. The wrapper owns the ratio instead.
 */
export function ImageBand({
  imageUrl,
  imageAlt,
  imageLabel,
  caption,
  tall,
}: Props) {
  return (
    <section className="px-4 md:px-12 py-8 md:py-12">
      <figure className="max-w-[1200px]">
        <div
          className="relative isolate w-full overflow-hidden rounded-xl bg-bz-surface-2"
          style={{ height: tall ? 480 : 280 }}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? ""}
              fill
              sizes="(max-width: 767px) 100vw, 1200px"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <PlaceholderImage
              label={imageLabel ?? "photograph"}
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
        {caption ? (
          <figcaption className="mt-3 text-[12.5px] text-bz-muted max-w-[62ch]">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    </section>
  );
}
