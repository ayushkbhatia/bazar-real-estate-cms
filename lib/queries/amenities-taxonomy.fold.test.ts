/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import type { Locale } from "@/lib/i18n/locales";
import { expectFolds, expectNoTwinsLeak } from "@/lib/i18n/fold-harness";

/**
 * Proof that `amenities_taxonomy.label` reaches a reader in Arabic.
 *
 * The column was grandfathered into `fold-proofs.test.ts` because a
 * `localiseDeep` call sat in the reader — and that call was worse than none.
 * `properties.amenities` stores English LABELS, so folding the taxonomy's
 * `label` on `/ar` did not translate the property page's grid, it broke the
 * join that feeds it: nothing matched, `amenityLabel` returned its own input,
 * and the grid printed English. A fold that runs, type-checks, and makes the
 * output *worse* is precisely the failure `expectFolds` exists to catch, and
 * nothing caught it for the length of the epic.
 *
 * So the reader under test here is the pair, not the query alone: the query
 * carries the twin in `label_ar` and never touches `label`, and `amenityLabel`
 * picks between them. `read()` returns the rendered strings — what a visitor
 * sees — which is also what keeps `expectNoTwinsLeak` honest, since the
 * options array legitimately carries `label_ar` on its way there.
 */

let rows: Record<string, unknown>[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/i18n/arabic-store", () => ({
  // The store is the LAST resort, and a spec that let it answer would pass
  // whether or not the column was read at all.
  arabicFor: () => null,
}));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      const proxy = new Proxy(chain, {
        get(_t, prop: string) {
          if (prop === "then")
            return (res: (v: unknown) => unknown) =>
              Promise.resolve({ data: rows, error: null }).then(res);
          return () => proxy;
        },
      });
      return proxy;
    },
  }),
}));

import { listAmenitiesTaxonomy } from "./amenities-taxonomy";
import { amenityLabel, toOptions } from "@/lib/amenities";

function row(over: Record<string, unknown> = {}) {
  return {
    code: "sea_vieww",
    label: "Sea View",
    label_ar: "إطلالة على البحر",
    category: "view",
    icon: null,
    sort_order: 0,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

/** What the property page prints for one stored amenity, at one locale. */
async function renderStored(stored: string, locale: Locale): Promise<string> {
  const options = toOptions(await listAmenitiesTaxonomy());
  return amenityLabel(stored, options, { locale });
}

describe("amenities_taxonomy.label folds on the public read path", () => {
  it("renders the twin under ar and the English under en", async () => {
    rows = [row()];
    await expectFolds({
      read: (locale) => renderStored("Sea View", locale),
      pick: (shown) => shown,
      english: "Sea View",
      arabic: "إطلالة على البحر",
      what: "amenities_taxonomy.label",
    });
  });

  it("keeps `label` English so the stored value still matches on /ar", async () => {
    rows = [row()];
    const options = toOptions(await listAmenitiesTaxonomy());
    // The identity half. `properties.amenities` holds "Sea View"; if the
    // reader folded `label`, this lookup would miss and the grid would fall
    // back to printing the raw English — the bug in FOLLOWUPS.
    expect(options[0]?.label).toBe("Sea View");
    expect(options[0]?.label_ar).toBe("إطلالة على البحر");
  });

  it("leaves the English showing when the row has no twin", async () => {
    rows = [row({ label_ar: null })];
    expect(await renderStored("Sea View", "ar" as Locale)).toBe("Sea View");
    expect(await renderStored("Sea View", "en" as Locale)).toBe("Sea View");
  });

  it("never hands a renderer an `_ar` key", async () => {
    rows = [row()];
    expectNoTwinsLeak(
      await renderStored("Sea View", "ar" as Locale),
      "amenity grid (ar)",
    );
  });
});
