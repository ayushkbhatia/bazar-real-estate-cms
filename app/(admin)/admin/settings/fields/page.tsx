import { Eyebrow } from "@/components/brand/eyebrow";
import { listAmenitiesTaxonomy } from "@/lib/queries/amenities-taxonomy";
import { AMENITY_CATEGORY_LABELS } from "@/lib/schemas/amenity-taxonomy";

export const dynamic = "force-dynamic";

export default async function AdminSettingsFieldsPage() {
  const taxonomy = await listAmenitiesTaxonomy();

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
          The canonical vocabulary that backs the 21-toggle grid on the
          property editor and the amenity facet on /buy + /rent. Edits land
          via a future admin form; this view reads the live taxonomy and
          flags entries marked inactive.
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
          <ul className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {entries
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((e) => (
                <li
                  key={e.code}
                  className="rounded-md border border-bz-border bg-bz-surface px-3 py-2.5 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-bz-ink truncate">
                      {e.label}
                    </div>
                    <div className="mono text-[10.5px] text-bz-muted mt-0.5">
                      {e.code}
                    </div>
                  </div>
                  {e.active ? null : (
                    <span className="text-[10px] mono text-bz-muted bg-bz-surface-2 px-1.5 py-0.5 rounded">
                      inactive
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}

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
