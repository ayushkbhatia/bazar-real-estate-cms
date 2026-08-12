/**
 * @vitest-environment node
 *
 * setPropertyFloorPlan / clearPropertyFloorPlan against a fake `property_media`
 * that enforces the real primary key (property_id, media_id). The listing shows
 * exactly one plan, so the invariant under test is "attaching replaces", and
 * that replacing never touches the gallery or the hero.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Link = {
  property_id: string;
  media_id: string;
  role: string;
  sort_order: number;
};

type Asset = {
  id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  alt_text: string | null;
  deleted_at: string | null;
};

const PROPERTY = "11111111-1111-4111-8111-111111111111";
const PLAN_OLD = "22222222-2222-4222-8222-222222222222";
const PLAN_NEW = "33333333-3333-4333-8333-333333333333";
const HERO = "44444444-4444-4444-8444-444444444444";
const PDF = "55555555-5555-4555-8555-555555555555";

const db: {
  property_media: Link[];
  media_assets: Asset[];
  properties: Record<string, unknown>[];
} = { property_media: [], media_assets: [], properties: [] };

function makeQuery(
  table: "property_media" | "media_assets" | "properties",
  kind: "select" | "update" | "insert" | "upsert" | "delete",
  payload?: Record<string, unknown>,
) {
  const filters: [string, string, unknown][] = [];

  function matches(row: Record<string, unknown>) {
    return filters.every(([op, col, val]) => {
      if (op === "in") return (val as unknown[]).includes(row[col]);
      if (op === "is") return row[col] === val;
      return row[col] === val;
    });
  }

  function run(single: boolean) {
    if (kind === "insert" || kind === "upsert") {
      const p = payload as unknown as Link;
      const existing = (db[table] as Link[]).find(
        (r) => r.property_id === p.property_id && r.media_id === p.media_id,
      );
      if (existing) {
        if (kind === "insert")
          return {
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "property_media_pkey"',
            },
          };
        Object.assign(existing, p);
        return { data: null, error: null };
      }
      (db[table] as Link[]).push({ ...p });
      return { data: null, error: null };
    }

    const rows = (db[table] as Record<string, unknown>[]).filter(matches);
    if (kind === "update") rows.forEach((r) => Object.assign(r, payload));
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
    is(col: string, val: unknown) {
      filters.push(["is", col, val]);
      return q;
    },
    in(col: string, val: unknown[]) {
      filters.push(["in", col, val]);
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
    from: (table: "property_media" | "media_assets" | "properties") => ({
      select: () => makeQuery(table, "select"),
      update: (payload: Record<string, unknown>) =>
        makeQuery(table, "update", payload),
      insert: (payload: Record<string, unknown>) =>
        makeQuery(table, "insert", payload),
      upsert: (payload: Record<string, unknown>) =>
        makeQuery(table, "upsert", payload),
      delete: () => makeQuery(table, "delete"),
    }),
  }),
}));

import { setPropertyFloorPlan, clearPropertyFloorPlan } from "./_actions";

function asset(id: string, over: Partial<Asset> = {}): Asset {
  return {
    id,
    storage_key: `listings/${id}.png`,
    filename: `${id}.png`,
    mime_type: "image/png",
    alt_text: null,
    deleted_at: null,
    ...over,
  };
}

const planLinks = () =>
  db.property_media.filter((l) => l.role === "floor_plan").map((l) => l.media_id);

beforeEach(() => {
  db.property_media = [
    { property_id: PROPERTY, media_id: HERO, role: "hero", sort_order: 0 },
    {
      property_id: PROPERTY,
      media_id: PLAN_OLD,
      role: "floor_plan",
      sort_order: 0,
    },
  ];
  db.media_assets = [
    asset(PLAN_OLD),
    asset(PLAN_NEW),
    asset(HERO),
    asset(PDF, { mime_type: "application/pdf", filename: "plan.pdf" }),
  ];
  db.properties = [
    {
      id: PROPERTY,
      slug: "mamsha-3-bed",
      reference: "BAZ-AD-04891",
      status: "published",
    },
  ];
});

describe("setPropertyFloorPlan", () => {
  it("replaces the existing plan rather than adding a second one", async () => {
    const res = await setPropertyFloorPlan(PROPERTY, PLAN_NEW);
    expect(res.status).toBe("ok");
    expect(planLinks()).toEqual([PLAN_NEW]);
  });

  it("leaves the gallery and the hero alone when replacing", async () => {
    await setPropertyFloorPlan(PROPERTY, PLAN_NEW);
    expect(
      db.property_media.find((l) => l.media_id === HERO)?.role,
    ).toBe("hero");
  });

  it("returns the attached asset so the card can render it without a refetch", async () => {
    const res = await setPropertyFloorPlan(PROPERTY, PLAN_NEW);
    expect(res.status === "ok" && res.media).toEqual({
      id: PLAN_NEW,
      storage_key: `listings/${PLAN_NEW}.png`,
      alt_text: null,
    });
  });

  it("is idempotent when the same plan is re-attached", async () => {
    const res = await setPropertyFloorPlan(PROPERTY, PLAN_OLD);
    expect(res.status).toBe("ok");
    expect(planLinks()).toEqual([PLAN_OLD]);
    expect(db.property_media).toHaveLength(2);
  });

  it("refuses a non-image — the public page renders the plan with next/image", async () => {
    const res = await setPropertyFloorPlan(PROPERTY, PDF);
    expect(res.status).toBe("error");
    expect(planLinks()).toEqual([PLAN_OLD]);
  });

  it("refuses a photo already attached in another role, instead of stealing it", async () => {
    const res = await setPropertyFloorPlan(PROPERTY, HERO);
    expect(res.status).toBe("error");
    expect(db.property_media.find((l) => l.media_id === HERO)?.role).toBe(
      "hero",
    );
    expect(planLinks()).toEqual([PLAN_OLD]);
  });

  it("rejects a malformed id before touching the database", async () => {
    const res = await setPropertyFloorPlan(PROPERTY, "not-a-uuid");
    expect(res).toEqual({ status: "error", message: "Invalid id." });
    expect(planLinks()).toEqual([PLAN_OLD]);
  });
});

describe("clearPropertyFloorPlan", () => {
  it("drops the link but keeps the asset in the shared library", async () => {
    const res = await clearPropertyFloorPlan(PROPERTY);
    expect(res.status).toBe("ok");
    expect(planLinks()).toEqual([]);
    expect(db.media_assets.some((a) => a.id === PLAN_OLD)).toBe(true);
  });

  it("leaves the rest of the listing's media attached", async () => {
    await clearPropertyFloorPlan(PROPERTY);
    expect(db.property_media.map((l) => l.media_id)).toEqual([HERO]);
  });
});
