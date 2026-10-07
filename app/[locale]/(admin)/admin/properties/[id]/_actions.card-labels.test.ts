/**
 * @vitest-environment node
 *
 * setPropertyCardLabels on a listing published from Salesforce: the two
 * built-in labels are Salesforce's checkboxes (guide v1.3), so ticking one
 * here is refused rather than saved and quietly reverted by the next sync.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db: Record<"properties" | "salesforce_listings", Row[]> = { properties: [], salesforce_listings: [] };
const updates: Row[] = [];

function query(table: keyof typeof db, payload?: Row) {
  const filters: [string, unknown][] = [];
  const rows = () => db[table].filter((r) => filters.every(([c, v]) => r[c] === v));
  const q = {
    select: () => q,
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return q;
    },
    maybeSingle: async () => {
      if (payload) {
        rows().forEach((r) => Object.assign(r, payload));
        updates.push(payload);
      }
      return { data: rows()[0] ?? null, error: null };
    },
    then(resolve: (v: unknown) => unknown) {
      if (payload) {
        rows().forEach((r) => Object.assign(r, payload));
        updates.push(payload);
      }
      return Promise.resolve({ data: rows(), error: null }).then(resolve);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/i18n/revalidate", () => ({ revalidateLocalised: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, isMapboxConfigured: false, env: {} }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/queries/properties", () => ({ propertyUrl: () => "/p/x" }));
vi.mock("@/lib/media", () => ({ ALLOWED_MIME: [], MAX_UPLOAD_BYTES: 1, MEDIA_BUCKET: "media", storageKey: () => "k" }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: keyof typeof db) => ({
      select: () => query(table),
      update: (payload: Row) => query(table, payload),
    }),
  }),
}));

import { setPropertyCardLabels } from "./_actions";

const PROPERTY = "p-1";
const SF = "a03iy000000XI30AAG";

function seed(snapshot: Row | null) {
  updates.length = 0;
  db.properties = [
    {
      id: PROPERTY,
      slug: "villa",
      salesforce_listing_id: snapshot ? SF : null,
      flags: { exclusive: true, vacant_on_transfer: false, labels: ["new_launch"] },
    },
  ];
  db.salesforce_listings = snapshot ? [{ sf_listing_id: SF, snapshot, unresolved: {} }] : [];
}

describe("setPropertyCardLabels on a Salesforce listing", () => {
  beforeEach(() => seed({ v: 3, listingId: SF, title: "Villa", exclusive: true, vacantOnTransfer: false }));

  it("refuses to tick a built-in label Salesforce has unticked", async () => {
    const res = await setPropertyCardLabels(PROPERTY, ["exclusive", "vacant_on_transfer", "new_launch"]);
    expect(res).toEqual({
      status: "error",
      message: "Vacant on transfer comes from Salesforce on this listing. Tick it there; the website follows on the next sync.",
    });
    expect(updates).toEqual([]);
  });

  it("refuses to untick one Salesforce has ticked", async () => {
    const res = await setPropertyCardLabels(PROPERTY, ["new_launch"]);
    expect(res.status).toBe("error");
    expect(res.status === "error" && res.message).toContain("Exclusive comes from Salesforce");
  });

  it("saves the website's own labels around Salesforce's", async () => {
    const res = await setPropertyCardLabels(PROPERTY, ["exclusive", "new_launch", "price_drop"]);
    expect(res).toEqual({ status: "ok" });
    expect(db.properties[0].flags).toMatchObject({ exclusive: true, labels: ["exclusive", "new_launch", "price_drop"] });
  });

  it("leaves a label alone when Salesforce cannot say (the field hidden)", async () => {
    seed({ v: 3, listingId: SF, title: "Villa", exclusive: null, vacantOnTransfer: null });
    const res = await setPropertyCardLabels(PROPERTY, ["vacant_on_transfer"]);
    expect(res).toEqual({ status: "ok" });
  });

  it("does not apply to a listing the CMS owns", async () => {
    seed(null);
    expect(await setPropertyCardLabels(PROPERTY, ["vacant_on_transfer"])).toEqual({ status: "ok" });
  });
});
