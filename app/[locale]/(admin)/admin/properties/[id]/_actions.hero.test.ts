/**
 * @vitest-environment node
 *
 * setPropertyHero against a fake `property_media` that enforces the real
 * primary key (property_id, media_id) — the constraint the old
 * delete-then-insert implementation tripped over.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Link = {
  property_id: string;
  media_id: string;
  role: string;
  sort_order: number;
};

const PROPERTY = "p-1";

const db: { property_media: Link[]; properties: Record<string, unknown>[] } = {
  property_media: [],
  properties: [],
};

const { insertSpy } = vi.hoisted(() => ({ insertSpy: vi.fn() }));

function makeQuery(
  table: "property_media" | "properties",
  kind: "select" | "update" | "insert" | "delete",
  payload?: Record<string, unknown>,
) {
  const filters: [string, string, unknown][] = [];

  function matches(row: Record<string, unknown>) {
    return filters.every(([op, col, val]) =>
      op === "eq" ? row[col] === val : row[col] !== val,
    );
  }

  function run(single: boolean) {
    if (kind === "insert") {
      const p = payload as unknown as Link;
      insertSpy(p);
      const clash = (db[table] as Link[]).some(
        (r) => r.property_id === p.property_id && r.media_id === p.media_id,
      );
      if (clash) {
        return {
          data: null,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "property_media_pkey"',
          },
        };
      }
      (db[table] as Link[]).push({ ...p });
      return { data: null, error: null };
    }

    const rows = (db[table] as Record<string, unknown>[]).filter(matches);
    if (kind === "update") {
      rows.forEach((r) => Object.assign(r, payload));
    }
    if (kind === "delete") {
      db[table] = (db[table] as Record<string, unknown>[]).filter(
        (r) => !matches(r),
      ) as never;
    }
    const copies = rows.map((r) => ({ ...r }));
    return { data: single ? (copies[0] ?? null) : copies, error: null };
  }

  const q = {
    eq(col: string, val: unknown) {
      filters.push(["eq", col, val]);
      return q;
    },
    neq(col: string, val: unknown) {
      filters.push(["neq", col, val]);
      return q;
    },
    select() {
      return q;
    },
    order() {
      return q;
    },
    limit() {
      return q;
    },
    maybeSingle() {
      return Promise.resolve(run(true));
    },
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      return Promise.resolve(run(false)).then(resolve, reject);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: true,
  isMapboxConfigured: false,
  env: {},
}));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/queries/properties", () => ({ propertyUrl: () => "/p/x" }));
vi.mock("@/lib/media", () => ({
  ALLOWED_MIME: [],
  MAX_UPLOAD_BYTES: 1,
  MEDIA_BUCKET: "media",
  storageKey: () => "k",
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: "property_media" | "properties") => ({
      select: () => makeQuery(table, "select"),
      update: (payload: Record<string, unknown>) =>
        makeQuery(table, "update", payload),
      insert: (payload: Record<string, unknown>) =>
        makeQuery(table, "insert", payload),
      delete: () => makeQuery(table, "delete"),
    }),
  }),
}));

import { setPropertyHero } from "./_actions";

function seed(links: Link[]) {
  db.property_media = links.map((l) => ({ ...l }));
  db.properties = [
    {
      id: PROPERTY,
      slug: "mamsha-3-bed",
      reference: "BAZ-AD-04891",
      status: "published",
    },
  ];
}

const heroOf = () =>
  db.property_media.filter((l) => l.role === "hero").map((l) => l.media_id);

describe("setPropertyHero", () => {
  beforeEach(() => {
    insertSpy.mockReset();
    seed([
      { property_id: PROPERTY, media_id: "m-hero", role: "hero", sort_order: 0 },
      { property_id: PROPERTY, media_id: "m-2", role: "gallery", sort_order: 1 },
      { property_id: PROPERTY, media_id: "m-3", role: "gallery", sort_order: 2 },
    ]);
  });

  it("promotes an already-attached photo without hitting property_media_pkey", async () => {
    const res = await setPropertyHero(PROPERTY, "m-2");
    expect(res).toEqual({ status: "ok", message: "Hero set." });
    expect(heroOf()).toEqual(["m-2"]);
    // Role swap, not a re-link.
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("demotes the outgoing hero to the gallery instead of detaching it", async () => {
    await setPropertyHero(PROPERTY, "m-2");
    const outgoing = db.property_media.find((l) => l.media_id === "m-hero");
    expect(outgoing).toBeDefined();
    expect(outgoing?.role).toBe("gallery");
    // Nothing lost from the listing.
    expect(db.property_media).toHaveLength(3);
    // And it keeps its place in the order.
    expect(outgoing?.sort_order).toBe(0);
  });

  it("is a no-op when the chosen photo is already the hero", async () => {
    const res = await setPropertyHero(PROPERTY, "m-hero");
    expect(res.status).toBe("ok");
    expect(heroOf()).toEqual(["m-hero"]);
    expect(db.property_media).toHaveLength(3);
  });

  it("links a photo that isn't attached to the listing yet", async () => {
    const res = await setPropertyHero(PROPERTY, "m-new");
    expect(res.status).toBe("ok");
    expect(heroOf()).toEqual(["m-new"]);
    expect(db.property_media).toHaveLength(4);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  it("clears the hero without unlinking the photo", async () => {
    const res = await setPropertyHero(PROPERTY, null);
    expect(res).toEqual({ status: "ok", message: "Hero removed." });
    expect(heroOf()).toEqual([]);
    expect(db.property_media).toHaveLength(3);
    expect(
      db.property_media.find((l) => l.media_id === "m-hero")?.role,
    ).toBe("gallery");
  });
});
