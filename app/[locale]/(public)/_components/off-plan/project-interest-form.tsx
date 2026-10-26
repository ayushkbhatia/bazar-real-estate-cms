import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import type { OffplanProjectOption } from "@/lib/queries/offplan-map";
import type { ResolvedForm } from "@/lib/forms/types";
import { FormRenderer } from "../forms/form-renderer";

/**
 * New Projects "Register your interest" lead form. A project-specific cousin
 * of the home "List your property" card: the visitor picks a live off-plan
 * project (or "Not sure yet"), and the enquiry is filed against that
 * development so an advisor can follow up with availability, floor plans and
 * payment plans.
 *
 * The project dropdown is the one field whose options aren't editable — they
 * are the launches on file, resolved here and handed to the renderer, so a
 * project going live appears in the list without anyone touching the CMS.
 */
export async function ProjectInterestForm({
  form,
  projects,
  imageUrl,
  imageAlt,
  imageLabel,
  eyebrow,
  heading,
  body,
}: {
  form: ResolvedForm;
  /** The card's words, from the off-plan master page; blank keeps the catalogue's. */
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
  projects: OffplanProjectOption[];
  /** Resolved URL of the asset picked in the master-page editor. */
  imageUrl?: string | null;
  imageAlt?: string | null;
  /** Caption for the placeholder art, used when no asset is picked. */
  imageLabel?: string | null;
}) {
  const t = await getTranslations("pages.offPlan");
  const projectOptions = projects.map((p) => ({
    label: p.areaName ? `${p.name} — ${p.areaName}` : p.name,
    value: p.id,
  }));

  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      <div className="grid overflow-hidden rounded-2xl border border-bz-border bg-bz-surface md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Form */}
        <div className="min-w-0 p-6 md:p-14">
          <div
            className="text-[11px] font-medium uppercase text-bz-accent"
            style={{ letterSpacing: "0.12em" }}
          >
            {eyebrow ?? t("interestEyebrow")}
          </div>
          <h2 className="serif mt-2 text-[32px] md:text-[40px] font-normal leading-[1.05] tracking-tight">
            {heading ?? t("interestHeading")}
          </h2>
          <p className="mt-3 max-w-[46ch] text-[14.5px] text-bz-ink-2 leading-relaxed">
            {body ?? t("interestBody")}
          </p>

          <FormRenderer
            form={form}
            dynamicOptions={{ project: projectOptions }}
            className="mt-8"
          />
        </div>

        {/* Photo.
            `overflow-hidden` and the ratio live here rather than on the card,
            for the same reason as home/list-your-property: WebKit does not
            reliably clip an absolutely-positioned <Image> against an
            ancestor's border-radius, and PlaceholderImage brings its own
            clipping — so the bleed only appears once a real photo is picked,
            which is exactly what this change makes possible.

            FIRST ON A PHONE, and shown whole. The card is a two-column grid
            that stacks in SOURCE order below `md`, and the source puts the
            form first because it holds the leading track on desktop — so a
            phone visitor met an 893px column of inputs before seeing what the
            card was about. `order-first md:order-none` moves it without
            touching the DOM order, so the desktop split is unchanged and the
            RTL mirror is too (`order` resolves against the grid, not a side).
            Same fix as the list-your-property band.

            And `object-contain` at every width, in a 4/3 box below `md` —
            the home list-your-property treatment. What the client ships here
            is a typeset poster (1760×1328, ~4:3) with the headline and the
            "Register your interest" button *inside* the picture. `cover` in
            the desktop column (taller than wide, its height set by the form)
            trimmed the leading edge off the headline; a square box on a phone
            letterboxed it against black. Contain fits the whole artwork, and
            `bg-bz-surface` (the card's own colour, not ink) turns the band
            left over around it into card whitespace rather than black bars.
            Nothing pins a side, so the RTL mirror needs nothing. */}
        <div className="relative isolate order-first min-w-0 aspect-[4/3] overflow-hidden bg-bz-surface md:order-none md:aspect-auto md:h-full">
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
              label={imageLabel ?? "off-plan development · architectural render"}
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
      </div>
    </section>
  );
}
