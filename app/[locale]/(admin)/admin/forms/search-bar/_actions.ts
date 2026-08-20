"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isMissingTableError } from "@/lib/queries/forms";
import {
  SEARCH_BAR_COPY_KEYS,
  SEARCH_BAR_KEY,
  copyArKey,
  defaultSearchBar,
} from "@/lib/search-bar";
import type { SearchBarTab } from "@/lib/search-bar";
import {
  searchBarSaveSchema,
  type SearchBarSaveInput,
} from "@/lib/schemas/search-bar";

const SEARCH_BAR_ROLES = ["admin", "editor", "marketing"] as const;

export type SaveSearchBarResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

const MISSING_TABLE =
  "The search-bar tables aren't there yet — apply migration 0111_search_bar.sql and reload. The home page keeps rendering its built-in tabs until then.";

function orNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Save the whole bar: the copy overrides and the ordered tab list.
 *
 * A whole-bar save rather than per-tab writes, for the reason `saveForm`
 * documents: order is a property of the list and the editor is holding all of
 * it, so reconciling here keeps "what I see is what is live" true when a tab
 * was reordered, another relabelled and a third deleted in one sitting.
 */
export async function saveSearchBar(
  raw: SearchBarSaveInput,
): Promise<SaveSearchBarResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const { supabase } = await requireRole(SEARCH_BAR_ROLES);

  const parsed = searchBarSaveSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields.",
      issues: parsed.error.issues.map((issue) => {
        const row = typeof issue.path[1] === "number" ? issue.path[1] + 1 : null;
        return row ? `Tab ${row}: ${issue.message}` : issue.message;
      }),
    };
  }

  const input = parsed.data;
  if (input.key !== SEARCH_BAR_KEY)
    return { status: "error", message: `Unknown search bar "${input.key}".` };

  const { data: existing, error: readError } = await supabase
    .from("search_bar")
    .select("id, copy")
    .eq("key", input.key)
    .maybeSingle();
  if (readError) {
    return {
      status: "error",
      message: isMissingTableError(readError) ? MISSING_TABLE : readError.message,
    };
  }

  /*
   * Built from `SEARCH_BAR_COPY_KEYS`, not hand-listed. This object REPLACES
   * the stored bag, so a key missing here is destroyed on every save —
   * docs/I18N.md names that as the trap, and deriving the list is what stops
   * it being one. Blank means "not overridden", which is what hands the label
   * back to the message catalogue.
   */
  const copy = Object.fromEntries(
    SEARCH_BAR_COPY_KEYS.flatMap(({ key }) => [
      [key, orNull((input.copy as Record<string, string | null>)[key])],
      [
        copyArKey(key),
        orNull((input.copy as Record<string, string | null>)[copyArKey(key)]),
      ],
    ]),
  );

  const row = { key: input.key, copy: copy as never };

  const { data: saved, error: writeError } = existing
    ? await supabase
        .from("search_bar")
        .update(row)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("search_bar").insert(row).select("id").maybeSingle();

  if (writeError || !saved) {
    return {
      status: "error",
      message: isMissingTableError(writeError)
        ? MISSING_TABLE
        : (writeError?.message ?? "Couldn't save the search bar."),
    };
  }

  // Replace rather than reconcile: the list is four rows, the editor sent all
  // of it, and a delete-then-insert can't leave a stale tab behind or trip the
  // (bar_id, key) unique index when two tabs swapped keys.
  const { error: clearError } = await supabase
    .from("search_bar_tabs")
    .delete()
    .eq("bar_id", saved.id);
  if (clearError) return { status: "error", message: clearError.message };

  const tabRows = input.tabs.map((tab, index) => ({
    bar_id: saved.id,
    key: tab.key,
    label: tab.label,
    label_ar: tab.label_ar,
    route: tab.route,
    placeholder: tab.placeholder,
    placeholder_ar: tab.placeholder_ar,
    types: tab.types as never,
    beds: tab.beds,
    // A tab shows beds or a size slider, never both — the row keeps only the
    // one its `beds` flag admits, so flipping the toggle back and forth can't
    // leave an invisible scale that reappears later.
    size_max: tab.beds ? null : (tab.size?.max ?? null),
    size_step: tab.beds ? null : (tab.size?.step ?? null),
    price_max: tab.price.max,
    price_step: tab.price.step,
    enabled: tab.enabled,
    position: (index + 1) * 10,
  }));

  const { error: insertError } = await supabase
    .from("search_bar_tabs")
    .insert(tabRows);
  if (insertError) return { status: "error", message: insertError.message };

  await logAudit({
    action: "search_bar.save",
    target_kind: "search_bar",
    target_id: input.key,
    after: {
      tabs: input.tabs.length,
      enabled_tabs: input.tabs.filter((t) => t.enabled).length,
    },
  });

  revalidateFor();
  return { status: "ok", message: "Saved." };
}

/** Back to the registry defaults: delete the row, and the tabs with it. */
export async function resetSearchBar(): Promise<SaveSearchBarResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { supabase } = await requireRole(SEARCH_BAR_ROLES);

  // `search_bar_tabs.bar_id` cascades, so one delete clears both.
  const { error } = await supabase
    .from("search_bar")
    .delete()
    .eq("key", SEARCH_BAR_KEY);
  if (error) {
    return {
      status: "error",
      message: isMissingTableError(error) ? MISSING_TABLE : error.message,
    };
  }

  await logAudit({
    action: "search_bar.reset",
    target_kind: "search_bar",
    target_id: SEARCH_BAR_KEY,
    after: { restored: "registry defaults" },
  });

  revalidateFor();
  return { status: "ok", message: "Reverted to the built-in search bar." };
}

/** The registry's tabs, for the editor's "revert" affordance. */
export async function registryTabs(): Promise<SearchBarTab[]> {
  return defaultSearchBar().tabs;
}

/**
 * The bar sits on the home page, and the home page is a layout-level
 * revalidation away in both locales — `revalidateLocalised("/")` alone would
 * leave the other language serving the old labels.
 */
function revalidateFor() {
  revalidatePath("/admin/forms");
  revalidatePath("/admin/forms/search-bar");
  revalidateLocalised("/", "layout");
}
