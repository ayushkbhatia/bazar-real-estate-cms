import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { landingAdminUrl, landingUrl } from "./landing-pages";

const root = process.cwd();
const querySource = readFileSync(
  join(root, "lib/queries/landing-pages.ts"),
  "utf8",
);
const actionSource = readFileSync(
  join(root, "app/[locale]/(admin)/admin/page-builder/_actions.ts"),
  "utf8",
);
const usageSource = readFileSync(
  join(root, "lib/queries/media-usage.ts"),
  "utf8",
);

/** The `PUBLIC_FIELDS = "..."` string, as written. */
function constant(source: string, name: string): string {
  const match = source.match(
    new RegExp(`const ${name}\\s*(?::[^=]+)?=\\s*([\\s\\S]*?);`),
  );
  expect(match, `couldn't find ${name}`).not.toBeNull();
  return match![1];
}

describe("the public select", () => {
  it("never names draft_blocks", () => {
    // Two reasons, and the second is the one that bites quietly. Obviously it
    // would leak unpublished copy. Less obviously, an over-wide public select
    // is how getPublicSiteSettings silently fell back to DEFAULTS for a year
    // (docs/FOLLOWUPS.md:803) — PostgREST fails the *whole* select, not one
    // field, and the query layer reads that as "no row".
    expect(constant(querySource, "PUBLIC_FIELDS")).not.toContain("draft");
  });

  it("still selects everything the public renderer needs", () => {
    const fields = constant(querySource, "PUBLIC_FIELDS");
    for (const field of [
      "slug",
      "title",
      "status",
      "noindex",
      "blocks",
      "seo",
    ]) {
      expect(fields).toContain(field);
    }
  });

  it("filters soft-deleted rows on every public read", () => {
    const publicReads = querySource
      .split("export async function ")
      .slice(1)
      .filter((chunk) => chunk.includes("createSupabasePublicClient()"));
    expect(publicReads.length).toBeGreaterThan(0);
    for (const chunk of publicReads) {
      expect(chunk, chunk.slice(0, 60)).toContain('.is("deleted_at", null)');
    }
  });

  it("bounds the prerender window", () => {
    // An unbounded generateStaticParams would run every landing page's data
    // fan-out at build — three times per CI run, against production.
    expect(querySource).toMatch(/listPublishedLandingSlugs\(limit = \d+\)/);
  });
});

describe("server-action role gates", () => {
  it("gates every exported action behind a role constant", () => {
    // RLS is not the boundary here: `landing_pages_staff_all` grants `for all`
    // to anyone `is_staff()` accepts, which includes agent and support.
    // `requireRole` is the only real gate, so every action must name one.
    const actions = [
      ...actionSource.matchAll(/export async function (\w+)\(/g),
    ].map((m) => m[1]);
    expect(actions.length).toBeGreaterThan(5);
    for (const name of actions) {
      const body = actionSource.slice(
        actionSource.indexOf(`export async function ${name}(`),
      );
      const end = body.indexOf("\nexport ", 1);
      const scoped = end === -1 ? body : body.slice(0, end);
      expect(scoped, `${name} does not call requireRole`).toMatch(
        /requireRole\((LANDING_EDIT_ROLES|LANDING_DELETE_ROLES)\)/,
      );
    }
  });

  it("keeps deleting on a narrower gate than editing", () => {
    expect(actionSource).toContain(
      'const LANDING_DELETE_ROLES = ["admin", "editor"] as const',
    );
    expect(actionSource).toMatch(
      /deleteLandingPage[\s\S]*?LANDING_DELETE_ROLES/,
    );
  });

  it("only ever writes draft_blocks when saving the document", () => {
    // The whole point of the table. If saveLandingBlocks ever touched `blocks`,
    // editing a live campaign page would publish every keystroke's save.
    const start = actionSource.indexOf(
      "export async function saveLandingBlocks",
    );
    const end = actionSource.indexOf(
      "export async function discardLandingDraft",
    );
    const body = actionSource.slice(start, end);
    expect(body).toContain("draft_blocks:");
    expect(body).not.toMatch(/\.update\(\{\s*blocks:/);
  });
});

describe("media usage", () => {
  it("registers landing pages as a usage source", () => {
    // Without this every image a marketing manager picks reads as "unused" and
    // the library offers a delete button that punches a hole in a live page.
    expect(usageSource).toContain('source("landing_pages"');
    expect(usageSource).toContain('kind: "landing_page"');
    // Both documents, or an asset only the draft uses looks deletable.
    expect(usageSource).toMatch(/collectMediaIds\(r\.draft_blocks\)/);
  });
});

describe("urls", () => {
  it("builds the public and admin paths", () => {
    expect(landingUrl({ slug: "spring-launch" })).toBe("/lp/spring-launch");
    expect(landingAdminUrl({ id: "abc" })).toBe("/admin/page-builder/abc");
  });
});
