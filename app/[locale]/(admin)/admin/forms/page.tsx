import Link from "next/link";
import { CmsShell } from "@/components/brand/cms-shell";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth";
import { listFormsForAdmin, type AdminFormSummary } from "@/lib/queries/forms";
import { FORM_GROUP_LABELS, type FormGroup } from "@/lib/forms/types";
import { SEARCH_BAR_DEF } from "@/lib/search-bar";

export const dynamic = "force-dynamic";

const FORM_ROLES = ["admin", "editor", "marketing"] as const;

const GROUP_ORDER: FormGroup[] = ["master", "sub", "dialog"];

function relative(iso: string | null): string {
  if (!iso) return "no responses yet";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  const days = Math.floor(diff / day);
  if (days < 1) return "last response today";
  if (days < 2) return "last response yesterday";
  if (days < 30) return `last response ${days}d ago`;
  if (days < 365) return `last response ${Math.floor(days / 30)}mo ago`;
  return `last response ${Math.floor(days / 365)}y ago`;
}

function FormCard({ row }: { row: AdminFormSummary }) {
  const { def, form } = row;
  const fieldCount = form.fields.filter((f) => f.enabled).length;

  return (
    <li>
      <Link
        href={`/admin/forms/${def.key}`}
        className="flex h-full flex-col gap-1.5 rounded-lg border border-bz-border bg-bz-surface p-4 hover:border-bz-accent transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13.5px] font-medium leading-snug">
            {def.name}
          </span>
          <span
            className={cn(
              "shrink-0 inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
              form.enabled
                ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                : "bg-bz-surface-2 text-bz-ink-2",
            )}
          >
            {form.enabled ? "Live" : "Off"}
          </span>
        </div>
        <span className="mono text-[11px] text-bz-muted">
          {def.surface} · {def.path}
        </span>
        <p className="text-[12px] text-bz-muted-2 leading-relaxed line-clamp-2">
          {def.description}
        </p>
        <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-bz-muted-2">
          <span>
            {fieldCount} {fieldCount === 1 ? "field" : "fields"}
          </span>
          <span>·</span>
          <span>
            {row.submissions} {row.submissions === 1 ? "response" : "responses"}
          </span>
          {row.newSubmissions > 0 ? (
            <span className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-bz-accent-soft text-bz-accent text-[10.5px] font-medium">
              {row.newSubmissions} new
            </span>
          ) : null}
          <span>·</span>
          <span>{relative(row.lastSubmissionAt)}</span>
        </div>
      </Link>
    </li>
  );
}

/**
 * Forms Manager — every lead-capture form on the site, in one place.
 *
 * Sibling to Pages & blocks, and split from it on a clear line: a page owns
 * the words around a form, this owns the form. What that buys is the thing
 * Pages & blocks could never offer — the fields themselves, their types and
 * their order — plus one place to see what each form has actually collected.
 *
 * The list is driven by the registry rather than by the table, so every form
 * appears from the first day, showing its built-in defaults, whether or not
 * anyone has saved anything against it.
 */
export default async function AdminFormsPage() {
  const { supabase } = await requireRole(FORM_ROLES);
  const { rows, missingTable, error } = await listFormsForAdmin(supabase);

  const live = rows.filter((r) => r.form.enabled).length;
  const totalResponses = rows.reduce((sum, r) => sum + r.submissions, 0);
  const unread = rows.reduce((sum, r) => sum + r.newSubmissions, 0);

  return (
    <CmsShell title="Forms" breadcrumbs="Content · Forms">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[14px] font-medium">
            Every form on the site, in one place
          </h2>
          <p className="text-[13px] text-bz-muted max-w-[74ch] mt-1">
            What each form asks, in what order, what its button says, what the
            visitor sees afterwards — and everything it has collected. The
            headings and pictures <em>around</em> a form stay in Pages &amp;
            blocks; each form links to its section there.
          </p>
        </div>

        {missingTable ? (
          <p className="text-[13px] rounded border border-bz-border bg-bz-surface p-3">
            The forms tables aren&apos;t there yet. Apply migration{" "}
            <code className="mono">0094_forms_manager.sql</code> and reload —
            until then this page shows each form&apos;s built-in setup, and the
            public site renders exactly that.
          </p>
        ) : error ? (
          <p className="text-[13px] rounded border border-bz-border bg-bz-surface p-3">
            Couldn&apos;t load saved settings — {error}. The forms below are the
            built-in ones; the public site is unaffected.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-bz-muted-2">
            <span>
              <span className="mono text-bz-ink">{live}</span> of{" "}
              <span className="mono text-bz-ink">{rows.length}</span> live
            </span>
            <span>
              <span className="mono text-bz-ink">{totalResponses}</span>{" "}
              responses logged
            </span>
            {unread > 0 ? (
              <span>
                <span className="mono text-bz-ink">{unread}</span> unread
              </span>
            ) : null}
          </div>
        )}

        {/*
          Not a form, and deliberately not listed as one.
          The hero search bar captures nothing, files no lead and has no
          responses — giving it a card in the grid above would promise an
          editor a Responses tab that can never fill. Its own section says
          what it is instead.
        */}
        <section className="flex flex-col gap-3">
          <h3 className="eyebrow">Search</h3>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <li>
              <Link
                href="/admin/forms/search-bar"
                className="flex h-full flex-col gap-1.5 rounded-lg border border-bz-border bg-bz-surface p-4 hover:border-bz-accent transition-colors"
              >
                <span className="text-[13.5px] font-medium leading-snug">
                  {SEARCH_BAR_DEF.name}
                </span>
                <span className="mono text-[11px] text-bz-muted">
                  {SEARCH_BAR_DEF.surface} · {SEARCH_BAR_DEF.path}
                </span>
                <p className="text-[12px] text-bz-muted-2 leading-relaxed line-clamp-2">
                  {SEARCH_BAR_DEF.description}
                </p>
                <div className="mt-auto pt-2 text-[11.5px] text-bz-muted-2">
                  {SEARCH_BAR_DEF.tabs.length} tabs · searches, doesn&apos;t
                  collect
                </div>
              </Link>
            </li>
          </ul>
        </section>

        {GROUP_ORDER.map((group) => {
          const groupRows = rows.filter((r) => r.def.group === group);
          if (groupRows.length === 0) return null;
          return (
            <section key={group} className="flex flex-col gap-3">
              <h3 className="eyebrow">{FORM_GROUP_LABELS[group]}</h3>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {groupRows.map((row) => (
                  <FormCard key={row.def.key} row={row} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </CmsShell>
  );
}
