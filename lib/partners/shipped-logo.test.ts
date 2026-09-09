import { describe, expect, it } from "vitest";
import { ECOSYSTEM_PARTNERS, shippedPartners } from "./directory-data";
import {
  findShippedPartner,
  partnerNameKey,
  resolvePartnerLogo,
  shippedPartnerLogo,
  UPLOADED_LOGO_DIMS,
} from "./shipped-logo";

describe("finding the shipped art", () => {
  it("matches on the slug a CMS card carries", () => {
    expect(findShippedPartner("adib")?.name).toBe("Abu Dhabi Islamic Bank");
  });

  it("matches on the name when the slug was cleared", () => {
    expect(findShippedPartner("Dubai Land Department")?.slug).toBe("dld");
  });

  it("is insensitive to how the name is punctuated or cased", () => {
    expect(partnerNameKey("First Abu Dhabi Bank")).toBe("first-abu-dhabi-bank");
    expect(findShippedPartner("first abu dhabi bank")?.slug).toBe("fab");
  });

  it("returns null for an institution the repo ships nothing for", () => {
    expect(findShippedPartner("Emirates NBD")).toBeNull();
    expect(findShippedPartner("")).toBeNull();
    expect(shippedPartnerLogo({ slug: null, name: null })).toBeNull();
  });

  it("carries the PNG's own dimensions, so the tile doesn't shift", () => {
    const fab = ECOSYSTEM_PARTNERS.find((p) => p.slug === "fab")!;
    expect(shippedPartnerLogo({ slug: "fab" })).toEqual({
      src: fab.logo,
      w: fab.w,
      h: fab.h,
    });
  });
});

describe("resolvePartnerLogo", () => {
  it("prefers what an editor uploaded over the shipped art", () => {
    // The mistake the developer records made first: a logo field that loses to
    // shipped art is a no-op for exactly the partners most likely to need a
    // refresh.
    expect(
      resolvePartnerLogo({
        uploadedUrl: "https://cdn.example/fab-2027.png",
        slug: "fab",
        name: "First Abu Dhabi Bank",
      }),
    ).toEqual({ src: "https://cdn.example/fab-2027.png", ...UPLOADED_LOGO_DIMS });
  });

  it("falls back to the shipped art when nothing was uploaded", () => {
    expect(resolvePartnerLogo({ slug: "adcb" })?.src).toBe("/partners/adcb.png");
  });

  it("keeps the logo when a card is renamed but keeps its slug", () => {
    expect(
      resolvePartnerLogo({ slug: "fab", name: "FAB" })?.src,
    ).toBe("/partners/fab.png");
  });

  it("returns null for a partner with no art anywhere — the card sets type", () => {
    expect(
      resolvePartnerLogo({ slug: "emirates-nbd", name: "Emirates NBD" }),
    ).toBeNull();
  });
});

describe("shippedPartners", () => {
  it("resolves every catalogue row to a card with art", () => {
    const cards = shippedPartners();
    expect(cards).toHaveLength(ECOSYSTEM_PARTNERS.length);
    for (const card of cards) {
      expect(card.logo, card.name).not.toBeNull();
      expect(card.name).not.toBe("");
      expect(card.category).toBeTruthy();
    }
  });
});
