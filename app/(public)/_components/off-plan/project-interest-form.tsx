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
export function ProjectInterestForm({
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
            Register your interest
          </div>
          <h2 className="serif mt-2 text-[32px] md:text-[40px] font-normal leading-[1.05] tracking-tight">
            Interested in a new project?
          </h2>
          <p className="mt-3 max-w-[46ch] text-[14.5px] text-bz-ink-2 leading-relaxed">
            Tell us which launch caught your eye — an advisor will share
            availability, floor plans, and payment plans.
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
            which is exactly what this change makes possible. */}
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
              label={imageLabel ?? "off-plan development · architectural render"}
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
      </div>
    </section>
  );
}
