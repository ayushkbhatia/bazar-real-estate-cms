import { describe, it, expect } from "vitest";
import {
  ALLOWED_DOCUMENT_MIME,
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  SIGNED_URL_TTL_SECONDS,
  canSignDownload,
} from "./documents-storage";

describe("canSignDownload", () => {
  it("staff: always allowed", () => {
    expect(
      canSignDownload({
        ownerKind: "deal",
        ownerId: "d-1",
        viewerUserId: "s-1",
        viewerIsStaff: true,
        viewerBuyerOfDealId: null,
      }),
    ).toBe(true);
    expect(
      canSignDownload({
        ownerKind: "property",
        ownerId: "p-1",
        viewerUserId: "s-1",
        viewerIsStaff: true,
        viewerBuyerOfDealId: null,
      }),
    ).toBe(true);
  });

  it("unauthenticated: never allowed", () => {
    expect(
      canSignDownload({
        ownerKind: "account",
        ownerId: "u-1",
        viewerUserId: null,
        viewerIsStaff: false,
        viewerBuyerOfDealId: null,
      }),
    ).toBe(false);
  });

  it("account owner: only their own row", () => {
    expect(
      canSignDownload({
        ownerKind: "account",
        ownerId: "u-1",
        viewerUserId: "u-1",
        viewerIsStaff: false,
        viewerBuyerOfDealId: null,
      }),
    ).toBe(true);
    expect(
      canSignDownload({
        ownerKind: "account",
        ownerId: "u-2",
        viewerUserId: "u-1",
        viewerIsStaff: false,
        viewerBuyerOfDealId: null,
      }),
    ).toBe(false);
  });

  it("deal buyer: matching deal only", () => {
    expect(
      canSignDownload({
        ownerKind: "deal",
        ownerId: "d-1",
        viewerUserId: "u-1",
        viewerIsStaff: false,
        viewerBuyerOfDealId: "d-1",
      }),
    ).toBe(true);
    expect(
      canSignDownload({
        ownerKind: "deal",
        ownerId: "d-2",
        viewerUserId: "u-1",
        viewerIsStaff: false,
        viewerBuyerOfDealId: "d-1",
      }),
    ).toBe(false);
  });

  it("non-staff account: no access to property / development docs", () => {
    expect(
      canSignDownload({
        ownerKind: "property",
        ownerId: "p-1",
        viewerUserId: "u-1",
        viewerIsStaff: false,
        viewerBuyerOfDealId: null,
      }),
    ).toBe(false);
    expect(
      canSignDownload({
        ownerKind: "development",
        ownerId: "dev-1",
        viewerUserId: "u-1",
        viewerIsStaff: false,
        viewerBuyerOfDealId: null,
      }),
    ).toBe(false);
  });
});

describe("storage constants", () => {
  it("uses the documents bucket name", () => {
    expect(DOCUMENTS_BUCKET).toBe("documents");
  });

  it("signed URL TTL stays at 15 minutes", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBe(15 * 60);
  });

  it("max upload size is 20 MB", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(20 * 1024 * 1024);
  });

  it("allows the expected upload mime types", () => {
    expect(ALLOWED_DOCUMENT_MIME.has("application/pdf")).toBe(true);
    expect(ALLOWED_DOCUMENT_MIME.has("image/jpeg")).toBe(true);
    expect(ALLOWED_DOCUMENT_MIME.has("image/png")).toBe(true);
    expect(ALLOWED_DOCUMENT_MIME.has("image/webp")).toBe(true);
    expect(ALLOWED_DOCUMENT_MIME.has("image/heic")).toBe(true);
  });

  it("rejects executable + svg mime types", () => {
    expect(ALLOWED_DOCUMENT_MIME.has("image/svg+xml")).toBe(false);
    expect(ALLOWED_DOCUMENT_MIME.has("application/octet-stream")).toBe(false);
    expect(ALLOWED_DOCUMENT_MIME.has("text/html")).toBe(false);
  });
});
