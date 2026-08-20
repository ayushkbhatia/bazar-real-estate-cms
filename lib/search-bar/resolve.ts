/**
 * Registry defaults ⊕ what an editor stored ⇒ what renders.
 *
 * The same contract as `lib/forms/resolve.ts`, and deliberately the same
 * asymmetry between the two halves:
 *
 *  - **Copy merges key by key.** Absent means "not overridden", so a label
 *    added to `SEARCH_BAR_COPY_KEYS` next month needs no backfill, and
 *    "revert to default" is deleting a key rather than guessing a string.
 *  - **Tabs replace wholesale.** Once an editor has saved a tab list, that
 *    list is the truth: a registry tab they retired stays retired, one they
 *    invented is kept, and the order is theirs. Merging by key instead would
 *    resurrect a deleted tab on the next deploy that touched the registry.
 *
 * Any failure upstream — missing table, unapplied migration, no env, dead
 * database — arrives here as nulls and resolves to the registry, which is the
 * bar as it renders today. The failure mode is "the CMS edits don't apply
 * yet", never "the home page has no search".
 */

import { defaultSearchBar } from "./registry";
import { SEARCH_BAR_COPY_KEYS, copyArKey } from "./copy-keys";
import type {
  ResolvedSearchBar,
  SearchBarCopy,
  SearchBarDef,
  SearchBarTab,
  StoredSearchBar,
  StoredSearchBarTab,
} from "./types";

function blank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

/**
 * Built from `SEARCH_BAR_COPY_KEYS`, never hand-listed — the same discipline
 * `lib/forms/copy-keys.ts` documents, for the same reason.
 */
export function mergeCopy(
  base: SearchBarCopy,
  stored: Partial<SearchBarCopy> | null | undefined,
): SearchBarCopy {
  const out: Record<string, string | null> = {};
  for (const { key } of SEARCH_BAR_COPY_KEYS) {
    const ar = copyArKey(key);
    out[key] = blank(stored?.[key]) ? base[key] : (stored![key] as string).trim();
    out[ar] = blank(stored?.[ar]) ? base[ar] : (stored![ar] as string).trim();
  }
  return out as SearchBarCopy;
}

/** Stored rows in the editor's order, or the registry list when there are none. */
export function mergeTabs(
  def: SearchBarDef,
  stored: StoredSearchBarTab[] | null | undefined,
): SearchBarTab[] {
  if (!stored || stored.length === 0) return def.tabs;
  return [...stored]
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...tab }) => tab);
}

export function resolveSearchBar(
  stored: StoredSearchBar | null,
  storedTabs: StoredSearchBarTab[] | null,
): ResolvedSearchBar {
  const def = defaultSearchBar();
  return {
    key: def.key,
    def,
    copy: mergeCopy(def.copy, stored?.copy),
    tabs: mergeTabs(def, storedTabs),
    usingDefaults: !stored && !(storedTabs && storedTabs.length > 0),
  };
}

/** The registry, resolved — what every failure path falls back to. */
export function defaultResolvedSearchBar(): ResolvedSearchBar {
  return resolveSearchBar(null, null);
}

/**
 * The tabs a visitor is actually offered.
 *
 * An editor may switch a tab off, but not all of them: a search bar with no
 * tabs is not a smaller search bar, it is a broken one, and the same rule that
 * re-attaches a locked form field applies here. The registry list is restored
 * rather than the page rendering an empty tablist.
 */
export function activeTabs(bar: ResolvedSearchBar): SearchBarTab[] {
  const on = bar.tabs.filter((tab) => tab.enabled);
  return on.length > 0 ? on : bar.def.tabs;
}
