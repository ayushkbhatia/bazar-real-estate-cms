/**
 * @vitest-environment node
 *
 * setPropertyCardLabels on a draft that came from Salesforce: the website owns
 * it (0166), so the two built-in labels Salesforce ticked are the editor's to
 * change like any other — and unticking one has to clear its legacy boolean,
 * which the card would otherwise still read as a tick.
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

describe("setPropertyCardLabels on a Salesforce draft", () => {
  beforeEach(() => seed({ v: 3, listingId: SF, title: "Villa", exclusive: true, vacantOnTransfer: false }));

  it("unticks a built-in label Salesforce ticked, legacy boolean and all", async () => {
    const res = await setPropertyCardLabels(PROPERTY, ["new_launch"]);
    expect(res).toEqual({ status: "ok" });
    expect(db.properties[0].flags).toEqual({ exclusive: false, vacant_on_transfer: false, labels: ["new_launch"] });
  });

  it("ticks one Salesforce left unticked", async () => {
    const res = await setPropertyCardLabels(PROPERTY, ["exclusive", "vacant_on_transfer"]);
    expect(res).toEqual({ status: "ok" });
    expect(db.properties[0].flags).toMatchObject({ exclusive: true, vacant_on_transfer: true });
  });

  it("keeps the rest of the bag", async () => {
    db.properties[0].flags = { exclusive: true, feature_on_homepage: true, labels: [] };
    await setPropertyCardLabels(PROPERTY, ["exclusive"]);
    expect(db.properties[0].flags).toMatchObject({ feature_on_homepage: true, exclusive: true, labels: ["exclusive"] });
  });
});
