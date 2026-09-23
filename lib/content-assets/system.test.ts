import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  PREVIEW_ONLY_EMAILS,
  SYSTEM_ASSETS,
  SYSTEM_ASSET_KEYS,
  allowedTokensFor,
  isSystemAssetKey,
  missingRequiredTokens,
} from "./system";
import { SYSTEM_EMAIL_DEFAULTS } from "./system-defaults";
import { renderSystemEmail } from "./system-render";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import { isTokenName, outOfScopeTokens, unknownTokens, tokenDef } from "./tokens";

const MIGRATIONS = path.resolve(__dirname, "../../supabase/migrations");
const read = (file: string) => readFileSync(path.join(MIGRATIONS, file), "utf8");

describe("SYSTEM_ASSETS registry", () => {
  it("has an entry for every key, keyed by itself", () => {
    for (const key of SYSTEM_ASSET_KEYS) {
      expect(SYSTEM_ASSETS[key].key).toBe(key);
    }
    expect(Object.keys(SYSTEM_ASSETS).sort()).toEqual(
      [...SYSTEM_ASSET_KEYS].sort(),
    );
  });

  it("only names tokens that exist in the vocabulary", () => {
    for (const key of SYSTEM_ASSET_KEYS) {
      for (const token of [
        ...SYSTEM_ASSETS[key].tokens,
        ...SYSTEM_ASSETS[key].required,
      ]) {
        expect(isTokenName(token), `${key} → ${token}`).toBe(true);
      }
    }
  });

  it("requires only tokens the email is allowed to use", () => {
    for (const key of SYSTEM_ASSET_KEYS) {
      for (const token of SYSTEM_ASSETS[key].required) {
        expect(SYSTEM_ASSETS[key].tokens, `${key} → ${token}`).toContain(token);
      }
    }
  });

  it("falls back only to an email that fills the same tokens", () => {
    // The fallback's published copy is rendered with THIS email's context, so
    // every token it may use has to be one this send path fills.
    for (const key of SYSTEM_ASSET_KEYS) {
      const target = SYSTEM_ASSETS[key].fallsBackTo;
      if (!target) continue;
      const mine = new Set(SYSTEM_ASSETS[key].tokens);
      for (const t of SYSTEM_ASSETS[target].tokens) {
        if (["property_reference", "property_title", "property_line"].includes(t)) {
          // Filled as null on a mortgage lead, which is correct: they vanish.
          continue;
        }
        expect(mine.has(t), `${key} → ${target} needs ${t}`).toBe(true);
      }
    }
  });

  it("keeps slugs unique and in the shape the database checks", () => {
    const slugs = SYSTEM_ASSET_KEYS.map((k) => SYSTEM_ASSETS[k].slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("does not reuse a system key for a preview-only email", () => {
    for (const e of PREVIEW_ONLY_EMAILS) {
      expect(isSystemAssetKey(e.key)).toBe(false);
    }
  });
});

describe("the migrations agree with the registry", () => {
  /**
   * Every migration, concatenated — not 0117 and 0127 by name.
   *
   * A system email added later is seeded by a later migration and is just as
   * seeded; pinning the two that happened to exist when this was written made
   * "add an email" fail here for the wrong reason, and the only way to pass
   * would have been editing history.
   */
  const allMigrations = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => read(f))
    .join("\n");

  it("seeds a row for every key, with the registry's slug", () => {
    for (const key of SYSTEM_ASSET_KEYS) {
      const slug = SYSTEM_ASSETS[key].slug;
      const seeded =
        allMigrations.includes(`'${slug}'`) ||
        allMigrations.includes(`$s$${slug}$s$`);
      expect(seeded, `${key} (${slug})`).toBe(true);
    }
  });

  it("widens the closed key check to exactly the registry's keys", () => {
    // Read whichever migration defines the constraint LAST, not 0127.
    // Dropping a system email rewrites the allow-list in a later migration
    // (0132 removed viewing_confirmation), and pinning the original would
    // make this assert against superseded history.
    const latest = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .reverse()
      .find((f) =>
        read(f).includes("add constraint content_assets_system_key_known"),
      )!;
    const source = read(latest);
    const block = source.slice(
      source.indexOf("add constraint content_assets_system_key_known"),
    );
    // Cut at the statement terminator rather than a literal "));" — that
    // depended on one migration's bracket layout, and a differently
    // formatted rewrite ran past the end and picked up words from the
    // trailing comments.
    const listed = [
      ...block.slice(0, block.indexOf(";")).matchAll(/'([a-z0-9_]+)'/g),
    ].map((m) => m[1]);
    expect(listed.sort()).toEqual([...SYSTEM_ASSET_KEYS].sort());
  });

  it("seeds the starting wording from system-defaults.ts, verbatim", () => {
    for (const key of SYSTEM_ASSET_KEYS) {
      const d = SYSTEM_EMAIL_DEFAULTS[key];
      expect(allMigrations, `${key} subject`).toContain(`$s$${d.subject}$s$`);
      expect(allMigrations, `${key} body`).toContain(`$body$${d.body}$body$`);
    }
  });
});

describe("SYSTEM_EMAIL_DEFAULTS", () => {
  it("covers every key", () => {
    expect(Object.keys(SYSTEM_EMAIL_DEFAULTS).sort()).toEqual(
      [...SYSTEM_ASSET_KEYS].sort(),
    );
  });

  it("uses only tokens each email may use, and every token it must", () => {
    for (const key of SYSTEM_ASSET_KEYS) {
      const { subject, body } = SYSTEM_EMAIL_DEFAULTS[key];
      const allowed = SYSTEM_ASSETS[key].tokens;
      expect(unknownTokens(subject + body), key).toEqual([]);
      expect(outOfScopeTokens(subject + body, allowed), key).toEqual([]);
      expect(missingRequiredTokens(key, { subject, body }), key).toEqual([]);
    }
  });

  it("never puts a panel in a subject line", () => {
    for (const key of SYSTEM_ASSET_KEYS) {
      const inSubject = [
        ...SYSTEM_EMAIL_DEFAULTS[key].subject.matchAll(/\{\{([a-z_]+)\}\}/g),
      ].map((m) => m[1]);
      for (const t of inSubject) {
        if (isTokenName(t)) expect(tokenDef(t).kind, `${key} → ${t}`).not.toBe("block");
      }
    }
  });
});

describe("isSystemAssetKey", () => {
  it("accepts a real key and rejects anything else", () => {
    expect(isSystemAssetKey("newsletter_welcome")).toBe(true);
    expect(isSystemAssetKey("valuation_code")).toBe(true);
    expect(isSystemAssetKey("enquiry_first_response")).toBe(false);
    expect(isSystemAssetKey("advisor_reply")).toBe(false);
    expect(isSystemAssetKey("")).toBe(false);
  });
});

describe("allowedTokensFor", () => {
  it("gives a hand-written asset the shared lead tokens", () => {
    const shared = allowedTokensFor(null);
    expect(shared).toContain("lead_first_name");
    expect(shared).toContain("advisor_phone");
    // System tokens nothing on that path fills.
    expect(shared).not.toContain("viewing_time");
    expect(shared).not.toContain("unsubscribe_url");
  });

  it("scopes a system email to what its own send path fills", () => {
    const welcome = allowedTokensFor("newsletter_welcome");
    expect(welcome).toContain("unsubscribe_url");
    // A subscriber has no property and no advisor.
    expect(welcome).not.toContain("property_reference");
    expect(welcome).not.toContain("advisor_name");
  });

  it("falls back to the shared set for an unrecognised key", () => {
    expect(allowedTokensFor("not_a_key")).toEqual(allowedTokensFor(null));
    expect(allowedTokensFor(undefined)).toEqual(allowedTokensFor(null));
  });
});

describe("missingRequiredTokens", () => {
  it("names the link a confirmation cannot work without", () => {
    expect(
      missingRequiredTokens("newsletter_confirmation", {
        subject: "Confirm",
        body: "<p>Click the link.</p>",
      }),
    ).toEqual(["confirm_url"]);
  });

  it("accepts the token anywhere, including inside a button's target", () => {
    expect(
      missingRequiredTokens("newsletter_confirmation", {
        subject: "Confirm",
        body: '<a data-email-button="" href="{{confirm_url}}">Confirm</a>',
      }),
    ).toEqual([]);
  });
});

describe("renderSystemEmail — plain-text rows (0117)", () => {
  const copy = {
    subject: "We received your brief on {{property_reference}}",
    body: "Hello {{lead_first_name}},\n\nYou wrote:\n{{enquiry_message}}\n\n— Bazar",
    format: "text" as const,
  };

  it("substitutes tokens in the subject and the body", () => {
    const out = renderSystemEmail(
      copy,
      {
        values: {
          lead_first_name: "Amira",
          property_reference: "BAZ-AD-04891",
          enquiry_message: "Is it still available?",
        },
      },
      DEFAULT_EMAIL_BRAND,
    );
    expect(out.subject).toBe("We received your brief on BAZ-AD-04891");
    expect(out.text).toContain("Hello Amira,");
    expect(out.text).toContain("Is it still available?");
  });

  it("falls back rather than leaving a hole", () => {
    const out = renderSystemEmail(copy, { values: {} }, DEFAULT_EMAIL_BRAND);
    expect(out.subject).toBe("We received your brief on your enquiry");
    expect(out.text).toContain("Hello there,");
  });

  it("turns blank lines into paragraphs and single newlines into breaks", () => {
    const out = renderSystemEmail(
      copy,
      { values: { lead_first_name: "Amira", enquiry_message: "Is it still available?" } },
      DEFAULT_EMAIL_BRAND,
    );
    expect(out.html).toContain("You wrote:<br />Is it still available?");
    expect(out.html.match(/<p style="margin:0 0 14px">/g)?.length).toBe(3);
  });

  it("escapes copy so a lead's own message can't inject markup", () => {
    const out = renderSystemEmail(
      { subject: "x", body: "{{enquiry_message}}", format: "text" },
      { values: { enquiry_message: "<script>alert(1)</script>" } },
      DEFAULT_EMAIL_BRAND,
    );
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("keeps the Bazar wrapper so an override looks like the built-in email", () => {
    const out = renderSystemEmail(
      copy,
      { values: { lead_first_name: "Amira" } },
      DEFAULT_EMAIL_BRAND,
    );
    expect(out.html).toContain("<!doctype html>");
    expect(out.html).toContain("ORN 28041");
  });
});
