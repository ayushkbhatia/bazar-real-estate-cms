import { describe, expect, it } from "vitest";
import {
  blankFloatingCta,
  floatingCtaListSchema,
  readableForeground,
  renderCtaTemplate,
} from "./floating-cta";

describe("renderCtaTemplate", () => {
  const ctx = {
    advisor: "Layla Al Mansoori",
    context: "BAZ-AD-04891",
    url: "https://www.bazarrealestate.ae/p/x",
  };

  it("substitutes every supported token", () => {
    expect(
      renderCtaTemplate(
        "Hi {advisor} ({advisor_first}) about {context} — {url}",
        ctx,
      ),
    ).toBe(
      "Hi Layla Al Mansoori (Layla) about BAZ-AD-04891 — https://www.bazarrealestate.ae/p/x",
    );
  });

  it("falls back to the brand name when no advisor is attached", () => {
    expect(renderCtaTemplate("Hi {advisor_first}, hello", {})).toBe(
      "Hi Bazar, hello",
    );
  });

  it("drops unknown tokens rather than sending them to a customer", () => {
    expect(renderCtaTemplate("Hi {advsior}, hello", ctx)).toBe("Hi, hello");
  });

  it("closes the gap an empty value leaves behind", () => {
    // The seeded WhatsApp draft on a page with nothing to name.
    expect(
      renderCtaTemplate(
        "Hi {advisor}, I'm enquiring about {context} on bazar.ae",
        { advisor: null, context: "" },
      ),
    ).toBe("Hi Bazar, I'm enquiring about on bazar.ae");
  });

  it("drops a separator left stranded by an empty token", () => {
    expect(
      renderCtaTemplate("Bazar enquiry · {context}", { context: "" }),
    ).toBe("Bazar enquiry");
  });

  it("keeps the separator when the token has a value", () => {
    // Regression: a blanket "no space before punctuation" tidy turned this
    // into "Bazar enquiry· Al Naseem" on every off-plan page.
    expect(
      renderCtaTemplate("Bazar enquiry · {context}", {
        context: "Al Naseem",
      }),
    ).toBe("Bazar enquiry · Al Naseem");
  });

  it("keeps ordinary punctuation spacing intact", () => {
    expect(
      renderCtaTemplate("Ref: {context}. Thanks!", { context: "BAZ-1" }),
    ).toBe("Ref: BAZ-1. Thanks!");
  });

  it("keeps paragraph breaks but collapses runs of blank lines", () => {
    expect(renderCtaTemplate("A\n\n{context}\n\n\n\nB", { context: "" })).toBe(
      "A\n\nB",
    );
  });

  it("returns an empty string for a missing template", () => {
    expect(renderCtaTemplate(null, ctx)).toBe("");
  });
});

  it("fills the listing tokens a property page publishes", () => {
    expect(
      renderCtaTemplate(
        "I'm interested in {property_title} ({reference}) — {beds} bed, {price}, {area_name}.",
        {
          property_title: "Marina Bay Tower",
          reference: "BAZ-AD-04891",
          beds: "2",
          price: "AED 2.4M",
          area_name: "Al Reem Island",
        },
      ),
    ).toBe(
      "I'm interested in Marina Bay Tower (BAZ-AD-04891) — 2 bed, AED 2.4M, Al Reem Island.",
    );
  });

  it("degrades a listing token used on a page that has no listing", () => {
    // The same template on a blog post: the parenthetical collapses rather
    // than printing an empty pair of brackets or the literal token.
    expect(
      renderCtaTemplate("I'm interested in {property_title} {reference}", {}),
    ).toBe("I'm interested in");
  });

  it("prefers a published {advisor_first} over splitting the full name", () => {
    expect(
      renderCtaTemplate("Hi {advisor_first}", {
        advisor: "Al Mansoori, Layla",
        advisor_first: "Layla",
      }),
    ).toBe("Hi Layla");
  });

describe("readableForeground", () => {
  it("picks near-black on WhatsApp green — white would fail contrast", () => {
    expect(readableForeground("#25D366")).toBe("#101112");
  });

  it("picks white on a dark fill", () => {
    expect(readableForeground("#101112")).toBe("#FFFFFF");
  });

  it("defaults to white when the colour is unset or malformed", () => {
    expect(readableForeground(null)).toBe("#FFFFFF");
    expect(readableForeground("#25D3")).toBe("#FFFFFF");
  });
});

describe("floatingCtaListSchema", () => {
  const whatsapp = blankFloatingCta("whatsapp");

  it("accepts the default rail", () => {
    const result = floatingCtaListSchema.safeParse({
      ctas: [whatsapp, blankFloatingCta("call")],
    });
    expect(result.success).toBe(true);
  });

  it("rejects two buttons sharing a key", () => {
    const result = floatingCtaListSchema.safeParse({
      ctas: [whatsapp, { ...blankFloatingCta("call"), key: "whatsapp" }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("whatsapp");
  });

  it("rejects a colour that isn't 6-digit hex", () => {
    const result = floatingCtaListSchema.safeParse({
      ctas: [{ ...whatsapp, color: "#2D6" }],
    });
    expect(result.success).toBe(false);
  });

  it("requires an address on an email button shown everywhere", () => {
    const result = floatingCtaListSchema.safeParse({
      ctas: [{ ...blankFloatingCta("email"), scope: "all_pages" }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("address");
  });

  it("allows a blank address on an advisor-routed email button", () => {
    const result = floatingCtaListSchema.safeParse({
      ctas: [{ ...blankFloatingCta("email"), scope: "detail_pages" }],
    });
    expect(result.success).toBe(true);
  });
});
