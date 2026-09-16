import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  FORM_REPLY_DEFAULT,
  FORM_REPLY_SAMPLE,
  FORM_REPLY_TOKENS,
} from "./form-replies";
import { isTokenName, outOfScopeTokens, unknownTokens } from "./tokens";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";
import { renderSystemEmail } from "./system-render";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("FORM_REPLY_TOKENS", () => {
  it("names only tokens that exist", () => {
    for (const t of FORM_REPLY_TOKENS) expect(isTokenName(t), t).toBe(true);
  });

  it("offers what the enquiry path fills, and nothing it doesn't", () => {
    expect(FORM_REPLY_TOKENS).toContain("lead_first_name");
    expect(FORM_REPLY_TOKENS).toContain("form_name");
    // A form reply has no viewing, no valuation and no unsubscribe link.
    expect(FORM_REPLY_TOKENS).not.toContain("viewing_time");
    expect(FORM_REPLY_TOKENS).not.toContain("valuation_range");
    expect(FORM_REPLY_TOKENS).not.toContain("unsubscribe_url");
  });
});

describe("the starting wording", () => {
  it("uses only tokens a reply may use", () => {
    const text = `${FORM_REPLY_DEFAULT.subject}${FORM_REPLY_DEFAULT.body}`;
    expect(unknownTokens(text)).toEqual([]);
    expect(outOfScopeTokens(text, FORM_REPLY_TOKENS)).toEqual([]);
  });

  it("renders completely against a sample lead", () => {
    const out = renderSystemEmail(
      { ...FORM_REPLY_DEFAULT, format: "html" },
      {
        values: {
          lead_first_name: "Amira",
          property_line: "For BAZ-AD-04891",
          enquiry_message: FORM_REPLY_SAMPLE.message,
          form_name: FORM_REPLY_SAMPLE.formName,
        },
      },
      DEFAULT_EMAIL_BRAND,
    );
    expect(out.html).not.toMatch(/\{\{|\}\}/);
    expect(out.html).toContain("Hello Amira,");
    expect(out.text).toContain(FORM_REPLY_SAMPLE.message);
  });
});

describe("migration 0128", () => {
  const sql = readFileSync(
    path.resolve(__dirname, "../../supabase/migrations/0128_form_replies.sql"),
    "utf8",
  );

  it("adds the role the library reads, with the three values it knows", () => {
    expect(sql).toMatch(/add column if not exists role text/);
    for (const role of ["outreach", "system", "form_reply"]) {
      expect(sql, role).toContain(`'${role}'`);
    }
  });

  it("adds the assignment and the lead's form key", () => {
    expect(sql).toMatch(/alter table public\.forms\s+add column if not exists reply_asset_id/);
    // Clearing the assignment must never block deleting a reply.
    expect(sql).toContain("on delete set null");
    expect(sql).toMatch(/alter table public\.enquiries\s+add column if not exists form_key/);
  });

  it("keeps rich text to the whole-message roles", () => {
    expect(sql).toContain(
      "check (body_format = 'text' or role in ('system', 'form_reply'))",
    );
  });
});
