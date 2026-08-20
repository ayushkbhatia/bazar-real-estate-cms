/**
 * Reading the hero search bar — for the home page, and for /admin/forms.
 *
 * The public read goes through the cookie-free client for the reason master
 * pages and forms already do: touching `cookies()` would push the home page
 * out of ISR into fully dynamic rendering, and the home page is the one that
 * can least afford it.
 *
 * Every public path is failure-tolerant by construction. A missing table, an
 * unapplied migration, an unconfigured environment or a dead database all
 * resolve to the registry, which is the bar as it renders today. There is no
 * error branch a visitor can reach: the worst case is that the CMS edits are
 * not applied yet.
 */

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import type { Database, Json } from "@/db/types";
import { isMissingTableError } from "@/lib/queries/forms";
import {
  SEARCH_BAR_COPY_ALL_KEYS,
  SEARCH_BAR_KEY,
  defaultResolvedSearchBar,
  localiseSearchBar,
  resolveSearchBar,
  type ResolvedSearchBar,
  type SearchBarCopy,
  type SearchBarType,
  type StoredSearchBar,
  type StoredSearchBarTab,
} from "@/lib/search-bar";

const BAR_COLUMNS = "id, key, copy";
const TAB_COLUMNS =
  "id, bar_id, key, label, label_ar, route, placeholder, placeholder_ar, types, beds, size_max, size_step, price_max, price_step, enabled, position";

/*
 * Pick from the generated Row rather than using it whole: the selects above
 * name their columns, so PostgREST hands back a narrower object and a full
 * `Row` here would type `created_at` as present on something that has no such
 * key. Derived from the table type either way, so a renamed column still
 * fails the build.
 */
type BarRow = Pick<
  Database["public"]["Tables"]["search_bar"]["Row"],
  "id" | "key" | "copy"
>;
type TabRow = Omit<
  Database["public"]["Tables"]["search_bar_tabs"]["Row"],
  "created_at" | "updated_at"
>;

/**
 * jsonb → the copy bag, keeping only keys the registry declares.
 *
 * Rebuilt key by key from `SEARCH_BAR_COPY_ALL_KEYS` rather than spread, so a
 * key retired from the registry stops rendering instead of lingering as a
 * string nothing can edit — and so a hand-written row cannot inject one.
 */
function parseCopy(value: Json | null): Partial<SearchBarCopy> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const out: Record<string, string | null> = {};
  for (const key of SEARCH_BAR_COPY_ALL_KEYS) {
    const entry = record[key];
    if (typeof entry === "string") out[key] = entry;
  }
  return out as Partial<SearchBarCopy>;
}

/**
 * jsonb → the type dropdown, dropping anything malformed rather than throwing.
 *
 * Same posture as `parseOptions` on the forms side, and `label_ar` is named
 * here on purpose: rebuilding key by key is what destroyed the field-level
 * twins in #390, and the fix was to name the twin, not to spread the object.
 */
function parseTypes(value: Json | null): SearchBarType[] {
  if (!Array.isArray(value)) return [];
  const out: SearchBarType[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label : null;
    const type = typeof record.value === "string" ? record.value : null;
    if (!label || !type) continue;
    out.push({
      value: type,
      label,
      label_ar: typeof record.label_ar === "string" ? record.label_ar : null,
    });
  }
  return out;
}

function toStoredTab(row: TabRow): StoredSearchBarTab {
  return {
    key: row.key,
    label: row.label,
    label_ar: row.label_ar,
    route: row.route,
    placeholder: row.placeholder,
    placeholder_ar: row.placeholder_ar,
    types: parseTypes(row.types),
    beds: row.beds,
    size:
      row.size_max != null && row.size_step != null
        ? { max: row.size_max, step: row.size_step }
        : null,
    price: { max: row.price_max, step: row.price_step },
    enabled: row.enabled,
    position: row.position,
  };
}

function toStoredBar(row: BarRow): StoredSearchBar {
  return { key: row.key, copy: parseCopy(row.copy) };
}

type Loaded = { bar: StoredSearchBar | null; tabs: StoredSearchBarTab[] | null };

const EMPTY: Loaded = { bar: null, tabs: null };

/**
 * One read per request, whatever asks. `cache` rather than a module-level
 * memo so a long-lived server process cannot serve one request's rows to the
 * next — the same reason `loadAll` in `lib/queries/forms.ts` uses it.
 */
const load = cache(async (): Promise<Loaded> => {
  if (!isSupabaseConfigured) return EMPTY;
  try {
    const supabase = createSupabasePublicClient();
    const { data: barRow, error: barError } = await supabase
      .from("search_bar")
      .select(BAR_COLUMNS)
      .eq("key", SEARCH_BAR_KEY)
      .maybeSingle();
    if (barError) {
      if (!isMissingTableError(barError))
        console.error("[search-bar] failed to load", barError);
      return EMPTY;
    }
    if (!barRow) return EMPTY;

    const { data: tabRows, error: tabError } = await supabase
      .from("search_bar_tabs")
      .select(TAB_COLUMNS)
      .eq("bar_id", barRow.id)
      .order("position", { ascending: true });
    if (tabError) {
      console.error("[search-bar] failed to load tabs", tabError);
      // The bar's copy is still good; the tabs fall back to the registry.
      return { bar: toStoredBar(barRow), tabs: null };
    }

    return {
      bar: toStoredBar(barRow),
      tabs: (tabRows ?? []).map(toStoredTab),
    };
  } catch (error) {
    console.error("[search-bar] failed to load", error);
    return EMPTY;
  }
});

/** The effective search bar for a public page. Never throws, never null. */
export async function getSearchBar(): Promise<ResolvedSearchBar> {
  const { bar, tabs } = await load();
  const locale = await currentLocale();
  return localiseSearchBar(resolveSearchBar(bar, tabs), locale);
}

// ── admin ────────────────────────────────────────────────────────────────

export type AdminSearchBar = {
  bar: ResolvedSearchBar;
  missingTable: boolean;
  error: string | null;
};

/**
 * The bar with whatever is stored against it, read through the caller's
 * authenticated client so the staff policy applies.
 *
 * Deliberately NOT localised: the editor has to see both languages, or it
 * renders blank Arabic inputs over stored content and writes the blanks back
 * on save.
 */
export async function getSearchBarForAdmin(
  supabase: SupabaseClient<Database>,
): Promise<AdminSearchBar> {
  const fallback = (missingTable: boolean, error: string | null): AdminSearchBar => ({
    bar: defaultResolvedSearchBar(),
    missingTable,
    error,
  });

  if (!isSupabaseConfigured) return fallback(false, null);

  const { data: barRow, error: barError } = await supabase
    .from("search_bar")
    .select(BAR_COLUMNS)
    .eq("key", SEARCH_BAR_KEY)
    .maybeSingle();
  if (barError)
    return fallback(isMissingTableError(barError), isMissingTableError(barError) ? null : barError.message);
  if (!barRow) return fallback(false, null);

  const { data: tabRows, error: tabError } = await supabase
    .from("search_bar_tabs")
    .select(TAB_COLUMNS)
    .eq("bar_id", barRow.id)
    .order("position", { ascending: true });
  if (tabError)
    return fallback(isMissingTableError(tabError), isMissingTableError(tabError) ? null : tabError.message);

  return {
    bar: resolveSearchBar(toStoredBar(barRow), (tabRows ?? []).map(toStoredTab)),
    missingTable: false,
    error: null,
  };
}
