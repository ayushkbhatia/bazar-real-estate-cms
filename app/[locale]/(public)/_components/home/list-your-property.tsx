import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import type { ResolvedForm } from "@/lib/forms/types";
import { FormRenderer } from "../forms/form-renderer";
import type { SectionCopy } from "./section-copy";

/**
 * Home / Areas "List your property" (handoff §4). Split card: lead-gen form +
 * photo. The fields, their order, the button and the confirmation come from
 * the Forms Manager (`/admin/forms`); the card around them is page copy and
 * stays in Pages & blocks. Submits through `submitForm`, which files it as an
 * enquiry exactly as this card always did.
 *
 * A server component now — the state it used to hold moved into
 * `FormRenderer` along with the inputs.
 */
export function ListYourProperty({
  form,
  eyebrow = "List your property",
  heading = "List your property",
  body = "Looking to sell or rent? We'll handle the process for you.",
  imageUrl,
  imageAlt,
  imageLabel,
}: SectionCopy & {
  form: ResolvedForm;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLabel?: string | null;
}) {
  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      <div className="grid overflow-hidden rounded-2xl border border-bz-border bg-bz-surface md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Form */}
        <div className="min-w-0 p-6 md:p-14">
          <div
            className="text-[11px] font-medium uppercase text-bz-accent"
            style={{ letterSpacing: "0.12em" }}
          >
            {eyebrow}
          </div>
          <h2 className="serif mt-2 text-[32px] md:text-[40px] font-normal leading-[1.05] tracking-tight">
            {heading}
          </h2>
          <p className="mt-3 max-w-[44ch] text-[14.5px] text-bz-ink-2 leading-relaxed">
            {body}
          </p>

          <FormRenderer form={form} className="mt-8" />
        </div>

        {/* Artwork.
            `minmax(0,…)` on the tracks above plus `min-w-0` on the form column
            stop the form's min-content width from collapsing this track to a
            sliver between 768px and ~1024px. `overflow-hidden` here (rather
            than relying on the card's) is what actually clips the absolutely
            positioned <Image> — WebKit does not reliably clip an abspos
            descendant against an ancestor's border-radius, which is why the
            bleed only showed once a real picture replaced PlaceholderImage
            (that component brings its own `overflow-hidden`).

            `object-contain`, not `cover`: what the client ships here is a
            typeset poster — the headline, the portal logos and the phone are
            *inside* the picture. The track is about 1.05:1 (its height comes
            from the form beside it) while the artwork is 4:3, so `cover` scaled
            it to fill and threw ~14% off each side, beheading the headline on
            the leading edge. Contain fits the whole artwork; `bg-bz-surface`
            (the card's own colour, not ink) turns the leftover band above and
            below into card whitespace rather than black bars. The Arabic twin
            is a second copy of the same artboard with the type set in Arabic,
            so it needs exactly the same treatment — and under `dir="rtl"` the
            tracks swap, which is why nothing here pins a side. */}
        <div className="relative isolate min-w-0 aspect-[4/3] overflow-hidden bg-bz-surface md:aspect-auto md:h-full">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? ""}
              fill
              sizes="(max-width: 767px) 100vw, 48vw"
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <PlaceholderImage
              label={imageLabel ?? "agent handing over keys"}
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
      </div>
    </section>
  );
}
