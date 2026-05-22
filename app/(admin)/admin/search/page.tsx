import Link from "next/link";
import { redirect } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { Eyebrow } from "@/components/brand/eyebrow";

type SearchResult =
  | { kind: "property"; id: string; title: string; reference: string; slug: string; subtitle: string }
  | { kind: "enquiry"; id: string; title: string; subtitle: string };

async function search(q: string): Promise<SearchResult[]> {
  if (!isSupabaseConfigured || !q.trim()) return [];
  const supabase = await createSupabaseServerClient();
  const like = `%${q.trim()}%`;

  const [propsRes, enqRes] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, reference, slug, short_description")
      .or(
        `title.ilike.${like},reference.ilike.${like},short_description.ilike.${like}`,
      )
      .is("deleted_at", null)
      .limit(20),
    supabase
      .from("enquiries")
      .select("id, name, email, phone, brief_raw")
      .or(`name.ilike.${like},email.ilike.${like},brief_raw.ilike.${like}`)
      .limit(20),
  ]);

  const results: SearchResult[] = [];
  for (const p of propsRes.data ?? []) {
    results.push({
      kind: "property",
      id: p.id,
      title: p.title,
      reference: p.reference,
      slug: p.slug,
      subtitle: p.short_description ?? "",
    });
  }
  for (const e of enqRes.data ?? []) {
    results.push({
      kind: "enquiry",
      id: e.id,
      title: e.name,
      subtitle: e.email ?? e.brief_raw?.slice(0, 80) ?? "",
    });
  }
  return results;
}

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/admin");
  const params = await searchParams;
  const q = params.q ?? "";
  const results = await search(q);

  const properties = results.filter((r) => r.kind === "property");
  const enquiries = results.filter((r) => r.kind === "enquiry");

  return (
    <CmsShell title="Search" breadcrumbs="Admin">
      <div className="max-w-[920px]">
        <Eyebrow>Results</Eyebrow>
        <h2
          className="serif text-[28px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.012em" }}
        >
          {q ? (
            <>
              <span className="font-mono text-[20px] text-bz-muted">
                &quot;{q}&quot;
              </span>{" "}
              · {results.length} {results.length === 1 ? "match" : "matches"}
            </>
          ) : (
            "Type a query to search."
          )}
        </h2>

        {q && results.length === 0 ? (
          <p className="mt-8 text-[14px] text-bz-muted">
            No matches. Sprint 12 swaps to Meilisearch — fuzzier and faster.
          </p>
        ) : null}

        {properties.length > 0 ? (
          <section className="mt-10">
            <Eyebrow>Properties · {properties.length}</Eyebrow>
            <ul className="mt-3 flex flex-col gap-1">
              {properties.map((r) =>
                r.kind === "property" ? (
                  <li key={r.id}>
                    <Link
                      href={`/admin/properties/${r.id}`}
                      className="block rounded-md border border-bz-border bg-bz-surface px-4 py-3 hover:border-bz-border-strong transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[14px] text-bz-ink">
                          {r.title}
                        </span>
                        <span className="mono text-[11px] text-bz-muted">
                          {r.reference}
                        </span>
                      </div>
                      {r.subtitle ? (
                        <div className="text-[12.5px] text-bz-muted mt-1 line-clamp-1">
                          {r.subtitle}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        ) : null}

        {enquiries.length > 0 ? (
          <section className="mt-10">
            <Eyebrow>Enquiries · {enquiries.length}</Eyebrow>
            <ul className="mt-3 flex flex-col gap-1">
              {enquiries.map((r) =>
                r.kind === "enquiry" ? (
                  <li key={r.id}>
                    <Link
                      href={`/admin/enquiries/${r.id}`}
                      className="block rounded-md border border-bz-border bg-bz-surface px-4 py-3 hover:border-bz-border-strong transition-colors"
                    >
                      <div className="text-[14px] text-bz-ink">{r.title}</div>
                      {r.subtitle ? (
                        <div className="text-[12.5px] text-bz-muted mt-1 line-clamp-1">
                          {r.subtitle}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        ) : null}
      </div>
    </CmsShell>
  );
}
