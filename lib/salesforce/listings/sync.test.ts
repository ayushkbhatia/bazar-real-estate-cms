import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./fake-supabase";
import {
  COMPLETE_SALE,
  IDS,
  RENT_UNMAPPED,
  SPARSE_PUBLISHED,
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
const revalidated: { propertyUrls: string[]; lists: boolean }[] = [];
const run = (extra: Partial<Parameters<typeof runListingSync>[0]> = {}) =>
  runListingSync({ trigger: "cron", revalidate: (p) => revalidated.push(p), ...extra });

function seedLookups(db: FakeDb) {
  db.seed(
    "areas",
    { id: IDS.abuDhabi, name: "Abu Dhabi", slug: "abu-dhabi", kind: "emirate", parent_id: null },
    { id: IDS.yas, name: "Yas Island", slug: "yas-island", kind: "area", parent_id: IDS.abuDhabi },
    { id: IDS.reem, name: "Al Reem Island", slug: "al-reem-island", kind: "area", parent_id: IDS.abuDhabi },
  );
  db.seed("developers", { id: IDS.aldar, name: "ALDAR Properties" }, { id: IDS.sobha, name: "Sobha Realty" });
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
function setAutoPublish(db: FakeDb, on: boolean) {
  db.rows("salesforce_listing_sync")[0].auto_publish = on;
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
  revalidated.length = 0;
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
    setAutoPublish(h.db, true);

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
  it("creates the listing as a draft with its photos, and waits for approval", async () => {
    const s = await run();
    expect(s.created).toBe(1);
    const p = property(h.db, COMPLETE_SALE.Id)!;
    expect(p).toMatchObject({ status: "draft", title: "4BR Villa on Yas Island", price_aed: 1_850_000, area_id: IDS.yas });
    expect(p.reference).toMatch(/^BAZ-AD-0\d{4}$/);
    expect(p.slug).toBe("4br-villa-on-yas-island");
    expect(mirror(h.db, COMPLETE_SALE.Id)?.state).toBe("awaiting_approval");

    // Cover (a File), one more File, one web photo, and the floor plan.
    expect(h.db.objects.size).toBe(4);
    const links = h.db.rows("property_media").filter((l) => l.property_id === p.id);
    expect(links.map((l) => l.role).sort()).toEqual(["floor_plan", "gallery", "gallery", "hero"]);
    expect(revalidated).toHaveLength(0);
  });

  it("goes live under auto-publish, dated when Salesforce published it, and counts that as approval", async () => {
    setAutoPublish(h.db, true);
    const s = await run();
    expect(s.published).toBe(1);
    const p = property(h.db, COMPLETE_SALE.Id)!;
    expect(p.status).toBe("published");
    expect(p.published_at).toBe("2026-09-17T00:00:00.000Z");
    expect(mirror(h.db, COMPLETE_SALE.Id)?.approved_at).toBeTruthy();
    expect(revalidated.at(-1)?.propertyUrls[0]).toMatch(/^\/p\/4br-villa-on-yas-island-baz-ad-0\d{4}$/);

    // Turning auto-publish off afterwards does not take it down.
    setAutoPublish(h.db, false);
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
  });

  it("writes nothing on a run where nothing changed", async () => {
    setAutoPublish(h.db, true);
    await run();
    const download = vi.fn(h.download);
    h.download = download;
    const s = await run();
    expect(s).toMatchObject({ created: 0, updated: 0, published: 0, unpublished: 0, imagesCopied: 0 });
    expect(download).not.toHaveBeenCalled();
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

  it("puts back a Salesforce-owned field an editor changed in the CMS", async () => {
    setAutoPublish(h.db, true);
    await run();
    property(h.db, COMPLETE_SALE.Id)!.price_aed = 999;
    const s = await run();
    expect(s.updated).toBe(1);
    expect(property(h.db, COMPLETE_SALE.Id)?.price_aed).toBe(1_850_000);
  });

  it("leaves the website's own fields alone", async () => {
    await run();
    const p = property(h.db, COMPLETE_SALE.Id)!;
    p.slug = "an-editors-slug";
    p.short_description = "Written by an editor.";
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)).toMatchObject({ slug: "an-editors-slug", short_description: "Written by an editor." });
  });

  it("takes a live listing down when an editor hides it, and keeps it down", async () => {
    setAutoPublish(h.db, true);
    await run();
    mirror(h.db, COMPLETE_SALE.Id)!.hidden_at = new Date().toISOString();
    const s = await run();
    expect(s.unpublished).toBe(1);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("off_market");
    expect(mirror(h.db, COMPLETE_SALE.Id)?.state).toBe("hidden");
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("off_market");
  });
});

describe("withdrawals", () => {
  async function live() {
    setAutoPublish(h.db, true);
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    h.sweep = [];
  }

  it("takes down a listing Salesforce says is unpublished", async () => {
    await live();
    h.absences.set(COMPLETE_SALE.Id, { kind: "unpublished", reason: "Website_Status__c is blank in Salesforce" });
    const s = await run();
    expect(s.withdrawn).toBe(1);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("off_market");
    expect(mirror(h.db, COMPLETE_SALE.Id)).toMatchObject({ state: "withdrawn", withdrawn_reason: "Website_Status__c is blank in Salesforce" });
  });

  it("leaves a listing up when Salesforce will not say anything about it", async () => {
    // A sharing rule changed, a permission set was edited: the record is
    // invisible, not unpublished. This is the case that must never empty the
    // website.
    await live();
    const s = await run();
    expect(s.invisible).toBe(1);
    expect(s.withdrawn).toBe(0);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    expect(h.issues).toContain("Salesforce listings no longer visible to the integration user");
  });

  it("brings a withdrawn listing back when Salesforce republishes it", async () => {
    await live();
    h.absences.set(COMPLETE_SALE.Id, { kind: "deleted", reason: "Deleted in Salesforce" });
    await run();
    h.sweep = [COMPLETE_SALE];
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    expect(mirror(h.db, COMPLETE_SALE.Id)).toMatchObject({ state: "live", withdrawn_at: null });
  });
});

describe("held listings", () => {
  it("holds a listing whose location is unmapped, then releases it once mapped", async () => {
    setAutoPublish(h.db, true);
    h.sweep = [RENT_UNMAPPED];
    // The only photo is example.com's placeholder, which 404s. Give it a real one.
    h.download = async () => ({ ok: true, bytes: JPEG, sniffed: { mime: "image/jpeg", ext: "jpg" } });
    await run();
    expect(mirror(h.db, RENT_UNMAPPED.Id)?.state).toBe("held");
    expect(property(h.db, RENT_UNMAPPED.Id)?.status).toBe("draft");

    h.db.seed("salesforce_mappings", { kind: "location", source_key: "sobha city abu dhabi", target_id: IDS.reem });
    await run({ trigger: "reapply", onlyStored: [RENT_UNMAPPED.Id] });
    expect(mirror(h.db, RENT_UNMAPPED.Id)?.state).toBe("live");
    expect(property(h.db, RENT_UNMAPPED.Id)).toMatchObject({ status: "published", area_id: IDS.reem, mode: "rent", property_form: null });
  });

  it("keeps a listing it cannot even name off the website entirely", async () => {
    h.sweep = [SPARSE_PUBLISHED];
    await run();
    expect(h.db.rows("properties")).toHaveLength(0);
    expect(mirror(h.db, SPARSE_PUBLISHED.Id)?.state).toBe("held");
  });

  it("holds a listing none of whose photos can be copied, and does not retry them every run", async () => {
    setAutoPublish(h.db, true);
    const download = vi.fn(async () => ({ ok: false, permanent: true, reason: "HTTP 404" }));
    h.download = download;
    await run();
    const m = mirror(h.db, COMPLETE_SALE.Id)!;
    expect(m.state).toBe("held");
    expect((m.holds as { code: string }[]).map((x) => x.code)).toContain("photos_unavailable");
    expect(Object.keys(m.image_failures as object)).toHaveLength(4);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("draft");

    download.mockClear();
    await run();
    expect(download).not.toHaveBeenCalled();
  });

  it("waits for the whole gallery before a first appearance", async () => {
    setAutoPublish(h.db, true);
    let calls = 0;
    h.download = async () =>
      ++calls === 2
        ? { ok: false, permanent: false, reason: "timeout" }
        : { ok: true, bytes: JPEG, sniffed: { mime: "image/jpeg", ext: "jpg" } };
    await run();
    expect((mirror(h.db, COMPLETE_SALE.Id)?.holds as { code: string }[]).map((x) => x.code)).toEqual(["photos_pending"]);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("draft");
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
  });
});

describe("writeBackFor — what the CRM team sees", () => {
  const url = "https://www.bazarrealestate.ae/p/villa-baz-ad-01234";
  const theirs = { code: "no_permit_expiry" as const, fix: "salesforce" as const, message: "Permit_Expiry_Date_c__c on the Property is blank." };
  const ours = { code: "unmapped_location" as const, fix: "website" as const, message: '"Sobha City" does not match an area.' };

  it("publishes with the URL and clears the error on success", () => {
    expect(writeBackFor("live", [], url)).toEqual({ Website_Status__c: "Published", Website_URL__c: url, Website_Error__c: null });
  });

  it("deactivates only for what the CRM team can fix", () => {
    expect(writeBackFor("held", [theirs, ours], null)).toEqual({
      Website_Status__c: "Deactivated",
      Website_URL__c: null,
      Website_Error__c: theirs.message,
    });
    // Waiting on us: stays in the published set, says why, goes live when done.
    const waiting = writeBackFor("held", [ours], null)!;
    expect(waiting).not.toHaveProperty("Website_Status__c");
    expect(waiting.Website_Error__c).toBe(`Waiting on the Bazar website team: ${ours.message}`);
    expect(writeBackFor("awaiting_approval", [], null)).not.toHaveProperty("Website_Status__c");
  });

  it("says nothing for a sandbox or a listing the CRM already withdrew", () => {
    expect(writeBackFor("mirror_only", [theirs], null)).toBeNull();
    expect(writeBackFor("withdrawn", [], null)).toBeNull();
  });

  it("sends only what would change, and leaves Republished alone", () => {
    const want = writeBackFor("live", [], url)!;
    expect(writeBackDelta(want, { websiteStatus: "Republished", websiteUrl: url, websiteError: null })).toEqual({});
    expect(writeBackDelta(want, { websiteStatus: "Published", websiteUrl: null, websiteError: "old" })).toEqual({
      Website_URL__c: url,
      Website_Error__c: null,
    });
  });
});

describe("write-back in a run", () => {
  function setWriteBack(on: boolean) {
    h.db.rows("salesforce_listing_sync")[0].write_back = on;
  }

  it("writes nothing until an admin turns it on", async () => {
    setAutoPublish(h.db, true);
    await run();
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    expect(h.patches).toEqual([]);
  });

  it("tells Salesforce a live listing is published, where, and then stops repeating itself", async () => {
    setAutoPublish(h.db, true);
    setWriteBack(true);
    const s = await run();
    expect(s.writtenBack).toBe(1);
    const p = property(h.db, COMPLETE_SALE.Id)!;
    expect(h.patches).toEqual([
      {
        path: `sobjects/Property_Listing__c/${COMPLETE_SALE.Id}`,
        // Already Published in Salesforce, and no error to clear: only the
        // URL is news.
        body: {
          Website_URL__c: expect.stringMatching(new RegExp(`/p/4br-villa-on-yas-island-${String(p.reference).toLowerCase()}$`)),
        },
      },
    ]);
    // Next sweep reads our values back; nothing to send.
    h.sweep = [{ ...COMPLETE_SALE, Website_URL__c: h.patches[0].body.Website_URL__c as string, Website_Error__c: null }];
    h.patches = [];
    await run();
    expect(h.patches).toEqual([]);
  });

  it("deactivates a listing only the CRM team can fix, with the reason", async () => {
    setWriteBack(true);
    h.sweep = [{ ...COMPLETE_SALE, Property__r: { ...COMPLETE_SALE.Property__r, Permit_Expiry_Date_c__c: null } }];
    await run();
    // No Website_URL__c: it was never live, so there is none to clear.
    expect(h.patches[0].body).toEqual({
      Website_Status__c: "Deactivated",
      Website_Error__c: "Permit_Expiry_Date_c__c on the Property is blank.",
    });
  });

  it("keeps a listing waiting on the website in the published set", async () => {
    setWriteBack(true);
    setAutoPublish(h.db, true);
    h.sweep = [RENT_UNMAPPED];
    await run();
    expect(h.patches).toHaveLength(1);
    expect(h.patches[0].body).not.toHaveProperty("Website_Status__c");
    expect(String(h.patches[0].body.Website_Error__c)).toMatch(/^Waiting on the Bazar website team: "Sobha City, Abu Dhabi"/);
  });

  it("never writes to a sandbox", async () => {
    h.org = "bazarrealestate--sand.sandbox.my.salesforce.com";
    setWriteBack(true);
    await run();
    expect(h.patches).toEqual([]);
  });

  it("keeps the reasons when a listing it deactivated leaves the published set", async () => {
    setWriteBack(true);
    h.sweep = [{ ...COMPLETE_SALE, Property__r: { ...COMPLETE_SALE.Property__r, Permit_Expiry_Date_c__c: null } }];
    await run();
    h.sweep = [];
    h.absences.set(COMPLETE_SALE.Id, { kind: "unpublished", reason: 'Website_Status__c is "Deactivated" in Salesforce', status: "Deactivated" });
    await run();
    const m = mirror(h.db, COMPLETE_SALE.Id)!;
    expect(m.state).toBe("withdrawn");
    expect((m.holds as { code: string }[]).map((x) => x.code)).toEqual(["no_permit_expiry"]);
  });

  it("records a refused write-back on the listing and carries on", async () => {
    setWriteBack(true);
    setAutoPublish(h.db, true);
    h.patchFails = true;
    const s = await run();
    expect(s.ok).toBe(false);
    expect(property(h.db, COMPLETE_SALE.Id)?.status).toBe("published");
    expect(String(mirror(h.db, COMPLETE_SALE.Id)?.last_error)).toContain("INSUFFICIENT_ACCESS_OR_READONLY");
  });
});
