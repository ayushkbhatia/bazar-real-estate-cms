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
}: {
  form: ResolvedForm;
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
            {t("interestEyebrow")}
          </div>
          <h2 className="serif mt-2 text-[32px] md:text-[40px] font-normal leading-[1.05] tracking-tight">
            {t("interestHeading")}
          </h2>
          <p className="mt-3 max-w-[46ch] text-[14.5px] text-bz-ink-2 leading-relaxed">
            {t("interestBody")}
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

            And `object-contain` in a square box below `md`, not `cover` in a
            16/10 one: the render the client picked is 1536×1536, so a 16/10
            crop was cutting 37% of its height off — the top and bottom of the
            building. Contain never crops whatever ratio is uploaded next,
            which is the property being asked for here; a wide render simply
            sits letterboxed against the ink ground rather than being trimmed.
            `cover` from `md`, where the photo fills a full-height column. */}
        <div className="relative isolate order-first min-w-0 aspect-square overflow-hidden bg-bz-ink md:order-none md:aspect-auto md:h-full">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? ""}
              fill
              sizes="(max-width: 767px) 100vw, 48vw"
              className="absolute inset-0 h-full w-full object-contain md:object-cover"
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
