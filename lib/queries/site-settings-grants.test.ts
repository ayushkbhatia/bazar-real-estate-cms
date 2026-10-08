import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `site_settings` is the one table read by the anon key through column grants
 * (0096 onward). Asking for a column anon can't see doesn't drop that column:
 * PostgREST fails the whole select, and the query layer reads that as "no row"
 * and answers from DEFAULTS. `getPublicSiteSettings` did exactly that for a
 * year because its list named `lead_routing` (docs/FOLLOWUPS.md). These specs
 * hold every anon read in lib/queries/site-settings.ts to the grant list.
 */

const root = process.cwd();
const source = readFileSync(join(root, "lib/queries/site-settings.ts"), "utf8");

/** Every column a migration grants anon on `public.site_settings`, minus any revoked after. */
function anonGrantedColumns(): Set<string> {
  const dir = join(root, "supabase/migrations");
  const granted = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, file), "utf8").replace(/--.*$/gm, "");
    const statements = sql.matchAll(/(grant|revoke)\s+select\s*\(([^)]*)\)\s*on\s+(?:table\s+)?public\.site_settings\s+(?:to|from)\s+([^;]+);/gi);
    for (const [, verb, cols, roles] of statements) {
      if (!/\banon\b/i.test(roles)) continue;
      for (const col of cols.split(",").map((c) => c.trim()).filter(Boolean)) {
        if (verb.toLowerCase() === "grant") granted.add(col);
        else granted.delete(col);
      }
    }
  }
  return granted;
}

function columns(list: string): string[] {
  return list.split(",").map((c) => c.trim()).filter(Boolean);
}

/** The column lists of every `.select(...)` in a function that uses the anon client. */
function anonSelects(): string[][] {
  const constants = new Map(
    [...source.matchAll(/const (\w+)\s*=\s*"([^"]+)";/g)].map(([, name, value]) => [name, value]),
  );
  return source
    .split(/\nexport async function /)
    .slice(1)
    .filter((chunk) => chunk.includes("createSupabasePublicClient()"))
    .flatMap((chunk) =>
      [...chunk.matchAll(/\.select\(\s*(?:"([^"]+)"|(\w+))\s*,?\s*\)/g)].map(([, literal, name]) => {
        const list = literal ?? constants.get(name!);
        expect(list, `select(${name}) names no string constant`).toBeDefined();
        return columns(list!);
      }),
    );
}

describe("anon reads of site_settings", () => {
  const granted = anonGrantedColumns();

  it("finds the grant list and the reads", () => {
    expect(granted.has("brand_name")).toBe(true);
    expect(anonSelects().length).toBeGreaterThanOrEqual(3);
  });

  it("names only columns anon is granted", () => {
    for (const list of anonSelects()) {
      for (const column of list) {
        expect(granted.has(column), `site_settings.${column} is not granted to anon`).toBe(true);
      }
    }
  });

  it("never grants lead_routing to anon: it carries staff user ids", () => {
    expect(granted.has("lead_routing")).toBe(false);
  });

  it("reads lead routing with the service-role client", () => {
    const chunk = source.split("export async function getLeadRoutingSettings")[1]?.split("\nexport ")[0] ?? "";
    expect(chunk).toContain("createAdminClient()");
    expect(chunk).not.toContain("createSupabasePublicClient()");
  });
});
