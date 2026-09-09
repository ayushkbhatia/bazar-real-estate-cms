import { Eyebrow } from "@/components/brand/eyebrow";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { listAmenitiesTaxonomyForAdmin } from "@/lib/queries/amenities-taxonomy";
import { AMENITY_CATEGORY_LABELS } from "@/lib/schemas/amenity-taxonomy";
import {
  AmenityActiveToggle,
  AmenityArabicField,
  AddAmenityForm,
} from "./_form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsFieldsPage() {
  const taxonomy = await listAmenitiesTaxonomyForAdmin();

  /**
   * Arabic coverage, counted over the entries that can actually be picked.
   * Inactive rows are excluded on purpose: they exist so a historical code on
   * an old listing still resolves, and counting them would make the pass look
   * permanently unfinished.
   */
  const selectable = taxonomy.filter((e) => e.active !== false);
  const withArabic = selectable.filter(
    (e) => (e.label_ar ?? "").trim() !== "",
  ).length;

  const grouped = new Map<string, typeof taxonomy>();
  for (const entry of taxonomy) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-[860px]">
        <Eyebrow>Property fields</Eyebrow>
        <h1
          className="serif text-[32px] mt-2 font-normal leading-tight"
          style={{ letterSpacing: "-0.018em" }}
        >
          Amenities taxonomy.
        </h1>
        <p className="mt-3 text-[14px] text-bz-muted leading-relaxed">
          The canonical vocabulary that backs the amenities picker on the
          property editor and the amenity facet on /buy + /rent. Click the
          status label on any row to deactivate; deactivated entries stay
          in the table (so existing listings still resolve their codes)
          but drop out of new toggles and the public facet.
        </p>
        <p className="mt-3 text-[14px] text-bz-muted leading-relaxed">
          The Arabic box under each label is what the property page prints on
          /ar. A listing stores the English word, so this table is the only
          place an amenity&rsquo;s Arabic can live — including for anything an
          agent adds from the property editor, which lands here with the box
          empty. Type into it and it saves; press Escape to undo. Where a
          greyed-out suggestion appears, it is the site-wide Arabic already
          held for that English — <span className="mono">use</span> adopts it.
        </p>
        <p className="mt-3 text-[13px] text-bz-muted">
          Arabic filled:{" "}
          <span className="mono text-bz-ink tabular-nums">
            {withArabic} of {selectable.length}
          </span>{" "}
          selectable amenities.
        </p>
      </header>

      {Array.from(grouped.entries()).map(([category, entries]) => (
        <section key={category}>
          <Eyebrow>
            {AMENITY_CATEGORY_LABELS[
              category as keyof typeof AMENITY_CATEGORY_LABELS
            ] ?? category}{" "}
            · {entries.length}
          </Eyebrow>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {entries
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((e) => (
                <li
                  key={e.code}
                  className="rounded-md border border-bz-border bg-bz-surface px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-bz-ink truncate">
                        {e.label}
                      </div>
                      <div className="mono text-[10.5px] text-bz-muted mt-0.5">
                        {e.code}
                      </div>
                    </div>
                    <AmenityActiveToggle
                      code={e.code}
                      active={e.active ?? true}
                    />
                  </div>
                  <AmenityArabicField
                    code={e.code}
                    initial={e.label_ar ?? null}
                    suggestion={arabicFor(e.label)}
                  />
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section>
        <Eyebrow>Add a new amenity</Eyebrow>
        <p className="mt-2 text-[13px] text-bz-muted max-w-[60ch]">
          Codes are immutable once a listing toggles them on. Pick a
          short snake_case identifier; the label is what the property
          editor + public facet display, and the Arabic is what /ar
          prints in its place.
        </p>
        <AddAmenityForm />
      </section>

      <section className="border-t border-bz-border pt-6 text-[12.5px] text-bz-muted">
        Total entries: <span className="mono text-bz-ink">{taxonomy.length}</span> ·
        sourced from{" "}
        <span className="mono text-bz-ink">amenities_taxonomy</span> when the
        DB layer is wired; otherwise from{" "}
        <span className="mono text-bz-ink">DEFAULT_AMENITIES</span> in
        <span className="mono text-bz-ink"> lib/schemas/amenity-taxonomy.ts</span>.
      </section>
    </div>
  );
}
