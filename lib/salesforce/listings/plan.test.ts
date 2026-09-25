import { describe, expect, it } from "vitest";
import {
  SALESFORCE_OWNED_COLUMNS,
  decideState,
  developerKey,
  mapAmenities,
  planListing,
  plainTextToHtml,
  resolveDeveloper,
  resolveLocation,
  targetStatus,
  type Hold,
} from "./plan";
import { toSnapshot } from "./snapshot";
import {
  COMPLETE_SALE,
  EXPIRED_OFF_PLAN_VILLA,
  IDS,
  NOW,
  RENT_UNMAPPED,
  SPARSE_PUBLISHED,
  lookups,
} from "./test-fixtures";

const codes = (holds: Hold[]) => holds.map((h) => h.code).sort();

describe("planListing — the four sandbox shapes", () => {
  it("puts a complete listing on the website with nothing held", () => {
    const plan = planListing(toSnapshot(COMPLETE_SALE), lookups(), NOW);
    expect(plan.holds).toEqual([]);
    expect(plan.fields).toMatchObject({
      title: "4BR Villa on Yas Island",
      mode: "buy",
      property_form: "resale",
      type: "villa",
      segment: "residential",
      beds: 4,
      baths: 4,
      built_up_ft2: 3200,
      plot_ft2: 4500,
      furnishing: "fully",
      parking_bays: 2,
      price_aed: 1_850_000,
      area_id: IDS.yas,
      sub_community_id: null,
      developer_id: IDS.aldar,
      assigned_agent_id: IDS.advisor,
      listing_permit_no: "ADREC-2026-0042",
      listing_permit_expires_at: "2026-12-31",
      geo: { lat: 24.498, lng: 54.605 },
    });
    expect(plan.fields?.amenities).toEqual([
      "Central Air Conditioning",
      "Private Garden",
      "Maid’s Room",
    ]);
    // "Priya testing" is junk in the CRM's amenity picklist; it is reported,
    // never written into the website's taxonomy.
    expect(plan.notes.find((n) => n.code === "unmapped_amenities")?.message).toContain("Priya testing");
  });

  it("holds the sparse published listing, naming every Salesforce field it needs", () => {
    const plan = planListing(toSnapshot(SPARSE_PUBLISHED), lookups(), NOW);
    expect(plan.fields).toBeNull();
    expect(codes(plan.holds)).toEqual(
      [
        "no_developer",
        "no_location",
        "no_permit_expiry",
        "no_permit_number",
        "no_sale_form",
        "no_title",
        "no_type",
      ].sort(),
    );
    for (const h of plan.holds) expect(h.fix).toBe("salesforce");
    expect(plan.holds.find((h) => h.code === "no_title")?.message).toContain("Title__c");
    // The price falls back to the Property record, and says so.
    expect(plan.notes.map((n) => n.code)).toContain("price_from_property");
  });

  it("holds a rental whose location the website does not have — for the website to fix", () => {
    const plan = planListing(toSnapshot(RENT_UNMAPPED), lookups(), NOW);
    expect(codes(plan.holds)).toEqual(["unmapped_location"]);
    expect(plan.holds[0].fix).toBe("website");
    expect(plan.unresolved.location).toBe("Sobha City, Abu Dhabi");
    // A row can still be created: title, mode, type and price are all there.
    expect(plan.fields).toMatchObject({
      mode: "rent",
      property_form: null,
      type: "apartment",
      price_aed: 145_000,
      furnishing: "semi",
      floor: 12,
      title_ar: "شقة عصرية 3 غرف في شوبا سيتي",
      developer_id: IDS.sobha,
    });
    expect(plan.fields?.description_ar).toContain("<p>");
    // An agent who is not staff here: noted, not held.
    expect(plan.notes.map((n) => n.code)).toContain("unmapped_agent");
    expect(plan.fields).not.toHaveProperty("assigned_agent_id");
  });

  it("holds an expired listing, and reads the villa as a villa", () => {
    const plan = planListing(toSnapshot(EXPIRED_OFF_PLAN_VILLA), lookups(), NOW);
    expect(codes(plan.holds)).toContain("listing_expired");
    expect(plan.fields).toMatchObject({
      type: "villa",
      mode: "off_plan",
      property_form: "off_plan",
      area_id: IDS.hudayriyat,
      developer_id: IDS.modon,
    });
    expect(plan.notes.map((n) => n.code)).toContain("reserved");
  });
});

describe("planListing — lifecycle and price rules", () => {
  const base = toSnapshot(COMPLETE_SALE);

  it("holds a listing Salesforce itself marks inactive, sold or rented", () => {
    expect(codes(planListing({ ...base, listingStatus: "Inactive" }, lookups(), NOW).holds)).toEqual([
      "listing_inactive",
    ]);
    expect(codes(planListing({ ...base, propertyStatus: "Sold" }, lookups(), NOW).holds)).toEqual([
      "property_unavailable",
    ]);
  });

  it("treats the expiry day itself as still valid", () => {
    // Same rule as the CMS publish gate: a permit is valid through its day.
    const plan = planListing({ ...base, expiresOn: "2026-09-24", permitExpiresOn: "2026-09-24" }, lookups(), NOW);
    expect(plan.holds).toEqual([]);
  });

  it("reads the permit's own expiry, not the listing's", () => {
    // v1.2 added Permit_Expiry_Date_c__c. Expired_Date__c ends the listing;
    // the permit field is what the publish gate and the permit cron check.
    const plan = planListing({ ...base, expiresOn: "2027-06-30", permitExpiresOn: "2026-10-15" }, lookups(), NOW);
    expect(plan.fields?.listing_permit_expires_at).toBe("2026-10-15");
    expect(codes(planListing({ ...base, permitExpiresOn: "2026-09-01" }, lookups(), NOW).holds)).toEqual(["permit_expired"]);
    const missing = planListing({ ...base, permitExpiresOn: null }, lookups(), NOW);
    expect(missing.holds[0]).toMatchObject({ code: "no_permit_expiry", fix: "salesforce" });
    expect(missing.holds[0].message).toContain("Permit_Expiry_Date_c__c");
  });

  it("reads the v1.2 website type first, and SemiFurnished as semi", () => {
    // LST-00002 in the sandbox says Apartment here and Villa in the Bayut
    // field. The field the guide names for the website wins.
    expect(planListing({ ...base, websiteType: "Apartment" }, lookups(), NOW).fields?.type).toBe("apartment");
    expect(planListing({ ...base, websiteType: "Full building" }, lookups(), NOW).fields?.type).toBe("building");
    expect(planListing({ ...base, websiteType: "Warehouse", category: null }, lookups(), NOW).fields).toMatchObject({
      type: "commercial",
      segment: "commercial",
    });
    expect(codes(planListing({ ...base, websiteType: "Other" }, lookups(), NOW).holds)).toEqual(["unsupported_type"]);
    expect(planListing({ ...base, furnishing: "SemiFurnished" }, lookups(), NOW).fields?.furnishing).toBe("semi");
  });

  it("finds the area through community and sub-community", () => {
    const plan = planListing(
      { ...base, location: "Abu Dhabi", community: "Saadiyat Island", subCommunity: "Saadiyat Lagoons" },
      lookups(),
      NOW,
    );
    expect(plan.fields).toMatchObject({ area_id: IDS.saadiyat, sub_community_id: IDS.lagoons });
    const unmapped = planListing(
      { ...base, location: "Dubai", community: "Dubai Hills Estate", subCommunity: "The Canopies", emirate: "Dubai" },
      lookups(),
      NOW,
    );
    expect(unmapped.unresolved.location).toBe("The Canopies, Dubai Hills Estate, Dubai");
  });

  it("shows yearly rent, and holds a monthly rent with no yearly figure", () => {
    const rent = toSnapshot(RENT_UNMAPPED);
    const monthly = { ...rent, rentFrequency: "Monthly", listingPrice: 12_000, yearlyRent: null };
    expect(codes(planListing(monthly, lookups(), NOW).holds)).toContain("rent_not_yearly");

    const withYearly = { ...monthly, yearlyRent: 144_000 };
    const plan = planListing(withYearly, lookups(), NOW);
    expect(plan.fields?.price_aed).toBe(144_000);
    expect(plan.notes.map((n) => n.code)).toContain("rent_from_yearly");
  });

  it("holds a type with no honest website equivalent", () => {
    const plan = planListing({ ...base, bayutType: "Residential Floor" }, lookups(), NOW);
    expect(codes(plan.holds)).toEqual(["unsupported_type"]);
    expect(plan.fields).toBeNull();
  });

  it("reads Bayut's type first, the CRM's second", () => {
    expect(planListing({ ...base, bayutType: null }, lookups(), NOW).fields?.type).toBe("apartment");
    expect(planListing({ ...base, bayutType: "Offices", category: null }, lookups(), NOW).fields).toMatchObject({
      type: "office",
      segment: "commercial",
    });
  });

  it("does not ask a plot of land for bedrooms", () => {
    const land = { ...base, bayutType: "Residential Plot", beds: null, baths: null };
    expect(codes(planListing(land, lookups(), NOW).holds)).toEqual([]);
    const flat = { ...base, beds: null };
    expect(codes(planListing(flat, lookups(), NOW).holds)).toEqual(["no_bedrooms"]);
  });

  it("holds a listing with no photos at all", () => {
    const bare = { ...base, cover: null, gallery: [], floorPlan: null };
    expect(codes(planListing(bare, lookups(), NOW).holds)).toEqual(["no_photos"]);
  });
});

describe("resolveLocation", () => {
  it("matches the most specific part first, sub-community before area", () => {
    expect(resolveLocation("Saadiyat Lagoons, Saadiyat Island, Abu Dhabi", "Abu Dhabi", lookups())).toEqual({
      area_id: IDS.saadiyat,
      sub_community_id: IDS.lagoons,
      building_id: null,
    });
  });

  it("forgives a missing 'Island' or 'City'", () => {
    expect(resolveLocation("Yas", null, lookups())?.area_id).toBe(IDS.yas);
    expect(resolveLocation("al-reem-island", null, lookups())?.area_id).toBe(IDS.reem);
  });

  it("never files another emirate's listing under Abu Dhabi", () => {
    expect(resolveLocation("Yas Island", "Dubai", lookups())).toBeNull();
  });

  it("refuses to guess between two matches", () => {
    const l = lookups();
    l.areas.push({ id: "00000000-0000-4000-8000-00000000009a", name: "Yas", slug: "yas", kind: "area", parent_id: IDS.abuDhabi });
    // Strict matching finds exactly the new "Yas"; loose matching would find
    // both. The strict pass wins, and a genuinely ambiguous loose one is null.
    expect(resolveLocation("Yas", null, l)?.area_id).toBe("00000000-0000-4000-8000-00000000009a");
    l.areas.push({ id: "00000000-0000-4000-8000-00000000009b", name: "Yas City", slug: "yas-city", kind: "area", parent_id: IDS.abuDhabi });
    expect(resolveLocation("Yas District", null, l)).toBeNull();
  });

  it("takes an admin's mapping over any automatic match", () => {
    const l = lookups({
      mappings: {
        location: new Map([["sobha city abu dhabi", IDS.reem]]),
        developer: new Map(),
        agent: new Map(),
      },
    });
    expect(resolveLocation("Sobha City, Abu Dhabi", "Abu Dhabi", l)?.area_id).toBe(IDS.reem);
    // …and the same question asked with different spacing and case.
    expect(resolveLocation("sobha city,  ABU DHABI", "Abu Dhabi", l)?.area_id).toBe(IDS.reem);
  });
});

describe("resolveDeveloper", () => {
  it("matches through the suffixes developers are written with", () => {
    expect(developerKey("ALDAR Properties PJSC")).toBe("aldar");
    expect(resolveDeveloper("Aldar Properties", lookups())).toBe(IDS.aldar);
    expect(resolveDeveloper("Modon", lookups())).toBe(IDS.modon);
    expect(resolveDeveloper("Emaar", lookups())).toBeNull();
  });
});

describe("mapAmenities", () => {
  it("matches through apostrophes and hyphens, and aliases the rest", () => {
    const { mapped, unmapped } = mapAmenities(
      ["Maids Room", "Children's Pool", "Built in Kitchen", "Location URL"],
      lookups().amenityLabels,
    );
    expect(mapped).toEqual(["Maid’s Room", "Kids’ Pool", "Fully Fitted Kitchen"]);
    expect(unmapped).toEqual(["Location URL"]);
  });

  it("degrades to unmapped when an alias's target has been renamed", () => {
    const { mapped, unmapped } = mapAmenities(["Shared Pool"], ["Pool (shared)"]);
    expect(mapped).toEqual([]);
    expect(unmapped).toEqual(["Shared Pool"]);
  });
});

describe("plainTextToHtml", () => {
  it("escapes the CRM's text before it becomes markup on a public page", () => {
    expect(plainTextToHtml('<script>alert("x")</script>')).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>",
    );
  });

  it("keeps paragraphs and line breaks", () => {
    expect(plainTextToHtml("One\ntwo\n\nThree")).toBe("<p>One<br>two</p><p>Three</p>");
  });
});

describe("decideState and targetStatus", () => {
  const clean = { sandbox: false, withdrawn: false, hidden: false, holds: [], approved: false, autoPublish: false };
  const hold: Hold = { code: "no_title", fix: "salesforce", message: "x" };

  it("puts evidence of withdrawal above everything, a sandbox above publishing", () => {
    expect(decideState({ ...clean, withdrawn: true, sandbox: true })).toBe("withdrawn");
    expect(decideState({ ...clean, sandbox: true, approved: true })).toBe("mirror_only");
    expect(decideState({ ...clean, hidden: true, approved: true })).toBe("hidden");
    expect(decideState({ ...clean, holds: [hold], approved: true })).toBe("held");
    expect(decideState(clean)).toBe("awaiting_approval");
    expect(decideState({ ...clean, autoPublish: true })).toBe("live");
    expect(decideState({ ...clean, approved: true })).toBe("live");
  });

  it("only ever takes a published listing down, and never touches an archived one it cannot publish", () => {
    expect(targetStatus("live", "draft")).toBe("published");
    expect(targetStatus("live", "archived")).toBe("published");
    expect(targetStatus("held", "published")).toBe("off_market");
    expect(targetStatus("hidden", "published")).toBe("off_market");
    expect(targetStatus("held", "draft")).toBe("draft");
    expect(targetStatus("withdrawn", "archived")).toBe("archived");
    expect(targetStatus("awaiting_approval", null)).toBe("draft");
  });
});

describe("SALESFORCE_OWNED_COLUMNS", () => {
  it("is exactly the always-synced fields — no more, no fewer", () => {
    // The editor's save guard keeps these; if a synced field were missing
    // from the list, an editor's change to it would revert silently fifteen
    // minutes later. The optional three are the CRM's only when it has them.
    const fields = planListing(toSnapshot(COMPLETE_SALE), lookups(), NOW).fields!;
    const always = Object.keys(fields).filter(
      (k) => !["title_ar", "description_ar", "assigned_agent_id"].includes(k),
    );
    expect([...SALESFORCE_OWNED_COLUMNS].sort()).toEqual(always.sort());
  });
});
