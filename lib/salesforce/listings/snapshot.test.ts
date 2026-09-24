import { describe, expect, it } from "vitest";
import {
  imageKey,
  imagesInRichText,
  imagesInUrlList,
  parseCoordinates,
  parseImageAddress,
  parseRooms,
  snapshotHash,
  stableStringify,
  toSnapshot,
} from "./snapshot";
import {
  COMPLETE_SALE,
  EXPIRED_OFF_PLAN_VILLA,
  RENT_UNMAPPED,
  SPARSE_PUBLISHED,
} from "./test-fixtures";
import {
  NEVER_READ,
  deletedSoql,
  selectList,
  statusSoql,
  sweepSoql,
} from "./fields";

describe("fields", () => {
  it("never selects the owner's name or phone number", () => {
    // The guide's step 4 returns every field, owner included. The sweep is an
    // allowlist so a copy of a seller's contact details can never land here.
    const select = selectList();
    for (const f of NEVER_READ) {
      expect(select).not.toMatch(new RegExp(`\\b${f}\\b`));
    }
    expect(sweepSoql()).not.toMatch(/FIELDS\(/i);
  });

  it("reads only what a describe says is visible, when narrowed", () => {
    const select = selectList({
      listing: new Set(["Id", "Name", "Website_Status__c", "Property__c"]),
      property: new Set(["Id", "Title__c"]),
    });
    expect(select).toContain("Property__r.Title__c");
    expect(select).not.toContain("Property__r.Description__c");
    expect(select).not.toContain("Assigned_Agent__r");
  });

  it("refuses anything that is not a Salesforce id before it reaches SOQL", () => {
    // Ids are interpolated into the query, so this is the injection guard.
    expect(statusSoql(["a03iy000000R7rpAAC", "x' OR Name != '"])).toBe(
      "SELECT Id, Website_Status__c, Listing_Status__c FROM Property_Listing__c WHERE Id IN ('a03iy000000R7rpAAC')",
    );
    expect(deletedSoql(["' OR 1=1 --"])).toBeNull();
  });
});

describe("parsing the CRM's formats", () => {
  it("reads Rooms__c and Bathrooms__c, which are string picklists", () => {
    expect(parseRooms("Studio")).toBe(0);
    expect(parseRooms("6")).toBe(6);
    expect(parseRooms("")).toBeNull();
    expect(parseRooms("6+")).toBeNull();
  });

  it("accepts coordinates only inside the UAE", () => {
    expect(parseCoordinates("24.4980", "54.6050")).toEqual({ lat: 24.498, lng: 54.605 });
    // Swapped: a pin in the Indian Ocean is worse than no pin.
    expect(parseCoordinates("54.6050", "24.4980")).toBeNull();
    expect(parseCoordinates("0", "0")).toBeNull();
    expect(parseCoordinates("", "54.6")).toBeNull();
  });

  it("turns Salesforce File links into references it can fetch with the API", () => {
    expect(
      parseImageAddress("/sfc/servlet.shepherd/version/download/068iy0000002GlRAAU", "Listing_Images__c"),
    ).toEqual({ kind: "cv", id: "068iy0000002GlRAAU" });
    expect(
      parseImageAddress(
        "https://org--sand.sandbox.file.force.com/servlet/rtaImage?eid=a01&amp;feoid=00N&amp;refid=0EMiy0000000XyZ",
        "Floor_Plans__c",
      ),
    ).toEqual({ kind: "rta", field: "Floor_Plans__c", refId: "0EMiy0000000XyZ" });
    expect(parseImageAddress("data:image/png;base64,AAAA", "x")).toBeNull();
    expect(parseImageAddress("javascript:alert(1)", "x")).toBeNull();
  });

  it("keeps rich-text photos in the order the CRM user placed them", () => {
    const refs = imagesInRichText(SPARSE_PUBLISHED.Property__r!.Listing_Images__c!, "Listing_Images__c");
    expect(refs.map((r) => (r.kind === "cv" ? r.id : null))).toEqual([
      "068iy0000002GlRAAU",
      "068iy0000002Gn3AAE",
    ]);
  });

  it("splits a URL list on commas only where a new URL starts", () => {
    // The guide says semicolons; the sandbox sends commas; Cloudinary puts
    // commas inside a single URL. All three have to come out right.
    expect(imagesInUrlList("https://a.test/1.jpg,https://a.test/2.jpg", "f")).toHaveLength(2);
    expect(imagesInUrlList("https://a.test/1.jpg; https://a.test/2.jpg", "f")).toHaveLength(2);
    const cloudinary = imagesInUrlList(
      "https://res.cloudinary.com/x/image/upload/w_1200,h_800/v1/a.jpg,https://a.test/2.jpg",
      "f",
    );
    expect(cloudinary).toEqual([
      { kind: "url", url: "https://res.cloudinary.com/x/image/upload/w_1200,h_800/v1/a.jpg" },
      { kind: "url", url: "https://a.test/2.jpg" },
    ]);
  });
});

describe("toSnapshot", () => {
  it("normalises the sparse published listing without inventing anything", () => {
    const s = toSnapshot(SPARSE_PUBLISHED);
    expect(s.title).toBeNull();
    expect(s.location).toBeNull();
    expect(s.listingPrice).toBeNull();
    expect(s.propertyPrice).toBe(1_000_000);
    expect(s.offering).toBe("Sale");
    expect(s.beds).toBe(6);
    expect(s.baths).toBe(3);
    expect(s.gallery).toHaveLength(2);
    expect(s.cover).toBeNull();
    expect(s.agent).toEqual({ id: "005iy000000A9ozAAC", name: "Agent One", email: "agent.one@crm.example" });
    expect(s.lastModifiedAt).toBe("2026-09-24T05:09:47.000+0000");
  });

  it("takes the listing's own offer over the property's", () => {
    // LST-00002 in the sandbox says Rent on the listing and Sale on the
    // property. The listing is the offer.
    const s = toSnapshot({ ...COMPLETE_SALE, Sale_Rent__c: "Rent" });
    expect(s.offering).toBe("Rent");
    expect(toSnapshot({ ...COMPLETE_SALE, Sale_Rent__c: null }).offering).toBe(null);
    expect(
      toSnapshot({ ...RENT_UNMAPPED, Sale_Rent__c: null }).offering,
    ).toBe("Rent");
  });

  it("uses the cover once, not twice", () => {
    const s = toSnapshot(COMPLETE_SALE);
    expect(s.cover).toEqual({ kind: "cv", id: "068iy0000002S53AAE" });
    // The same file is also first in the gallery field; it is the hero, so it
    // is not repeated in the gallery.
    expect(s.gallery.map((g) => imageKey(g, s.propertyId))).toEqual([
      "cv:068iy0000002S9tAAE",
      expect.stringMatching(/^url:/),
    ]);
    expect(s.floorPlan).toEqual({ kind: "rta", field: "Floor_Plans__c", refId: "0EMiy0000000XyZ" });
  });

  it("falls back to Main_Image_URL__c for the cover", () => {
    const s = toSnapshot(RENT_UNMAPPED);
    expect(s.cover).toEqual({ kind: "url", url: "https://example.com/properties/property-3-main.jpg" });
  });

  it("reads the off-plan villa's two type fields as they are", () => {
    const s = toSnapshot(EXPIRED_OFF_PLAN_VILLA);
    expect(s.crmType).toBe("Duplex");
    expect(s.bayutType).toBe("Villa");
    expect(s.expiresOn).toBe("2026-09-18");
  });
});

describe("snapshotHash", () => {
  it("ignores the CRM's own modification stamp", () => {
    // An inquiry counter ticking up moves LastModifiedDate without changing
    // anything the website shows.
    const a = toSnapshot(SPARSE_PUBLISHED);
    const b = toSnapshot({ ...SPARSE_PUBLISHED, LastModifiedDate: "2027-01-01T00:00:00.000+0000" });
    expect(snapshotHash(a)).toBe(snapshotHash(b));
  });

  it("changes when a shown field changes", () => {
    const a = toSnapshot(COMPLETE_SALE);
    const b = toSnapshot({ ...COMPLETE_SALE, Price__c: 1_900_000 });
    expect(snapshotHash(a)).not.toBe(snapshotHash(b));
  });

  it("does not depend on key order", () => {
    expect(stableStringify({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(stableStringify({ a: [{ c: 3, d: 2 }], b: 1 }));
  });
});
