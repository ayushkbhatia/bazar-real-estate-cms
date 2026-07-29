/**
 * @vitest-environment node
 *
 * Blog row lifecycle against a fake `articles` table. The rules worth pinning:
 * trash is reversible, permanent delete is only reachable from the trash, and
 * un-archiving returns a post to draft rather than straight back to live.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Article = {
  id: string;
  title: string;
  slug: string;
  status: string;
  deleted_at: string | null;
};

const db: { articles: Article[] } = { articles: [] };
const { roleSpy } = vi.hoisted(() => ({ roleSpy: vi.fn() }));

function makeQuery(kind: "select" | "update" | "delete", payload?: object) {
  const filters: [string, string, unknown][] = [];
  const matches = (row: Record<string, unknown>) =>
    filters.every(([op, col, val]) =>
      op === "eq"
        ? row[col] === val
        : op === "is"
          ? row[col] === val
          : row[col] !== val,
    );

  function run(single: boolean) {
    const rows = db.articles.filter(matches as (a: Article) => boolean);
    if (kind === "update") rows.forEach((r) => Object.assign(r, payload));
    if (kind === "delete") {
      db.articles = db.articles.filter(
        (r) => !matches(r as unknown as Record<string, unknown>),
      );
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
    not(col: string, _op: string, val: unknown) {
      filters.push(["not", col, val]);
      return q;
    },
    select() {
      return q;
    },
    maybeSingle() {
      return Promise.resolve(run(true));
    },
    then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
      return Promise.resolve(run(false)).then(res, rej);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/auth", () => ({
  requireRole: (...args: unknown[]) => roleSpy(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      select: () => makeQuery("select"),
      update: (payload: object) => makeQuery("update", payload),
      delete: () => makeQuery("delete"),
    }),
  }),
}));

import {
  deleteArticlePermanently,
  restoreArticle,
  setArticleArchived,
  trashArticle,
} from "./_actions";

const POST: Article = {
  id: "a-1",
  title: "Saadiyat closed Q1 up 8.4%",
  slug: "saadiyat-q1",
  status: "published",
  deleted_at: null,
};

beforeEach(() => {
  db.articles = [{ ...POST }];
  roleSpy.mockReset().mockResolvedValue({});
});

describe("trash", () => {
  it("soft-deletes and can be restored", async () => {
    const trashed = await trashArticle("a-1");
    expect(trashed.status).toBe("ok");
    expect(db.articles[0].deleted_at).not.toBeNull();
    // The row survives — trash is a filter, not a delete.
    expect(db.articles).toHaveLength(1);
    // Status is untouched, so a restored post comes back as it was.
    expect(db.articles[0].status).toBe("published");

    const restored = await restoreArticle("a-1");
    expect(restored.status).toBe("ok");
    expect(db.articles[0].deleted_at).toBeNull();
  });

  it("refuses to trash something already in the trash", async () => {
    await trashArticle("a-1");
    const again = await trashArticle("a-1");
    expect(again.status).toBe("error");
    expect(again.message).toMatch(/already in the trash/i);
  });

  it("reports a missing article rather than silently succeeding", async () => {
    const res = await trashArticle("nope");
    expect(res.status).toBe("error");
  });
});

describe("archive", () => {
  it("archives, and un-archiving returns to draft rather than live", async () => {
    const archived = await setArticleArchived("a-1", true);
    expect(archived.status).toBe("ok");
    expect(db.articles[0].status).toBe("archived");

    const back = await setArticleArchived("a-1", false);
    expect(back.status).toBe("ok");
    // Going live again should be deliberate, not a side effect of undo.
    expect(db.articles[0].status).toBe("draft");
  });

  it("is a no-op when already in that state", async () => {
    await setArticleArchived("a-1", true);
    const again = await setArticleArchived("a-1", true);
    expect(again.status).toBe("error");
  });
});

describe("permanent delete", () => {
  it("only works from the trash", async () => {
    const tooSoon = await deleteArticlePermanently("a-1");
    expect(tooSoon.status).toBe("error");
    expect(tooSoon.message).toMatch(/trash first/i);
    expect(db.articles).toHaveLength(1);

    await trashArticle("a-1");
    const gone = await deleteArticlePermanently("a-1");
    expect(gone.status).toBe("ok");
    expect(db.articles).toHaveLength(0);
  });

  it("is gated to admins", async () => {
    await trashArticle("a-1");
    roleSpy.mockClear();
    await deleteArticlePermanently("a-1");
    expect(roleSpy).toHaveBeenCalledWith(["admin"]);
  });
});
