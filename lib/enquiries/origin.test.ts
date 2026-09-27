import { describe, it, expect } from "vitest";
import { FORM_DEFS } from "@/lib/forms/registry";
import { MASTER_PAGES } from "@/lib/master-pages";
import { ENQUIRY_SOURCES } from "@/lib/schemas/enquiry";
import {
  SOURCE_LABELS,
  describeSourcePage,
  enquiryOrigin,
  humanise,
  originLabel,
  sourceLabel,
  splitLocale,
} from "./origin";

describe("sourceLabel", () => {
  it("names every enquiry source", () => {
    for (const source of ENQUIRY_SOURCES) {
      expect(SOURCE_LABELS[source], source).toBeTruthy();
    }
  });

  it("never calls the catch-all the contact page", () => {
    // Half the forms file as `contact_page` and only one of them is on it;
    // that label is the mislabel this module exists to retire.
    expect(sourceLabel("contact_page")).not.toMatch(/contact/i);
  });

  it("humanises a source this build doesn't know", () => {
    expect(sourceLabel("partner_referral")).toBe("Partner Referral");
  });
});

describe("enquiryOrigin", () => {
  it("names every registry form by its own name and surface", () => {
    for (const def of FORM_DEFS) {
      const origin = enquiryOrigin(def.key, "contact_page");
      expect(origin.form).toBe(def.name);
      expect(origin.surface).toBe(def.surface);
      expect(origin.def?.key).toBe(def.key);
      expect(origin.viaForm).toBe(true);
    }
  });

  it("gives every form a label no other form shares", () => {
    // The inbox's promise: whichever box a lead came through, the row says
    // which. Two forms reading identically would put that back to guesswork.
    const labels = FORM_DEFS.map((def) => {
      const { surface, form } = originLabel(def.key, "contact_page");
      return `${surface} · ${form}`;
    });
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("tells the forms that share a source apart", () => {
    const sharing = FORM_DEFS.filter((d) => d.enquirySource === "contact_page");
    const surfaces = new Set(sharing.map((d) => originLabel(d.key, "contact_page").surface));
    // Filed identically, sitting on different pages.
    expect(sharing.length).toBeGreaterThan(1);
    expect(surfaces.size).toBeGreaterThan(1);
  });

  it("tells the Buy hero apart from the contact page, though both file as contact_page", () => {
    expect(originLabel("buy_hero_enquiry", "contact_page")).toEqual({
      surface: "Buy",
      form: "Start your property search",
    });
    expect(originLabel("contact_enquiry", "contact_page")).toEqual({
      surface: "Contact",
      form: "Submit your enquiry",
    });
  });

  it("keeps a key the registry no longer knows rather than dropping it", () => {
    const origin = enquiryOrigin("spring_open_day", "contact_page");
    expect(origin.def).toBeNull();
    expect(origin.form).toBe("Spring Open Day");
    expect(origin.surface).toBe("Website form");
    expect(origin.viaForm).toBe(true);
  });

  it("falls back to the source when no form was recorded", () => {
    expect(enquiryOrigin(null, "valuation")).toMatchObject({
      surface: "Valuation tool",
      form: null,
      viaForm: true,
    });
  });

  it("knows the channels that involve no form at all", () => {
    expect(enquiryOrigin(null, "whatsapp_inbound").viaForm).toBe(false);
    expect(enquiryOrigin(null, "concierge").viaForm).toBe(false);
  });
});

describe("splitLocale", () => {
  it("reads the Arabic prefix", () => {
    expect(splitLocale("/ar/buy")).toEqual({ locale: "ar", path: "/buy" });
    expect(splitLocale("/ar")).toEqual({ locale: "ar", path: "/" });
  });

  it("compares whole segments — /areas is not Arabic", () => {
    // The same prefix-versus-segment mistake once made `Disallow: /ar` block
    // every area guide.
    expect(splitLocale("/areas/saadiyat-island")).toEqual({
      locale: "en",
      path: "/areas/saadiyat-island",
    });
  });

  it("drops the query and fragment", () => {
    expect(splitLocale("/buy?utm_source=meta#form").path).toBe("/buy");
  });
});

describe("describeSourcePage", () => {
  it("returns null when nothing was recorded", () => {
    expect(describeSourcePage(null)).toBeNull();
    expect(describeSourcePage("  ")).toBeNull();
  });

  it("returns null for a source that isn't a path", () => {
    // What the newsletter action writes into the same column.
    expect(describeSourcePage("newsletter:insights_header")).toBeNull();
  });

  it("names every master page by its label and links its editor", () => {
    for (const master of MASTER_PAGES) {
      const page = describeSourcePage(master.path)!;
      expect(page.kind, master.path).toBe(master.label);
      expect(page.edit?.href).toBe(`/admin/pages/master/${master.key}`);
    }
  });

  it("keeps the Arabic prefix on the link so it opens what they saw", () => {
    const page = describeSourcePage("/ar/buy")!;
    expect(page).toMatchObject({
      kind: "Buy",
      locale: "ar",
      href: "/ar/buy",
      path: "/buy",
    });
  });

  it("normalises a trailing slash and a query string on English paths", () => {
    expect(describeSourcePage("/buy/?utm_campaign=q4")).toMatchObject({
      kind: "Buy",
      href: "/buy",
      locale: "en",
    });
  });

  it("names the enquiry's own listing from the address", () => {
    const page = describeSourcePage("/p/sea-view-apartment-baz-ad-04891", {
      property: {
        id: "p-1",
        reference: "BAZ-AD-04891",
        title: "Sea-view apartment on Reem",
      },
    })!;
    expect(page.kind).toBe("Listing");
    expect(page.name).toBe("BAZ-AD-04891 · Sea-view apartment on Reem");
    expect(page.edit).toEqual({
      href: "/admin/properties/p-1",
      label: "Edit listing",
    });
  });

  it("doesn't borrow the enquiry's listing for a different listing page", () => {
    const page = describeSourcePage("/p/garden-villa-baz-ad-01234", {
      property: { id: "p-1", reference: "BAZ-AD-04891", title: "Elsewhere" },
    })!;
    expect(page.name).toBe("BAZ-AD-01234");
    expect(page.edit).toBeNull();
  });

  it("names a project page from the joined development when the slugs agree", () => {
    const hinted = describeSourcePage("/ar/developments/saadiyat-lagoons", {
      development: { slug: "saadiyat-lagoons", name: "Saadiyat Lagoons" },
    })!;
    expect(hinted).toMatchObject({
      kind: "Project page",
      name: "Saadiyat Lagoons",
      locale: "ar",
      href: "/ar/developments/saadiyat-lagoons",
      edit: { href: "/admin/pages/sub/development/saadiyat-lagoons" },
    });

    expect(describeSourcePage("/developments/yas-acres")!.name).toBe(
      "Yas Acres",
    );
  });

  it("names an area guide and links its editor", () => {
    expect(describeSourcePage("/areas/al-reem-island")).toMatchObject({
      kind: "Area guide",
      name: "Al Reem Island",
      edit: { href: "/admin/pages/sub/area/al-reem-island" },
    });
  });

  it("recognises a campaign landing page", () => {
    expect(describeSourcePage("/lp/summer-saadiyat-launch")).toMatchObject({
      kind: "Campaign landing page",
      name: "Summer Saadiyat Launch",
    });
  });

  it("recognises search results by mode", () => {
    expect(describeSourcePage("/rent/search")).toMatchObject({
      kind: "Search results",
      name: "Rent",
    });
  });

  it("names the tools without a master page", () => {
    expect(describeSourcePage("/tools/valuation")!.kind).toBe(
      "Valuation tool",
    );
  });

  it("still answers for a page it doesn't recognise", () => {
    expect(describeSourcePage("/somewhere/new")).toMatchObject({
      kind: "Page",
      name: null,
      href: "/somewhere/new",
      edit: null,
    });
  });
});

describe("humanise", () => {
  it("title-cases slugs and snake_case", () => {
    expect(humanise("saadiyat-lagoons")).toBe("Saadiyat Lagoons");
    expect(humanise("hotel_apartment")).toBe("Hotel Apartment");
  });
});
