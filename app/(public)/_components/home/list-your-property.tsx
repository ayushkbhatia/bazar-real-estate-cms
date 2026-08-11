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

        {/* Photo.
            `minmax(0,…)` on the tracks above plus `min-w-0` on the form column
            stop the form's min-content width from collapsing this track to a
            sliver between 768px and ~1024px. `overflow-hidden` here (rather
            than relying on the card's) is what actually clips the absolutely
            positioned <Image> — WebKit does not reliably clip an abspos
            descendant against an ancestor's border-radius, which is why the
            bleed only showed once a real photo replaced PlaceholderImage
            (that component brings its own `overflow-hidden`). */}
        <div className="relative isolate min-w-0 aspect-[16/10] overflow-hidden bg-bz-ink md:aspect-auto md:h-full">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? ""}
              fill
              sizes="(max-width: 767px) 100vw, 48vw"
              className="absolute inset-0 h-full w-full object-cover"
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
