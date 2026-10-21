import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./fake-supabase";
import {
  COMPLETE_SALE,
  IDS,
  RENT_UNMAPPED,
  SPARSE_PUBLISHED,
  NOW,
} from "./test-fixtures";

const h = vi.hoisted(() => ({
  org: "bazarrealestate.my.salesforce.com" as string | null,
  configured: true,
  db: null as unknown as import("./fake-supabase").FakeDb,
  sweep: [] as unknown[],
  absences: new Map<string, unknown>(),
  download: null as unknown as (ref: { kind: string }) => Promise<unknown>,
  heartbeats: [] as { job: string; ok: boolean; detail?: string | null }[],
  issues: [] as string[],
  patches: [] as { path: string; body: Record<string, unknown> }[],
  patchFails: false,
}));

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://db.test" },
  get isSalesforceConfigured() {
    return h.configured;
  },
  isSupabaseConfigured: true,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.db.client() }));
vi.mock("@/lib/salesforce/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/salesforce/client")>();
  return {
    ...actual,
    salesforceOrgHost: () => h.org,
    salesforceRequest: async (path: string, init: { method: string; body?: Record<string, unknown> }) => {
      if (init.method !== "PATCH") throw new Error(`unexpected ${init.method} ${path}`);
      if (h.patchFails) {
        throw new actual.SalesforceError("insufficient access rights on object id", {
          status: 400,
          errorCode: "INSUFFICIENT_ACCESS_OR_READONLY",
          retryable: false,
        });
      }
      h.patches.push({ path, body: init.body ?? {} });
      return null;
    },
  };
});
vi.mock("./fetch", () => ({
  fetchPublishedListings: async () => ({ records: h.sweep, hiddenFields: [] }),
  explainAbsences: async (ids: string[]) => new Map(ids.map((id) => [id, h.absences.get(id) ?? { kind: "invisible" }])),
}));
vi.mock("./images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./images")>();
  return { ...actual, downloadImage: (ref: { kind: string }) => h.download(ref) };
});
vi.mock("@/lib/observability", () => ({
  recordHeartbeat: async (job: string, o: { ok: boolean; detail?: string | null }) => {
    h.heartbeats.push({ job, ...o });
  },
  reportError: async () => undefined,
  reportIssue: async (message: string) => {
    h.issues.push(message);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/i18n/revalidate", () => ({ revalidateLocalised: () => undefined }));
vi.mock("@/lib/i18n/mt/translate", () => ({ hashSource: (t: string) => `h${t.length}` }));

const { runListingSync, writeBackDelta, writeBackFor } = await import("./sync");
const { imageKey, toSnapshot } = await import("./snapshot");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0]);
let revalidated = 0;
// On the fixtures' clock, not the calendar's: RENT_UNMAPPED's listing expires on
// 1 Oct 2026, and with the real date every run after that held it as expired.
const run = (extra: Partial<Parameters<typeof runListingSync>[0]> = {}) =>
  runListingSync({ trigger: "cron", revalidate: () => void (revalidated += 1), now: NOW, ...extra });

function seedLookups(db: FakeDb) {
  db.seed(
    "areas",
    { id: IDS.abuDhabi, name: "Abu Dhabi", name_ar: "أبوظبي", slug: "abu-dhabi", kind: "emirate", parent_id: null },
    { id: IDS.yas, name: "Yas Island", name_ar: "جزيرة ياس", slug: "yas-island", kind: "area", parent_id: IDS.abuDhabi },
    { id: IDS.yasAcres, name: "Yas Acres", name_ar: "ياس ايكرز", slug: "yas-acres", kind: "sub_community", parent_id: IDS.yas },
    { id: IDS.reem, name: "Al Reem Island", name_ar: "جزيرة الريم", slug: "al-reem-island", kind: "area", parent_id: IDS.abuDhabi },
  );
  db.seed("developers", { id: IDS.aldar, name: "ALDAR Properties" }, { id: IDS.sobha, name: "Sobha Realty" });
  db.seed("developments", { id: IDS.yasAcresProject, name: "Yas Acres", name_ar: "ياس ايكرز", slug: "yas-acres" });
  db.seed("staff", { user_id: IDS.advisor, status: "active", public_email: null });
  db.users.push({ id: IDS.advisor, email: "advisor@bazar.ae" });
  db.seed(
    "amenities_taxonomy",
    { label: "Central Air Conditioning", active: true, sort_order: 1 },
    { label: "Private Garden", active: true, sort_order: 2 },
    { label: "Maid’s Room", active: true, sort_order: 3 },
  );
  db.seed("salesforce_listing_sync", { id: 1, paused: false, auto_publish: false });
}

function property(db: FakeDb, sfId: string) {
  return db.rows("properties").find((p) => p.salesforce_listing_id === sfId) as Record<string, unknown> | undefined;
}
function mirror(db: FakeDb, sfId: string) {
  return db.rows("salesforce_listings").find((m) => m.sf_listing_id === sfId) as Record<string, unknown> | undefined;
}

beforeEach(() => {
  h.db = new FakeDb();
  seedLookups(h.db);
  h.org = "bazarrealestate.my.salesforce.com";
  h.configured = true;
  h.sweep = [COMPLETE_SALE];
  h.absences = new Map();
  h.download = async () => ({ ok: true, bytes: JPEG, sniffed: { mime: "image/jpeg", ext: "jpg" } });
  h.heartbeats = [];
  h.issues = [];
  h.patches = [];
  h.patchFails = false;
  revalidated = 0;
});

describe("when there is nothing to talk to", () => {
  it("stamps an idle heartbeat without Salesforce credentials", async () => {
    h.configured = false;
    const s = await run();
    expect(s.skipped).toBe("no salesforce");
    expect(h.heartbeats).toEqual([{ job: "salesforce-listing-sync", ok: true, detail: "idle — no Salesforce credentials" }]);
  });

  it("does nothing while paused", async () => {
    h.db.rows("salesforce_listing_sync")[0].paused = true;
    const s = await run();
    expect(s.skipped).toBe("paused");
    expect(h.db.rows("salesforce_listings")).toHaveLength(0);
  });

  it("steps aside when another run holds the lease", async () => {
    h.db.lease = { holder: "someone-else", until: Date.now() + 60_000 };
    const s = await run();
    expect(s.skipped).toBe("busy");
    expect(h.db.rows("properties")).toHaveLength(0);
  });
});

describe("a sandbox org", () => {
  it("evaluates every listing and publishes nothing, anywhere", async () => {
    h.org = "bazarrealestate--sand.sandbox.my.salesforce.com";
    h.sweep = [COMPLETE_SALE, SPARSE_PUBLISHED];
    const download = vi.fn(h.download);
    h.download = download;

    const s = await run();
    expect(s.sandbox).toBe(true);
    expect(h.db.rows("properties")).toHaveLength(0);
    expect(h.db.objects.size).toBe(0);
    expect(download).not.toHaveBeenCalled();
    expect(mirror(h.db, COMPLETE_SALE.Id)?.state).toBe("mirror_only");
    // Its holds are still worked out, so the screen shows what WOULD happen.
    expect((mirror(h.db, SPARSE_PUBLISHED.Id)?.holds as { code: string }[]).map((x) => x.code)).toContain("no_title");
  });

  it("clears a sandbox's rows once the org is production", async () => {
    h.org = "bazarrealestate--sand.sandbox.my.salesforce.com";
    await run();
    expect(h.db.rows("salesforce_listings")).toHaveLength(1);
    h.org = "bazarrealestate.my.salesforce.com";
    h.sweep = [];
    await run();
    expect(h.db.rows("salesforce_listings")).toHaveLength(0);
  });
});

describe("a production org", () => {
  it("creates the listing as a draft with its photos, and hands it to the website", async () => {
    const s = await run();
    expect(s.created).toBe(1);
    const p = property(h.db, COMPLETE_SALE.Id)!;
    expect(p).toMatchObject({ status: "draft", title: "4BR Villa on Yas Island", price_aed: 1_850_000, area_id: IDS.yas });
    expect(p.reference).toMatch(/^BAZ-AD-0\d{4}$/);
    expect(p.slug).toBe("4br-villa-on-yas-island");
    expect(mirror(h.db, COMPLETE_SALE.Id)?.state).toBe("on_website");

    // Cover (a File), one more File, one web photo, and the floor plan.
    expect(h.db.objects.size).toBe(4);
    const links = h.db.rows("property_media").filter((l) => l.property_id === p.id);
    expect(links.map((l) => l.role).sort()).toEqual(["floor_plan", "gallery", "gallery", "hero"]);
    expect(revalidated).toBe(1);
  });

  it("never publishes, whatever the old auto-publish switch says", async () => {
    h.db.rows("salesforce_listing_sync")[0].auto_publish = true;
    await run();
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("draft");
  });

  it("writes nothing on a run where nothing is new", async () => {
    await run();
    const before = JSON.stringify(property(h.db, COMPLETE_SALE.Id));
    const download = vi.fn(h.download);
    h.download = download;
    const s = await run();
    expect(s).toMatchObject({ created: 0, onWebsite: 1, imagesCopied: 0 });
    expect(download).not.toHaveBeenCalled();
    expect(JSON.stringify(property(h.db, COMPLETE_SALE.Id))).toBe(before);
  });

  it("knows a photo it copied long ago, however many photos came before it", async () => {
    // Supabase returns at most 1,000 rows to an unpaginated select. Put this
    // listing's photos past that point and the sync must still find them —
    // otherwise every photo beyond row 1,000 is downloaded again, every run.
    const snap = toSnapshot(COMPLETE_SALE);
    for (let i = 0; i < 1050; i++) {
      h.db.seed("salesforce_media", { source_key: `url:filler-${i}`, media_id: `00000000-0000-4000-9000-${String(i).padStart(12, "0")}` });
    }
    const refs = [snap.cover!, ...snap.gallery, snap.floorPlan!];
    refs.forEach((r, i) => {
      const media_id = `00000000-0000-4000-a000-${String(i).padStart(12, "0")}`;
      h.db.seed("media_assets", { id: media_id, storage_key: `listings/x-${i}.jpg`, filename: "x.jpg", mime_type: "image/jpeg" });
      h.db.seed("salesforce_media", { source_key: imageKey(r, snap.propertyId), media_id });
    });
    const download = vi.fn(h.download);
    h.download = download;
    await run();
    expect(download).not.toHaveBeenCalled();
    expect(mirror(h.db, COMPLETE_SALE.Id)?.images_ready).toBe(4);
  });

  it("keeps every edit an editor makes to the draft, CRM fields included", async () => {
    await run();
    const p = property(h.db, COMPLETE_SALE.Id)!;
    Object.assign(p, {
      title: "An editor's title",
      price_aed: 999_000,
      area_id: IDS.reem,
      address_line: "Bab Al Qasr Resort Residence 19, Masdar City",
      geo: { lat: 24.4339, lng: 54.6209 },
      developer_id: IDS.sobha,
      amenities: ["Private Garden"],
      listing_permit_no: "EDITOR-1",
      view_ar: "عربي المحرر",
      assigned_agent_id: null,
      flags: { exclusive: false, vacant_on_transfer: true, labels: ["vacant_on_transfer"] },
      status: "published",
    });
    const edited = JSON.stringify(p);
    // Salesforce changes the same fields afterwards: none of it reaches the row.
    h.sweep = [
      {
        ...COMPLETE_SALE,
        Price__c: 2_000_000,
        Property__r: { ...COMPLETE_SALE.Property__r, Title__c: "Salesforce's new title", View__c: null, View_Arabic__c: null },
      },
    ];
    await run();
    expect(JSON.stringify(property(h.db, COMPLETE_SALE.Id))).toBe(edited);
    expect(mirror(h.db, COMPLETE_SALE.Id)?.state).toBe("on_website");
    // The mirror still shows the CRM's latest, for reference.
    expect((mirror(h.db, COMPLETE_SALE.Id)?.snapshot as { title: string }).title).toBe("Salesforce's new title");
  });

  it("keeps the editor's photos: removed ones stay removed, added ones stay", async () => {
    await run();
    const p = property(h.db, COMPLETE_SALE.Id)!;
    const links = h.db.rows("property_media");
    const kept = links.filter((l) => l.property_id === p.id && l.role !== "hero");
    links.length = 0;
    links.push(...kept, { property_id: p.id, media_id: "00000000-0000-4000-b000-000000000001", role: "hero", sort_order: 0 });
    const before = JSON.stringify(links);
    await run();
    expect(JSON.stringify(h.db.rows("property_media"))).toBe(before);
  });

  it("writes every fact v1.3 added into the draft, and records the Arabic as the CRM's own", async () => {
    await run();
    const p = property(h.db, COMPLETE_SALE.Id)!;
    expect(p).toMatchObject({
      short_description: "A garden villa a short walk from the golf course.",
      tenure: "freehold",
      year_built: 2019,
      view: "Garden View",
      orientation: "East",
      service_charge_per_ft2: 18.5,
      sub_community_id: IDS.yasAcres,
      development_id: IDS.yasAcresProject,
      address_line: "Yas Acres, Yas Island",
      address_line_ar: "ياس ايكرز، جزيرة ياس",
      short_description_ar: "فيلا بحديقة على بعد خطوات من ملعب الغولف.",
      view_ar: "إطلالة على الحدائق",
      orientation_ar: "شرقي",
      flags: { exclusive: true, vacant_on_transfer: false },
    });
    const i18n = p.i18n as Record<string, { source: string }>;
    for (const twin of ["title_ar", "short_description_ar", "description_ar", "view_ar", "orientation_ar"]) {
      expect(i18n[twin]?.source).toBe("human");
    }
  });

  it("does not bring back a draft an editor deleted, until someone allows it", async () => {
    await run();
    const rows = h.db.rows("properties");
    rows.length = 0;
    await run();
    expect(h.db.rows("properties")).toHaveLength(0);
    expect(mirror(h.db, COMPLETE_SALE.Id)).toMatchObject({ state: "hidden" });
    expect(mirror(h.db, COMPLETE_SALE.Id)?.hidden_at).toBeTruthy();

    // "Allow on website": a fresh draft.
    mirror(h.db, COMPLETE_SALE.Id)!.hidden_at = null;
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("draft");
    expect(mirror(h.db, COMPLETE_SALE.Id)?.state).toBe("on_website");
  });

  it("makes no draft for a listing hidden before it arrived, and copies no photos for it", async () => {
    h.db.seed("salesforce_listings", {
      sf_listing_id: COMPLETE_SALE.Id,
      org_host: "bazarrealestate.my.salesforce.com",
      state: "held",
      hidden_at: "2026-09-20T00:00:00Z",
      snapshot: { v: 3, listingId: COMPLETE_SALE.Id },
      snapshot_hash: "x",
    });
    const download = vi.fn(h.download);
    h.download = download;
    await run();
    expect(h.db.rows("properties")).toHaveLength(0);
    expect(download).not.toHaveBeenCalled();
    expect(mirror(h.db, COMPLETE_SALE.Id)?.state).toBe("hidden");
  });

  it("ignores a hide on a listing already on the website: the editor unpublishes it there", async () => {
    await run();
    property(h.db, COMPLETE_SALE.Id)!.status = "published";
    mirror(h.db, COMPLETE_SALE.Id)!.hidden_at = new Date().toISOString();
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    expect(mirror(h.db, COMPLETE_SALE.Id)?.state).toBe("on_website");
  });
});

describe("withdrawals", () => {
  async function published() {
    await run();
    property(h.db, COMPLETE_SALE.Id)!.status = "published";
    h.sweep = [];
  }

  it("records a listing Salesforce says is unpublished, and leaves the website's listing as it is", async () => {
    await published();
    h.absences.set(COMPLETE_SALE.Id, { kind: "unpublished", reason: "Website_Status__c is blank in Salesforce" });
    const s = await run();
    expect(s.withdrawn).toBe(1);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    expect(mirror(h.db, COMPLETE_SALE.Id)).toMatchObject({ state: "withdrawn", withdrawn_reason: "Website_Status__c is blank in Salesforce" });
  });

  it("leaves a listing alone when Salesforce will not say anything about it", async () => {
    await published();
    const s = await run();
    expect(s.invisible).toBe(1);
    expect(s.withdrawn).toBe(0);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    expect(h.issues).toContain("Salesforce listings no longer visible to the integration user");
  });

  it("clears the withdrawal when Salesforce republishes it", async () => {
    await published();
    h.absences.set(COMPLETE_SALE.Id, { kind: "deleted", reason: "Deleted in Salesforce" });
    await run();
    h.sweep = [COMPLETE_SALE];
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    expect(mirror(h.db, COMPLETE_SALE.Id)).toMatchObject({ state: "on_website", withdrawn_at: null });
  });
});

describe("before the draft", () => {
  it("drafts a listing whose area is unmapped, and tells the editor to choose the area", async () => {
    h.sweep = [RENT_UNMAPPED];
    // The only photo is example.com's placeholder, which 404s. Give it a real one.
    h.download = async () => ({ ok: true, bytes: JPEG, sniffed: { mime: "image/jpeg", ext: "jpg" } });
    await run();
    const m = mirror(h.db, RENT_UNMAPPED.Id)!;
    expect(m.state).toBe("on_website");
    expect(m.holds).toEqual([]);
    expect(m.unresolved).toEqual({});
    expect((m.notes as { code: string; message: string }[]).find((n) => n.code === "draft_no_area")?.message).toMatch(
      /^Salesforce gives the area as "Masdar City"/,
    );
    expect(property(h.db, RENT_UNMAPPED.Id)).toMatchObject({ status: "draft", area_id: null, mode: "rent" });

    // A mapping made afterwards is for drafts still to come, not this one.
    h.db.seed("salesforce_mappings", { kind: "location", source_key: "masdar city", target_id: IDS.reem });
    await run({ trigger: "reapply", onlyStored: [RENT_UNMAPPED.Id] });
    expect(property(h.db, RENT_UNMAPPED.Id)?.area_id).toBeNull();
  });

  it("re-applies a row stored before guide v1.3 from today's shape", async () => {
    // A mirror row written by the v2 sync: a community instead of an Area, a
    // Bayut type instead of Property_Type__c.
    h.db.seed("salesforce_listings", {
      sf_listing_id: COMPLETE_SALE.Id,
      org_host: "bazarrealestate.my.salesforce.com",
      sf_listing_name: "LST-00002",
      state: "held",
      snapshot: {
        v: 2,
        listingId: COMPLETE_SALE.Id,
        listingName: "LST-00002",
        title: "4BR Villa on Yas Island",
        offering: "Sale",
        listingPrice: 1_850_000,
        community: "Yas Island",
        bayutType: "Villa",
        amenities: [],
        gallery: [],
      },
      snapshot_hash: "old",
    });
    const s = await run({ trigger: "reapply", onlyStored: [COMPLETE_SALE.Id] });
    expect(s.ok).toBe(true);
    const m = mirror(h.db, COMPLETE_SALE.Id)!;
    expect(m.state).toBe("held");
    expect((m.holds as { code: string }[]).map((x) => x.code)).toEqual(expect.arrayContaining(["no_location", "no_type"]));
    expect((m.snapshot as { v: number; community?: string }).v).toBe(3);
    expect(m.snapshot).not.toHaveProperty("community");
  });

  it("makes no draft of a listing it cannot even name", async () => {
    h.sweep = [SPARSE_PUBLISHED];
    await run();
    expect(h.db.rows("properties")).toHaveLength(0);
    expect(mirror(h.db, SPARSE_PUBLISHED.Id)?.state).toBe("held");
  });

  it("drafts a listing none of whose photos can be copied, says so, and does not retry them every run", async () => {
    const download = vi.fn(async () => ({ ok: false, permanent: true, reason: "HTTP 404" }));
    h.download = download;
    await run();
    const m = mirror(h.db, COMPLETE_SALE.Id)!;
    expect(m.state).toBe("on_website");
    expect((m.notes as { code: string }[]).map((x) => x.code)).toContain("photos_failed");
    expect(Object.keys(m.image_failures as object)).toHaveLength(4);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("draft");

    download.mockClear();
    await run();
    expect(download).not.toHaveBeenCalled();
  });

  it("waits for the whole gallery before making the draft", async () => {
    let calls = 0;
    h.download = async () =>
      ++calls === 2
        ? { ok: false, permanent: false, reason: "timeout" }
        : { ok: true, bytes: JPEG, sniffed: { mime: "image/jpeg", ext: "jpg" } };
    await run();
    expect((mirror(h.db, COMPLETE_SALE.Id)?.holds as { code: string }[]).map((x) => x.code)).toEqual(["photos_pending"]);
    expect(h.db.rows("properties")).toHaveLength(0);
    await run();
    const p = property(h.db, COMPLETE_SALE.Id)!;
    expect(p.status).toBe("draft");
    expect(h.db.rows("property_media").filter((l) => l.property_id === p.id)).toHaveLength(4);
  });
});

describe("writeBackFor — what the CRM team sees", () => {
  const url = "https://www.bazarrealestate.ae/p/villa-baz-ad-01234";
  const theirs = { code: "no_permit_expiry" as const, fix: "salesforce" as const, message: "Permit_Expiry_Date_c__c on the Property is blank." };
  const ours = { code: "photos_pending" as const, fix: "wait" as const, message: "1 of 4 photos copied so far." };

  it("publishes with the URL once an editor has published the draft", () => {
    expect(writeBackFor("on_website", [], url)).toEqual({ Website_Status__c: "Published", Website_Listing_URL__c: url, Website_Error__c: null });
  });

  it("says a draft is a draft, without deactivating it", () => {
    const draft = writeBackFor("on_website", [], null)!;
    expect(draft).not.toHaveProperty("Website_Status__c");
    expect(draft.Website_Error__c).toMatch(/^A draft on the website/);
  });

  it("deactivates only for what the CRM team can fix", () => {
    expect(writeBackFor("held", [theirs, ours], null)).toEqual({
      Website_Status__c: "Deactivated",
      Website_Listing_URL__c: null,
      Website_Error__c: theirs.message,
    });
    const waiting = writeBackFor("held", [ours], null)!;
    expect(waiting).not.toHaveProperty("Website_Status__c");
    expect(waiting.Website_Error__c).toBe(`In progress: ${ours.message}`);
  });

  it("says nothing for a sandbox or a listing the CRM already withdrew", () => {
    expect(writeBackFor("mirror_only", [theirs], null)).toBeNull();
    expect(writeBackFor("withdrawn", [], null)).toBeNull();
  });

  it("sends only what would change, and leaves Republished alone", () => {
    const want = writeBackFor("on_website", [], url)!;
    expect(writeBackDelta(want, { websiteStatus: "Republished", websiteUrl: url, websiteError: null })).toEqual({});
    expect(writeBackDelta(want, { websiteStatus: "Published", websiteUrl: null, websiteError: "old" })).toEqual({
      Website_Listing_URL__c: url,
      Website_Error__c: null,
    });
  });
});

describe("write-back in a run", () => {
  function setWriteBack(on: boolean) {
    h.db.rows("salesforce_listing_sync")[0].write_back = on;
  }

  it("writes nothing until an admin turns it on", async () => {
    await run();
    property(h.db, COMPLETE_SALE.Id)!.status = "published";
    await run();
    expect(h.patches).toEqual([]);
  });

  it("tells Salesforce where a published listing is, and then stops repeating itself", async () => {
    setWriteBack(true);
    await run();
    h.patches = [];
    property(h.db, COMPLETE_SALE.Id)!.status = "published";
    const s = await run();
    expect(s.writtenBack).toBe(1);
    const p = property(h.db, COMPLETE_SALE.Id)!;
    expect(h.patches).toEqual([
      {
        path: `sobjects/Property_Listing__c/${COMPLETE_SALE.Id}`,
        // Already Published in Salesforce, and no error to clear: only the
        // URL is news.
        body: {
          Website_Listing_URL__c: expect.stringMatching(new RegExp(`/p/4br-villa-on-yas-island-${String(p.reference).toLowerCase()}$`)),
        },
      },
    ]);
    // Next sweep reads our values back; nothing to send.
    h.sweep = [{ ...COMPLETE_SALE, Website_Listing_URL__c: h.patches[0].body.Website_Listing_URL__c as string, Website_Error__c: null }];
    h.patches = [];
    await run();
    expect(h.patches).toEqual([]);
  });

  it("deactivates a listing too incomplete to draft, with the reason", async () => {
    setWriteBack(true);
    h.sweep = [SPARSE_PUBLISHED];
    await run();
    expect(h.patches[0].body).toMatchObject({ Website_Status__c: "Deactivated" });
    expect(String(h.patches[0].body.Website_Error__c)).toContain("Title__c on the Property is blank.");
  });

  it("never writes to a sandbox", async () => {
    h.org = "bazarrealestate--sand.sandbox.my.salesforce.com";
    setWriteBack(true);
    await run();
    expect(h.patches).toEqual([]);
  });

  it("keeps the reasons when a listing it deactivated leaves the published set", async () => {
    setWriteBack(true);
    h.sweep = [SPARSE_PUBLISHED];
    await run();
    h.sweep = [];
    h.absences.set(SPARSE_PUBLISHED.Id, { kind: "unpublished", reason: 'Website_Status__c is "Deactivated" in Salesforce', status: "Deactivated" });
    await run();
    const m = mirror(h.db, SPARSE_PUBLISHED.Id)!;
    expect(m.state).toBe("withdrawn");
    expect((m.holds as { code: string }[]).map((x) => x.code)).toContain("no_title");
  });

  it("records a refused write-back on the listing and carries on", async () => {
    setWriteBack(true);
    h.patchFails = true;
    await run();
    property(h.db, COMPLETE_SALE.Id)!.status = "published";
    const s = await run();
    expect(s.ok).toBe(false);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    expect(String(mirror(h.db, COMPLETE_SALE.Id)?.last_error)).toContain("INSUFFICIENT_ACCESS_OR_READONLY");
  });
});
