import { describe, it, expect } from "vitest";
import {
  DEAL_STAGES,
  canViewDocument,
  composeDocumentStorageKey,
  evaluateStageAdvance,
  isKycKind,
  nextStage,
  previousStage,
  requiredBuyerDocs,
  sanitiseFilename,
  type DealDocsContext,
  type DealStage,
} from "./deals";

const NOW = new Date("2026-05-21T00:00:00Z");

function emptyDocs(): DealDocsContext {
  return { buyerDocs: [], dealDocs: [] };
}

describe("stage machine", () => {
  it("orders stages mou → transferred", () => {
    expect(DEAL_STAGES).toEqual([
      "mou",
      "deposit",
      "noc_pending",
      "dld_pending",
      "transferred",
    ]);
  });

  it("nextStage advances by one", () => {
    expect(nextStage("mou")).toBe("deposit");
    expect(nextStage("deposit")).toBe("noc_pending");
    expect(nextStage("noc_pending")).toBe("dld_pending");
    expect(nextStage("dld_pending")).toBe("transferred");
  });

  it("nextStage returns null at terminal stage", () => {
    expect(nextStage("transferred")).toBeNull();
  });

  it("previousStage reverses the chain", () => {
    expect(previousStage("deposit")).toBe("mou");
    expect(previousStage("transferred")).toBe("dld_pending");
    expect(previousStage("mou")).toBeNull();
  });
});

describe("evaluateStageAdvance", () => {
  it("allows mou → deposit unconditionally", () => {
    const res = evaluateStageAdvance({
      from: "mou",
      to: "deposit",
      docs: emptyDocs(),
      now: NOW,
    });
    expect(res.ok).toBe(true);
    expect(res.blockers).toEqual([]);
  });

  it("rejects skipping a stage", () => {
    const res = evaluateStageAdvance({
      from: "mou",
      to: "noc_pending",
      docs: emptyDocs(),
      now: NOW,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/jump/i);
  });

  it("rejects going backwards", () => {
    const res = evaluateStageAdvance({
      from: "deposit",
      to: "mou",
      docs: emptyDocs(),
      now: NOW,
    });
    expect(res.ok).toBe(false);
  });

  it("blocks deposit → noc_pending until KYC verified", () => {
    const res = evaluateStageAdvance({
      from: "deposit",
      to: "noc_pending",
      docs: emptyDocs(),
      now: NOW,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/KYC/);
  });

  it("unblocks deposit → noc_pending once passport is verified", () => {
    const res = evaluateStageAdvance({
      from: "deposit",
      to: "noc_pending",
      docs: {
        buyerDocs: [
          { kind: "passport", status: "verified", expires_at: null },
        ],
        dealDocs: [],
      },
      now: NOW,
    });
    expect(res.ok).toBe(true);
  });

  it("unblocks deposit → noc_pending once emirates_id is verified", () => {
    const res = evaluateStageAdvance({
      from: "deposit",
      to: "noc_pending",
      docs: {
        buyerDocs: [
          { kind: "emirates_id", status: "verified", expires_at: null },
        ],
        dealDocs: [],
      },
      now: NOW,
    });
    expect(res.ok).toBe(true);
  });

  it("still blocks if the only KYC doc is expired", () => {
    const res = evaluateStageAdvance({
      from: "deposit",
      to: "noc_pending",
      docs: {
        buyerDocs: [
          {
            kind: "passport",
            status: "verified",
            expires_at: "2020-01-01",
          },
        ],
        dealDocs: [],
      },
      now: NOW,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/KYC/);
  });

  it("still blocks if KYC doc is only `uploaded` (not yet verified)", () => {
    const res = evaluateStageAdvance({
      from: "deposit",
      to: "noc_pending",
      docs: {
        buyerDocs: [
          { kind: "passport", status: "uploaded", expires_at: null },
        ],
        dealDocs: [],
      },
      now: NOW,
    });
    expect(res.ok).toBe(false);
  });

  it("blocks noc_pending → dld_pending without a verified NOC", () => {
    const res = evaluateStageAdvance({
      from: "noc_pending",
      to: "dld_pending",
      docs: {
        buyerDocs: [
          { kind: "passport", status: "verified", expires_at: null },
        ],
        dealDocs: [],
      },
      now: NOW,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/NOC/);
  });

  it("allows noc_pending → dld_pending once NOC verified", () => {
    const res = evaluateStageAdvance({
      from: "noc_pending",
      to: "dld_pending",
      docs: {
        buyerDocs: [],
        dealDocs: [
          { kind: "noc", status: "verified", expires_at: null },
        ],
      },
      now: NOW,
    });
    expect(res.ok).toBe(true);
  });

  it("allows dld_pending → transferred unconditionally", () => {
    const res = evaluateStageAdvance({
      from: "dld_pending",
      to: "transferred",
      docs: emptyDocs(),
      now: NOW,
    });
    expect(res.ok).toBe(true);
  });

  it("rejects advancing past transferred", () => {
    const res = evaluateStageAdvance({
      from: "transferred",
      to: "transferred" as DealStage,
      docs: emptyDocs(),
      now: NOW,
    });
    expect(res.ok).toBe(false);
  });
});

describe("canViewDocument", () => {
  it("anon never sees anything", () => {
    expect(
      canViewDocument({
        ownerKind: "account",
        ownerId: "u-1",
        viewer: { kind: "anon" },
      }),
    ).toBe(false);
  });

  it("staff sees everything", () => {
    expect(
      canViewDocument({
        ownerKind: "deal",
        ownerId: "d-1",
        viewer: { kind: "staff", userId: "s-1" },
      }),
    ).toBe(true);
    expect(
      canViewDocument({
        ownerKind: "property",
        ownerId: "p-1",
        viewer: { kind: "staff", userId: "s-1" },
      }),
    ).toBe(true);
  });

  it("account sees own account-scoped docs", () => {
    expect(
      canViewDocument({
        ownerKind: "account",
        ownerId: "u-1",
        viewer: { kind: "account", userId: "u-1" },
      }),
    ).toBe(true);
  });

  it("account cannot see another account's docs", () => {
    expect(
      canViewDocument({
        ownerKind: "account",
        ownerId: "u-2",
        viewer: { kind: "account", userId: "u-1" },
      }),
    ).toBe(false);
  });

  it("account cannot see deal docs without being the buyer", () => {
    expect(
      canViewDocument({
        ownerKind: "deal",
        ownerId: "d-1",
        viewer: { kind: "account", userId: "u-1" },
      }),
    ).toBe(false);
  });

  it("buyer-of-deal sees the matching deal's docs", () => {
    expect(
      canViewDocument({
        ownerKind: "deal",
        ownerId: "d-1",
        viewer: { kind: "buyer-of-deal", userId: "u-1", dealId: "d-1" },
      }),
    ).toBe(true);
  });

  it("buyer-of-deal does NOT see another deal's docs", () => {
    expect(
      canViewDocument({
        ownerKind: "deal",
        ownerId: "d-2",
        viewer: { kind: "buyer-of-deal", userId: "u-1", dealId: "d-1" },
      }),
    ).toBe(false);
  });

  it("buyer-of-deal can't access property-scoped docs", () => {
    expect(
      canViewDocument({
        ownerKind: "property",
        ownerId: "p-1",
        viewer: { kind: "buyer-of-deal", userId: "u-1", dealId: "d-1" },
      }),
    ).toBe(false);
  });
});

describe("composeDocumentStorageKey", () => {
  it("composes the accounts/<id>/<doc>-<filename> shape", () => {
    const key = composeDocumentStorageKey({
      ownerKind: "account",
      ownerId: "user-abc",
      documentId: "doc-1",
      filename: "Passport.pdf",
    });
    expect(key).toBe("accounts/user-abc/doc-1-Passport.pdf");
  });

  it("composes the deals/<id>/<doc>-<filename> shape", () => {
    const key = composeDocumentStorageKey({
      ownerKind: "deal",
      ownerId: "deal-xyz",
      documentId: "doc-2",
      filename: "NOC signed.pdf",
    });
    expect(key).toBe("deals/deal-xyz/doc-2-NOC-signed.pdf");
  });

  it("sanitises path separators in the filename", () => {
    const key = composeDocumentStorageKey({
      ownerKind: "account",
      ownerId: "u",
      documentId: "d",
      filename: "../../etc/passwd",
    });
    expect(key.split("/")).toHaveLength(3);
    expect(key).not.toContain("..");
  });

  it("starts with accounts/ for account-scoped uploads", () => {
    const key = composeDocumentStorageKey({
      ownerKind: "account",
      ownerId: "u",
      documentId: "d",
      filename: "a.pdf",
    });
    expect(key.startsWith("accounts/")).toBe(true);
  });

  it("starts with deals/ for deal-scoped uploads", () => {
    const key = composeDocumentStorageKey({
      ownerKind: "deal",
      ownerId: "u",
      documentId: "d",
      filename: "a.pdf",
    });
    expect(key.startsWith("deals/")).toBe(true);
  });

  it("handles property/development/enquiry owners with their plural prefix", () => {
    const k = composeDocumentStorageKey({
      ownerKind: "property",
      ownerId: "p",
      documentId: "d",
      filename: "x.pdf",
    });
    expect(k.startsWith("propertys/")).toBe(true);
  });
});

describe("sanitiseFilename", () => {
  it("preserves ASCII identifiers", () => {
    expect(sanitiseFilename("title_deed.pdf")).toBe("title_deed.pdf");
  });

  it("strips path traversal attempts", () => {
    expect(sanitiseFilename("../../etc/passwd")).toBe("etc-passwd");
  });

  it("falls back to 'file' when nothing prints", () => {
    expect(sanitiseFilename("///")).toBe("file");
  });

  it("limits filename length", () => {
    const long = "a".repeat(200) + ".pdf";
    expect(sanitiseFilename(long).length).toBeLessThanOrEqual(96);
  });

  it("collapses runs of unsafe characters", () => {
    expect(sanitiseFilename("foo   bar   baz.pdf")).toBe("foo-bar-baz.pdf");
  });
});

describe("isKycKind / requiredBuyerDocs", () => {
  it("passport + emirates_id are KYC", () => {
    expect(isKycKind("passport")).toBe(true);
    expect(isKycKind("emirates_id")).toBe(true);
    expect(isKycKind("noc")).toBe(false);
    expect(isKycKind("mou")).toBe(false);
  });

  it("requires KYC in early stages", () => {
    expect(requiredBuyerDocs("mou")).toEqual(["passport", "emirates_id"]);
    expect(requiredBuyerDocs("deposit")).toEqual(["passport", "emirates_id"]);
  });

  it("does not re-request KYC after noc_pending", () => {
    expect(requiredBuyerDocs("noc_pending")).toEqual([]);
    expect(requiredBuyerDocs("dld_pending")).toEqual([]);
    expect(requiredBuyerDocs("transferred")).toEqual([]);
  });
});
