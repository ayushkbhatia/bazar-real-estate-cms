import { beforeEach, describe, expect, it, vi } from "vitest";

const salesforceRequest = vi.fn();

vi.mock("@/lib/salesforce/client", async () => {
  class SalesforceError extends Error {
    status: number;
    errorCode: string | null;
    retryable: boolean;
    constructor(message: string, o: { status: number; errorCode?: string | null; retryable: boolean }) {
      super(message);
      this.status = o.status;
      this.errorCode = o.errorCode ?? null;
      this.retryable = o.retryable;
    }
  }
  return { SalesforceError, salesforceRequest: (...a: unknown[]) => salesforceRequest(...a) };
});

const { explainAbsences, fetchPublishedListings, nextPagePath } = await import("./fetch");
const { SalesforceError } = await import("@/lib/salesforce/client");

const page = (records: unknown[], next?: string) => ({
  totalSize: records.length,
  done: !next,
  nextRecordsUrl: next,
  records,
});

// Braces matter: `mockReset()` returns the mock, and a function returned from
// `beforeEach` is run by vitest as that test's teardown.
beforeEach(() => {
  salesforceRequest.mockReset();
});

describe("nextPagePath", () => {
  it("follows Salesforce's own continuation URL and nothing else", () => {
    expect(nextPagePath("/services/data/v67.0/query/01gRO0000016PIAYA2-2000")).toBe(
      "query/01gRO0000016PIAYA2-2000",
    );
    expect(nextPagePath("https://evil.test/services/data/v67.0/query/x")).toBeNull();
    expect(nextPagePath("/services/data/v67.0/sobjects/User")).toBeNull();
  });
});

describe("fetchPublishedListings", () => {
  it("reads every page", async () => {
    salesforceRequest
      .mockResolvedValueOnce(page([{ Id: "a" }], "/services/data/v67.0/query/01g-2000"))
      .mockResolvedValueOnce(page([{ Id: "b" }]));
    const sweep = await fetchPublishedListings();
    expect(sweep.records.map((r) => r.Id)).toEqual(["a", "b"]);
    expect(salesforceRequest.mock.calls[1][0]).toBe("query/01g-2000");
  });

  it("keeps syncing when the org hides one field, and says which", async () => {
    salesforceRequest
      .mockRejectedValueOnce(
        new SalesforceError("No such column 'Title_Arabic__c'", { status: 400, errorCode: "INVALID_FIELD", retryable: false }),
      )
      .mockResolvedValueOnce({ fields: ["Id", "Name", "Website_Status__c", "Property__c"].map((name) => ({ name })) })
      .mockResolvedValueOnce({ fields: ["Id", "Title__c"].map((name) => ({ name })) })
      .mockResolvedValueOnce(page([{ Id: "a" }]));
    const sweep = await fetchPublishedListings();
    expect(sweep.records).toHaveLength(1);
    expect(sweep.hiddenFields).toContain("Listing__c.Title_Arabic__c");
    const retried = decodeURIComponent(salesforceRequest.mock.calls[3][0] as string);
    expect(retried).toContain("Property__r.Title__c");
    expect(retried).not.toContain("Title_Arabic__c");
  });

  it("stops when a field the sweep cannot do without is hidden", async () => {
    salesforceRequest
      .mockRejectedValueOnce(new SalesforceError("x", { status: 400, errorCode: "INVALID_FIELD", retryable: false }))
      .mockResolvedValueOnce({ fields: [{ name: "Id" }, { name: "Name" }] })
      .mockResolvedValueOnce({ fields: [{ name: "Id" }] });
    await expect(fetchPublishedListings()).rejects.toThrow(/Website_Status__c/);
  });
});

describe("explainAbsences — the evidence a withdrawal needs", () => {
  it("tells unpublished, deleted, raced and invisible apart", async () => {
    const ids = ["a03iy000000000001A", "a03iy000000000002A", "a03iy000000000003A", "a03iy000000000004A"];
    salesforceRequest.mockImplementation(async (path: string) => {
      const q = decodeURIComponent(path);
      if (q.startsWith("query?")) {
        return page([
          { Id: ids[0], Website_Status__c: null },
          { Id: ids[2], Website_Status__c: "Republished" },
        ]);
      }
      if (q.startsWith("queryAll?")) {
        expect(q).toContain("IsDeleted = true");
        return page([{ Id: ids[1] }]);
      }
      throw new Error(`unexpected ${q}`);
    });

    const why = await explainAbsences(ids);
    expect(why.get(ids[0])).toEqual({ kind: "unpublished", reason: "Website_Status__c is blank in Salesforce", status: null });
    expect(why.get(ids[1])).toEqual({ kind: "deleted", reason: "Deleted in Salesforce" });
    expect(why.get(ids[2])).toEqual({ kind: "still_published" });
    // Salesforce says nothing about the fourth. That is a permissions change
    // until proven otherwise, never a reason to take a listing down.
    expect(why.get(ids[3])).toEqual({ kind: "invisible" });
  });
});
