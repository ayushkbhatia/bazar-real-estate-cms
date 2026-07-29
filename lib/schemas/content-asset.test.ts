import { describe, it, expect } from "vitest";
import {
  contentAssetSchema,
  normaliseContentAssetInput,
  slugifyAssetName,
} from "./content-asset";

const base = {
  kind: "email",
  slug: "first-response",
  name: "First response",
  category: "enquiry",
  subject: "Re: {{property_reference}}",
  body: "Thank you for your enquiry about {{property_title}}.",
  notes: null,
  follow_up_after_days: null,
  next_asset_id: null,
  status: "published",
};

function parse(overrides: Record<string, unknown> = {}) {
  return contentAssetSchema.safeParse(
    normaliseContentAssetInput({ ...base, ...overrides }),
  );
}

describe("contentAssetSchema", () => {
  it("accepts a well-formed email asset", () => {
    expect(parse().success).toBe(true);
  });

  it("rejects a WhatsApp asset carrying a subject", () => {
    const r = parse({ kind: "whatsapp", subject: "Hello" });
    // normalise strips it first, so this passes — the guard is for the case
    // where a subject survives normalisation.
    expect(r.success).toBe(true);
    const direct = contentAssetSchema.safeParse({
      ...base,
      kind: "whatsapp",
      subject: "Hello",
    });
    expect(direct.success).toBe(false);
    expect(direct.error?.issues[0]?.path).toEqual(["subject"]);
  });

  it("requires a subject before an email can be published", () => {
    const r = parse({ subject: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/needs a subject/i);
  });

  it("lets a draft email sit without a subject", () => {
    expect(parse({ subject: "", status: "draft" }).success).toBe(true);
  });

  it("refuses an unknown token in the body", () => {
    const r = parse({ body: "Hello {{lead_frist_name}}, thanks for writing in." });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain("{{lead_frist_name}}");
  });

  it("refuses an unknown token in the subject too", () => {
    const r = parse({ subject: "Re: {{ref}}" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "subject")).toBe(true);
  });

  it("enforces the slug shape the database also checks", () => {
    expect(parse({ slug: "First Response" }).success).toBe(false);
    expect(parse({ slug: "first--response" }).success).toBe(false);
    expect(parse({ slug: "first-response-2" }).success).toBe(true);
  });

  it("bounds the follow-up window", () => {
    expect(parse({ follow_up_after_days: 0 }).success).toBe(false);
    expect(parse({ follow_up_after_days: 366 }).success).toBe(false);
    expect(parse({ follow_up_after_days: 3 }).success).toBe(true);
  });
});

describe("normaliseContentAssetInput", () => {
  it("turns blanks into null", () => {
    const out = normaliseContentAssetInput({
      ...base,
      notes: "",
      next_asset_id: "",
      follow_up_after_days: "",
    });
    expect(out.notes).toBeNull();
    expect(out.next_asset_id).toBeNull();
    expect(out.follow_up_after_days).toBeNull();
  });

  it("drops a subject when the channel is WhatsApp", () => {
    const out = normaliseContentAssetInput({
      ...base,
      kind: "whatsapp",
      subject: "leftover from the email tab",
    });
    expect(out.subject).toBeNull();
  });

  it("reads the day count from the form's string", () => {
    expect(
      normaliseContentAssetInput({ ...base, follow_up_after_days: "7" })
        .follow_up_after_days,
    ).toBe(7);
    expect(
      normaliseContentAssetInput({ ...base, follow_up_after_days: "soon" })
        .follow_up_after_days,
    ).toBeNull();
  });

  it("trims the fields a human types", () => {
    const out = normaliseContentAssetInput({
      ...base,
      name: "  Padded  ",
      slug: " padded ",
    });
    expect(out.name).toBe("Padded");
    expect(out.slug).toBe("padded");
  });

  it("accepts the seeded id shape for next_asset_id", () => {
    // Seeded catalogue ids have a zero version nibble that z.string().uuid()
    // rejects — see lib/uuid.
    const r = parse({ next_asset_id: "33333333-0000-0000-0000-000000000008" });
    expect(r.success).toBe(true);
  });
});

describe("slugifyAssetName", () => {
  it("produces a slug the schema accepts", () => {
    expect(slugifyAssetName("First response — new enquiry!")).toBe(
      "first-response-new-enquiry",
    );
  });

  it("trims leading and trailing separators", () => {
    expect(slugifyAssetName("  — Hello — ")).toBe("hello");
  });
});
