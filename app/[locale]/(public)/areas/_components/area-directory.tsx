import Link from "@/components/i18n/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { listAreaDirectory } from "@/lib/queries/area-profile";

/**
 * The complete area index — every area in the catalogue, alphabetical, with
 * its sub-communities and live listing counts.
 *
 * The card grid above it is a curated eight, so without this an area added in
 * the CMS has a working page that nothing links to. This section is generated
 * entirely from the database: create an area and it appears here, no editor
 * step in between.
 */
export async function AreaDirectory({
  eyebrow,
  heading,
  body,
}: {
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
}) {
  const entries = await listAreaDirectory();
  if (entries.length === 0) return null;

  return (
    <section className="px-4 py-14 md:px-12 md:py-20 border-t border-bz-border">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {heading ? (
        <h2
          className="serif mt-2 text-[28px] leading-tight md:text-[40px]"
          style={{ letterSpacing: "-0.022em" }}
        >
          {heading}
        </h2>
      ) : null}
      {body ? (
        <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-bz-ink-2">
          {body}
        </p>
      ) : null}

      <ul className="mt-9 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={`/areas/${entry.slug}`}
              className="group flex items-baseline justify-between gap-3 border-b border-bz-border pb-2 transition-colors hover:border-bz-border-strong"
            >
              <span className="text-[15px] text-bz-ink group-hover:text-bz-accent">
                {entry.name}
              </span>
              <span className="mono text-[11.5px] text-bz-muted">
                {entry.listingCount > 0 ? entry.listingCount : "—"}
              </span>
            </Link>
            {entry.children.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {entry.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/areas/${child.slug}`}
                      className="text-[12.5px] text-bz-ink-2 hover:text-bz-accent"
                    >
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
