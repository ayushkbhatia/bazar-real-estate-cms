import { describe, it, expect } from "vitest";
import {
  SYSTEM_ASSETS,
  SYSTEM_ASSET_KEYS,
  allowedTokensFor,
  isSystemAssetKey,
  renderSystemEmail,
} from "./system";
import { isTokenName } from "./tokens";

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
      for (const token of SYSTEM_ASSETS[key].tokens) {
        expect(isTokenName(token), `${key} → ${token}`).toBe(true);
      }
    }
  });

  it("slugs match the rows migration 0117 seeds", () => {
    expect(SYSTEM_ASSET_KEYS.map((k) => SYSTEM_ASSETS[k].slug)).toEqual([
      "system-enquiry-auto-reply",
      "system-valuation-acknowledgement",
      "system-viewing-confirmation",
      "system-newsletter-welcome",
    ]);
  });
});

describe("isSystemAssetKey", () => {
  it("accepts a real key and rejects anything else", () => {
    expect(isSystemAssetKey("newsletter_welcome")).toBe(true);
    expect(isSystemAssetKey("enquiry_first_response")).toBe(false);
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

describe("renderSystemEmail", () => {
  const copy = {
    subject: "We received your brief on {{property_reference}}",
    body: "Hello {{lead_first_name}},\n\nYou wrote:\n{{enquiry_message}}\n\n— Bazar",
  };

  it("substitutes tokens in the subject and the body", () => {
    const out = renderSystemEmail(copy, {
      lead_first_name: "Amira",
      property_reference: "BAZ-AD-04891",
      enquiry_message: "Is it still available?",
    });
    expect(out.subject).toBe("We received your brief on BAZ-AD-04891");
    expect(out.text).toContain("Hello Amira,");
    expect(out.text).toContain("Is it still available?");
  });

  it("falls back rather than leaving a hole", () => {
    const out = renderSystemEmail(copy, {});
    expect(out.subject).toBe("We received your brief on your enquiry");
    expect(out.text).toContain("Hello there,");
  });

  it("turns blank lines into paragraphs and single newlines into breaks", () => {
    const out = renderSystemEmail(copy, {
      lead_first_name: "Amira",
      enquiry_message: "Is it still available?",
    });
    // "You wrote:" and the message are one paragraph, split by <br>.
    expect(out.html).toContain("You wrote:<br>Is it still available?");
    expect(out.html.match(/<p style="margin:0 0 14px">/g)?.length).toBe(3);
  });

  it("escapes copy so a lead's own message can't inject markup", () => {
    const out = renderSystemEmail(
      { subject: "x", body: "{{enquiry_message}}" },
      { enquiry_message: "<script>alert(1)</script>" },
    );
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("keeps the Bazar wrapper so an override looks like the built-in email", () => {
    const out = renderSystemEmail(copy, { lead_first_name: "Amira" });
    expect(out.html).toContain("<!doctype html>");
    expect(out.html).toContain("ORN 28041");
  });
});
