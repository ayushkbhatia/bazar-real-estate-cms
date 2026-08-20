import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CmsShell } from "@/components/brand/cms-shell";
import { requireRole } from "@/lib/auth";
import { getSearchBarForAdmin } from "@/lib/queries/search-bar";
import { SEARCH_BAR_COPY_KEYS } from "@/lib/search-bar";
import { SearchBarEditor } from "./_editor";

export const dynamic = "force-dynamic";

const SEARCH_BAR_ROLES = ["admin", "editor", "marketing"] as const;

/**
 * The home hero's search bar, as its own section of the Forms Manager.
 *
 * Sibling to a form rather than one of them: it captures nothing and files no
 * lead, so it has no responses tab and no notification list. What it shares is
 * the shape — registry defaults, an editor's overrides, an Arabic twin beside
 * every English box.
 */
export default async function AdminSearchBarPage() {
  const { supabase } = await requireRole(SEARCH_BAR_ROLES);
  const detail = await getSearchBarForAdmin(supabase);

  /*
   * The English each label falls back to when the override is blank, read from
   * the catalogue rather than retyped here. The editor shows them as the
   * inputs' placeholders, which is what makes "clear the box to revert" a
   * visible affordance instead of a piece of folklore.
   */
  const t = await getTranslations({ locale: "en", namespace: "search" });
  const defaults = Object.fromEntries(
    SEARCH_BAR_COPY_KEYS.map(({ key, message }) => [key, t(message)]),
  ) as Record<string, string>;

  return (
    <CmsShell
      title={detail.bar.def.name}
      breadcrumbs={
        <>
          <Link href="/admin/forms" className="hover:text-bz-ink">
            Forms
          </Link>
          {" · "}
          {detail.bar.def.surface}
        </>
      }
    >
      {detail.missingTable ? (
        <p className="mb-5 text-[13px] rounded border border-bz-border bg-bz-surface p-3">
          The search-bar tables aren&apos;t there yet. Apply migration{" "}
          <code className="mono">0111_search_bar.sql</code> and reload —
          everything below is the bar&apos;s built-in setup, which is exactly
          what the home page is rendering, and saving won&apos;t work until the
          migration lands.
        </p>
      ) : detail.error ? (
        <p className="mb-5 text-[13px] rounded border border-bz-border bg-bz-surface p-3">
          Couldn&apos;t load saved settings — {detail.error}. Editing below
          would overwrite whatever is stored, so reload before changing
          anything.
        </p>
      ) : null}

      <SearchBarEditor bar={detail.bar} defaults={defaults} />
    </CmsShell>
  );
}
