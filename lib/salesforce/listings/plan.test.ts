import { describe, expect, it } from "vitest";
import { plainTextToHtml } from "@/lib/plain-text-html";
import {
  SALESFORCE_OWNED_COLUMNS,
  applyCardFlags,
  decideState,
  developerKey,
  mapAmenities,
  planListing,
  resolveDeveloper,
  resolveProject,
  resolveWebsiteArea,
  salesforceTwinColumns,
  targetStatus,
  viewAmenity,
  type Hold,
} from "./plan";
import { toSnapshot } from "./snapshot";
import {
  COMPLETE_SALE,
  EXPIRED_OFF_PLAN_VILLA,
  GUIDE_V13_PRODUCTION_SAMPLE,
  IDS,
  NOW,
  RENT_UNMAPPED,
  SPARSE_PUBLISHED,
  lookups,
} from "./test-fixtures";

const codes = (holds: Hold[]) => holds.map((h) => h.code).sort();

describe("planListing — the v1.3 shapes", () => {
  it("puts a complete listing on the website with nothing held, every fact from Salesforce", () => {
    const plan = planListing(toSnapshot(COMPLETE_SALE), lookups(), NOW);
    expect(plan.holds).toEqual([]);
    expect(plan.fields).toMatchObject({
      title: "4BR Villa on Yas Island",
      short_description: "A garden villa a short walk from the golf course.",
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
      floor: 0,
      year_built: 2019,
      tenure: "freehold",
      view: "Garden View",
      orientation: "East",
      service_charge_per_ft2: 18.5,
      price_aed: 1_850_000,
      area_id: IDS.yas,
      sub_community_id: IDS.yasAcres,
      development_id: IDS.yasAcresProject,
      address_line: "Yas Acres, Yas Island",
      address_line_ar: "ياس ايكرز، جزيرة ياس",
      developer_id: IDS.aldar,
      assigned_agent_id: IDS.advisor,
      listing_permit_no: "ADREC-2026-0042",
      listing_permit_expires_at: "2026-12-31",
      geo: { lat: 24.498, lng: 54.605 },
      title_ar: "فيلا من 4 غرف في جزيرة ياس",
      short_description_ar: "فيلا بحديقة على بعد خطوات من ملعب الغولف.",
      view_ar: "إطلالة على الحدائق",
      orientation_ar: "شرقي",
    });
    expect(plan.fields?.description).toBe("<p>Fully furnished 4-bedroom villa.</p><p>Private garden &amp; maid's room.</p>");
    expect(plan.fields?.description_ar).toContain("<p>");
    // Portal amenities, the website's own extras, and the view's amenity.
    expect(plan.fields?.amenities).toEqual([
      "Central Air Conditioning",
      "Private Garden",
      "Maid’s Room",
      "Majlis",
      "Driver’s Room",
      "Garden Views",
    ]);
    // "Priya testing" is junk in the CRM's amenity picklist; it is reported,
    // never written into the website's taxonomy.
    expect(plan.notes.find((n) => n.code === "unmapped_amenities")?.message).toContain("Priya testing");
    expect(plan.cardFlags).toEqual({ exclusive: true, vacant_on_transfer: false });
  });

  it("plans the guide's own production sample, holding it only for its missing photos", () => {
    const plan = planListing(toSnapshot(GUIDE_V13_PRODUCTION_SAMPLE), lookups(), NOW);
    expect(codes(plan.holds)).toEqual(["no_photos"]);
    expect(plan.fields).toMatchObject({
      mode: "off_plan",
      property_form: "off_plan",
      type: "apartment",
      area_id: IDS.adgm,
      development_id: IDS.hamraProject,
      developer_id: IDS.bloom,
      // Off-plan: the expected completion, from the handover date, not the
      // Year_Built__c the sample also carries.
      year_built: 2026,
      tenure: "freehold",
      view: "Sea View",
      orientation: "East",
      orientation_ar: "شرقي",
      address_line: "Al Hamra Bloom Living, ADGM",
    });
    expect(plan.fields?.amenities).toEqual([
      "Driver’s Room",
      "Guest Bedroom",
      "Home Office",
      "Laundry Room",
      "Majlis",
      "En-Suite Bathrooms",
      "Guest Bathroom",
      "Sea View",
    ]);
    // The advisor's email is not readable: noted with a way to map them.
    expect(plan.unresolved.agent).toEqual({ email: null, name: "Agent Three", id: "005iy000000B7xyAAC" });
    expect(plan.notes.find((n) => n.code === "unmapped_agent")?.message).toContain("no email the integration user can read");
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
        "no_price",
        "no_sale_form",
        "no_title",
        "no_type",
      ].sort(),
    );
    for (const h of plan.holds) expect(h.fix).toBe("salesforce");
    expect(plan.holds.find((h) => h.code === "no_title")?.message).toContain("Title__c");
    expect(plan.holds.find((h) => h.code === "no_location")?.message).toContain("Area__c");
    expect(plan.holds.find((h) => h.code === "no_price")?.message).toBe("Price__c on the listing is blank.");
  });

  it("holds a rental whose Area the website does not have — for the website to fix", () => {
    const plan = planListing(toSnapshot(RENT_UNMAPPED), lookups(), NOW);
    expect(codes(plan.holds)).toEqual(["unmapped_location"]);
    expect(plan.holds[0].fix).toBe("website");
    expect(plan.unresolved.location).toBe("Masdar City");
    // A row can still be created: title, mode, type and price are all there.
    expect(plan.fields).toMatchObject({
      mode: "rent",
      property_form: null,
      type: "apartment",
      price_aed: 145_000,
      furnishing: "semi",
      floor: 12,
      title_ar: "شقة عصرية 3 غرف في مصدر",
      developer_id: IDS.sobha,
      area_id: null,
      address_line: null,
    });
    // An agent who is not staff here: noted, not held.
    expect(plan.notes.map((n) => n.code)).toContain("unmapped_agent");
    expect(plan.fields).not.toHaveProperty("assigned_agent_id");
  });

  it("holds an expired listing, and dates an off-plan villa by its handover", () => {
    const plan = planListing(toSnapshot(EXPIRED_OFF_PLAN_VILLA), lookups(), NOW);
    expect(codes(plan.holds)).toContain("listing_expired");
    expect(plan.fields).toMatchObject({
      type: "villa",
      mode: "off_plan",
      property_form: "off_plan",
      area_id: IDS.hudayriyat,
      developer_id: IDS.modon,
      year_built: 2028,
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
    // The v1.3 samples leave Listing_Status__c blank: that is not inactive.
    expect(planListing({ ...base, listingStatus: null }, lookups(), NOW).holds).toEqual([]);
  });

  it("treats the expiry day itself as still valid", () => {
    // Same rule as the CMS publish gate: a permit is valid through its day.
    const plan = planListing({ ...base, expiresOn: "2026-10-07", permitExpiresOn: "2026-10-07" }, lookups(), NOW);
    expect(plan.holds).toEqual([]);
  });

  it("reads the permit's own expiry, not the listing's", () => {
    const plan = planListing({ ...base, expiresOn: "2027-06-30", permitExpiresOn: "2026-10-15" }, lookups(), NOW);
    expect(plan.fields?.listing_permit_expires_at).toBe("2026-10-15");
    expect(codes(planListing({ ...base, permitExpiresOn: "2026-09-01" }, lookups(), NOW).holds)).toEqual(["permit_expired"]);
    const missing = planListing({ ...base, permitExpiresOn: null }, lookups(), NOW);
    expect(missing.holds[0]).toMatchObject({ code: "no_permit_expiry", fix: "salesforce" });
    expect(missing.holds[0].message).toContain("Permit_Expiry_Date_c__c");
  });

  it("reads Property_Type__c, including the two types v1.3 added", () => {
    expect(planListing({ ...base, websiteType: "Apartment" }, lookups(), NOW).fields?.type).toBe("apartment");
    expect(planListing({ ...base, websiteType: "Full building" }, lookups(), NOW).fields?.type).toBe("building");
    expect(planListing({ ...base, websiteType: "Hotel Apartment" }, lookups(), NOW).fields?.type).toBe("hotel_apartment");
    expect(planListing({ ...base, websiteType: "Commercial Villa", category: null }, lookups(), NOW).fields).toMatchObject({
      type: "commercial_villa",
      segment: "commercial",
    });
    expect(planListing({ ...base, websiteType: "Warehouse", category: null }, lookups(), NOW).fields).toMatchObject({
      type: "commercial",
      segment: "commercial",
    });
    expect(codes(planListing({ ...base, websiteType: "Other" }, lookups(), NOW).holds)).toEqual(["unsupported_type"]);
    // A picklist value nobody told the website about holds rather than guesses.
    expect(codes(planListing({ ...base, websiteType: "Duplex" }, lookups(), NOW).holds)).toEqual(["unsupported_type"]);
    expect(codes(planListing({ ...base, websiteType: null }, lookups(), NOW).holds)).toEqual(["no_type"]);
  });

  it("reads Semi Furnished, with or without the space", () => {
    expect(planListing({ ...base, furnishing: "SemiFurnished" }, lookups(), NOW).fields?.furnishing).toBe("semi");
    expect(planListing({ ...base, furnishing: "Semi Furnished" }, lookups(), NOW).fields?.furnishing).toBe("semi");
  });

  it("holds a rental with no rent frequency — the guide makes it required", () => {
    const rent = toSnapshot(RENT_UNMAPPED);
    const plan = planListing({ ...rent, area: "Yas Island", rentFrequency: null }, lookups(), NOW);
    expect(codes(plan.holds)).toEqual(["no_rent_frequency"]);
    expect(plan.holds[0]).toMatchObject({ fix: "salesforce" });
    expect(plan.holds[0].message).toContain("Rent_Frequency__c");
  });

  it("holds a yearly rental whose price and yearly rent disagree", () => {
    // What the production sweep of 1 Oct 2026 found: the sale price in
    // Price__c on a rental, the rent in Yearly__c.
    const rent = { ...toSnapshot(RENT_UNMAPPED), area: "Yas Island" };
    const plan = planListing({ ...rent, listingPrice: 1_850_000, yearlyRent: 85_000 }, lookups(), NOW);
    expect(codes(plan.holds)).toEqual(["rent_price_mismatch"]);
    expect(plan.holds[0].message).toBe(
      "Price__c (AED 1,850,000) and Yearly__c (AED 85,000) disagree. For a yearly rental, Price__c is the annual rent.",
    );
    expect(planListing({ ...rent, listingPrice: 85_000, yearlyRent: 85_000 }, lookups(), NOW).holds).toEqual([]);
    expect(planListing({ ...rent, listingPrice: null, yearlyRent: 85_000 }, lookups(), NOW).fields?.price_aed).toBe(85_000);
  });

  it("shows yearly rent, and holds a monthly rent with no yearly figure", () => {
    const rent = { ...toSnapshot(RENT_UNMAPPED), area: "Yas Island" };
    const monthly = { ...rent, rentFrequency: "Monthly", listingPrice: 12_000, yearlyRent: null };
    expect(codes(planListing(monthly, lookups(), NOW).holds)).toContain("rent_not_yearly");

    const withYearly = { ...monthly, yearlyRent: 144_000 };
    const plan = planListing(withYearly, lookups(), NOW);
    expect(plan.fields?.price_aed).toBe(144_000);
    expect(plan.notes.map((n) => n.code)).toContain("rent_from_yearly");
  });

  it("does not ask a plot of land for bedrooms", () => {
    const land = { ...base, websiteType: "Land", beds: null, baths: null };
    expect(codes(planListing(land, lookups(), NOW).holds)).toEqual([]);
    const flat = { ...base, beds: null };
    expect(codes(planListing(flat, lookups(), NOW).holds)).toEqual(["no_bedrooms"]);
  });

  it("holds a listing with no photos at all", () => {
    const bare = { ...base, cover: null, gallery: [], floorPlan: null };
    expect(codes(planListing(bare, lookups(), NOW).holds)).toEqual(["no_photos"]);
  });

  it("notes a listing published without Website among its platforms", () => {
    const plan = planListing({ ...base, platforms: ["Bayut"] }, lookups(), NOW);
    expect(plan.holds).toEqual([]);
    expect(plan.notes.map((n) => n.code)).toContain("platform_without_website");
    expect(planListing({ ...base, platforms: [] }, lookups(), NOW).notes.map((n) => n.code)).not.toContain(
      "platform_without_website",
    );
  });
});

describe("planListing — the facts v1.3 added", () => {
  const base = toSnapshot(COMPLETE_SALE);

  it("writes out compass letters and keeps anything else as typed", () => {
    expect(planListing({ ...base, orientation: "NE" }, lookups(), NOW).fields?.orientation).toBe("North-East");
    expect(planListing({ ...base, orientation: "south west" }, lookups(), NOW).fields?.orientation).toBe("South-West");
    expect(planListing({ ...base, orientation: "Corner unit" }, lookups(), NOW).fields?.orientation).toBe("Corner unit");
  });

  it("reads the three tenures and notes anything else", () => {
    expect(planListing({ ...base, tenure: "Usufruct" }, lookups(), NOW).fields?.tenure).toBe("usufruct");
    const odd = planListing({ ...base, tenure: "Musataha" }, lookups(), NOW);
    expect(odd.fields?.tenure).toBeNull();
    expect(odd.notes.map((n) => n.code)).toContain("tenure_unknown");
  });

  it("takes the year built from a past handover when a completed home has none, and refuses an impossible year", () => {
    const handed = planListing({ ...base, yearBuilt: null, handoverOn: "2021-03-01" }, lookups(), NOW);
    expect(handed.fields?.year_built).toBe(2021);
    // A future handover on a ready home is a plan, not a year built.
    expect(planListing({ ...base, yearBuilt: null, handoverOn: "2027-03-01" }, lookups(), NOW).fields?.year_built).toBeNull();
    const typo = planListing({ ...base, yearBuilt: 219 }, lookups(), NOW);
    expect(typo.fields?.year_built).toBeNull();
    expect(typo.notes.map((n) => n.code)).toContain("year_out_of_range");
  });

  it("keeps a service charge only in AED per sq ft per year", () => {
    expect(planListing({ ...base, serviceChargeSqft: 12.345 }, lookups(), NOW).fields?.service_charge_per_ft2).toBe(12.35);
    const total = planListing({ ...base, serviceChargeSqft: 58_000 }, lookups(), NOW);
    expect(total.fields?.service_charge_per_ft2).toBeNull();
    expect(total.notes.map((n) => n.code)).toContain("service_charge_out_of_range");
  });

  it("notes a project the website has no page for, and does not link it", () => {
    const plan = planListing({ ...base, project: { id: "a05x", name: "Yas Golf Collection" } }, lookups(), NOW);
    expect(plan.holds).toEqual([]);
    expect(plan.fields?.development_id).toBeNull();
    expect(plan.unresolved.project).toBe("Yas Golf Collection");
    expect(plan.notes.map((n) => n.code)).toContain("unmapped_project");
    // The address falls back to the sub-area.
    expect(plan.fields?.address_line).toBe("Yas Acres, Yas Island");
  });

  it("clears an Arabic twin with its English, and leaves the website's twin when only the English came", () => {
    const blankView = planListing({ ...base, view: null, viewAr: null }, lookups(), NOW).fields!;
    expect(blankView).toMatchObject({ view: null, view_ar: null });
    const englishOnly = planListing({ ...base, shortDescriptionAr: null }, lookups(), NOW).fields!;
    expect(englishOnly.short_description).toBe("A garden villa a short walk from the golf course.");
    expect(englishOnly).not.toHaveProperty("short_description_ar");
    const noDescription = planListing({ ...base, description: null }, lookups(), NOW).fields!;
    expect(noDescription).toMatchObject({ description: null, description_ar: null });
  });

  it("clips to the editor's own limits, so saving a synced listing cannot fail validation", () => {
    const long = planListing({ ...base, shortDescription: "x".repeat(400), view: "v".repeat(140) }, lookups(), NOW).fields!;
    expect(long.short_description).toHaveLength(320);
    expect(long.view).toHaveLength(100);
  });
});

describe("salesforceTwinColumns", () => {
  it("owns the twins Salesforce wrote and the ones whose English it left blank", () => {
    const s = toSnapshot(COMPLETE_SALE);
    expect(salesforceTwinColumns(s).sort()).toEqual(
      ["description_ar", "orientation_ar", "short_description_ar", "title_ar", "view_ar"].sort(),
    );
    expect(salesforceTwinColumns({ ...s, titleAr: null, viewAr: null, view: null })).not.toContain("title_ar");
    expect(salesforceTwinColumns({ ...s, titleAr: null, viewAr: null, view: null })).toContain("view_ar");
  });
});

describe("resolveWebsiteArea", () => {
  it("places a listing by Area and Sub-area, the sub-area only within its area", () => {
    expect(resolveWebsiteArea("Saadiyat Island", "Saadiyat Lagoons", "Abu Dhabi", lookups())).toEqual({
      place: { area_id: IDS.saadiyat, sub_community_id: IDS.lagoons, building_id: null },
      subAreaMissed: false,
    });
    // Saadiyat Lagoons is a sub-area of Saadiyat Island, not of Yas.
    expect(resolveWebsiteArea("Yas Island", "Saadiyat Lagoons", "Abu Dhabi", lookups())).toEqual({
      place: { area_id: IDS.yas, sub_community_id: null, building_id: null },
      subAreaMissed: true,
    });
  });

  it("notes a sub-area the website does not have, and places the listing in its area", () => {
    const plan = planListing({ ...toSnapshot(COMPLETE_SALE), subArea: "West Yas" }, lookups(), NOW);
    expect(plan.holds).toEqual([]);
    expect(plan.fields).toMatchObject({ area_id: IDS.yas, sub_community_id: null });
    expect(plan.unresolved.location).toBe("West Yas, Yas Island");
    expect(plan.notes.map((n) => n.code)).toContain("unmapped_sub_area");
  });

  it("forgives a missing 'Island' or 'City', but never guesses between two", () => {
    expect(resolveWebsiteArea("Yas", null, null, lookups())?.place.area_id).toBe(IDS.yas);
    expect(resolveWebsiteArea("al-reem-island", null, null, lookups())?.place.area_id).toBe(IDS.reem);
    const l = lookups();
    l.areas.push({ id: "00000000-0000-4000-8000-00000000009b", name: "Yas City", slug: "yas-city", kind: "area", parent_id: IDS.abuDhabi });
    expect(resolveWebsiteArea("Yas District", null, null, l)).toBeNull();
  });

  it("never files another emirate's listing under Abu Dhabi", () => {
    expect(resolveWebsiteArea("Yas Island", null, "Dubai", lookups())).toBeNull();
  });

  it("takes an admin's mapping over any automatic match", () => {
    const l = lookups({
      mappings: {
        location: new Map([["masdar city", IDS.reem]]),
        developer: new Map(),
        agent: new Map(),
      },
    });
    expect(resolveWebsiteArea("Masdar City", null, "Abu Dhabi", l)?.place.area_id).toBe(IDS.reem);
    expect(resolveWebsiteArea("MASDAR  city", null, "Abu Dhabi", l)?.place.area_id).toBe(IDS.reem);
    // A whole "Sub-area, Area" answer goes straight to the sub-community.
    const sub = lookups({
      mappings: { location: new Map([["west yas yas island", IDS.yasAcres]]), developer: new Map(), agent: new Map() },
    });
    expect(resolveWebsiteArea("Yas Island", "West Yas", "Abu Dhabi", sub)?.place).toEqual({
      area_id: IDS.yas,
      sub_community_id: IDS.yasAcres,
      building_id: null,
    });
  });
});

describe("resolveDeveloper and resolveProject", () => {
  it("matches developers through the suffixes they are written with", () => {
    expect(developerKey("ALDAR Properties PJSC")).toBe("aldar");
    expect(resolveDeveloper("Aldar Properties", lookups())).toBe(IDS.aldar);
    expect(resolveDeveloper("Modon", lookups())).toBe(IDS.modon);
    expect(resolveDeveloper("Emaar", lookups())).toBeNull();
  });

  it("matches a project by its page's name or slug, and only one", () => {
    expect(resolveProject("Al Hamra Bloom Living", lookups())?.id).toBe(IDS.hamraProject);
    expect(resolveProject("al-hamra", lookups())?.id).toBe(IDS.hamraProject);
    expect(resolveProject("Bloom Living", lookups())).toBeNull();
  });
});

describe("mapAmenities and viewAmenity", () => {
  it("matches through apostrophes and hyphens, and aliases the rest", () => {
    const { mapped, unmapped } = mapAmenities(
      ["Maids Room", "Children's Pool", "Built in Kitchen", "Location URL", "Driver's Room"],
      lookups().amenityLabels,
    );
    expect(mapped).toEqual(["Maid’s Room", "Kids’ Pool", "Fully Fitted Kitchen", "Driver’s Room"]);
    expect(unmapped).toEqual(["Location URL"]);
  });

  it("degrades to unmapped when an alias's target has been renamed", () => {
    const { mapped, unmapped } = mapAmenities(["Shared Pool"], ["Pool (shared)"]);
    expect(mapped).toEqual([]);
    expect(unmapped).toEqual(["Shared Pool"]);
  });

  it("finds a view's amenity, singular or plural, and nothing for a view the taxonomy lacks", () => {
    const labels = lookups().amenityLabels;
    expect(viewAmenity("Sea View", labels)).toBe("Sea View");
    expect(viewAmenity("Garden View", labels)).toBe("Garden Views");
    expect(viewAmenity("Skyline View", labels)).toBe("Abu Dhabi Skyline Views");
    expect(viewAmenity("Partial Sea View", labels)).toBeNull();
  });
});

describe("applyCardFlags", () => {
  it("applies Salesforce's two checkboxes and leaves the rest of the bag alone", () => {
    const current = { labels: ["new_launch", "vacant_on_transfer"], feature_on_homepage: true };
    expect(applyCardFlags(current, { exclusive: true, vacant_on_transfer: false })).toEqual({
      labels: ["new_launch"],
      feature_on_homepage: true,
      exclusive: true,
      vacant_on_transfer: false,
    });
  });

  it("changes nothing when Salesforce agrees, or when it cannot say", () => {
    expect(applyCardFlags({ exclusive: true, vacant_on_transfer: false }, { exclusive: true, vacant_on_transfer: false })).toBeNull();
    expect(applyCardFlags({ labels: ["exclusive"] }, { exclusive: null, vacant_on_transfer: null })).toBeNull();
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
    // minutes later. The Arabic twins and the advisor are the CRM's only some
    // of the time (salesforceTwinColumns, resolveAgent).
    const fields = planListing(toSnapshot(COMPLETE_SALE), lookups(), NOW).fields!;
    const sometimes = ["title_ar", "short_description_ar", "description_ar", "view_ar", "orientation_ar", "assigned_agent_id"];
    const always = Object.keys(fields).filter((k) => !sometimes.includes(k));
    expect([...SALESFORCE_OWNED_COLUMNS].sort()).toEqual(always.sort());
  });
});
