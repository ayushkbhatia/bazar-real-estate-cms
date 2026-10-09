import { beforeEach, describe, expect, it } from "vitest";
import {
  afterSubmit,
  applyEntry,
  freshState,
  guardRedirect,
  parseEntryParams,
  returnPathFrom,
  siteLocaleFromReferrer,
  STORE_KEY,
  type ApplyState,
} from "./apply-state";
import { getApplyState, resetStoreCache, setApplyState } from "./apply-store";

const complete: ApplyState["details"] = {
  residency: "uae_national",
  employmentType: "salaried",
  fullName: "Ahmed Al Suwaidi",
  dateOfBirth: "02 / 11 / 1986",
  mobileNational: "50 774 1290",
  email: "ahmed.suwaidi@outlook.com",
};

describe("entry links", () => {
  const parse = (q: string) => parseEntryParams(new URLSearchParams(q));

  it("reads each of the five entry links (SPEC §4.1)", () => {
    expect(parse("service=pre_approval&from=home")).toEqual({ service: "pre_approval", entryPoint: "home" });
    expect(parse("service=pre_approval&from=calculator_preapproval")).toEqual({
      service: "pre_approval",
      entryPoint: "calculator_preapproval",
    });
    expect(parse("service=pre_approval&from=property_detail&property=BAZ-AD-04891")).toEqual({
      service: "pre_approval",
      entryPoint: "property_detail",
      propertyRef: "BAZ-AD-04891",
    });
    expect(parse("service=consultancy&from=calculator_advisor")).toEqual({
      service: "consultancy",
      entryPoint: "calculator_advisor",
    });
    expect(parse("service=consultancy&from=services_menu")).toEqual({
      service: "consultancy",
      entryPoint: "services_menu",
    });
  });

  it("ignores an unknown service, and files an unknown source as direct", () => {
    expect(parse("service=remortgage&from=newsletter")).toEqual({ entryPoint: "direct" });
    expect(parse("")).toEqual({});
    expect(parse("property=<script>")).toEqual({});
  });

  it("lets the link win over what the tab remembered", () => {
    const remembered = { ...freshState(), service: "consultancy" as const, entryPoint: "home" as const };
    expect(applyEntry(remembered, { service: "pre_approval", entryPoint: "property_detail", propertyRef: "BAZ-1" }))
      .toMatchObject({ service: "pre_approval", entryPoint: "property_detail", propertyRef: "BAZ-1" });
    // No link: keep what was chosen.
    expect(applyEntry(remembered, {}).service).toBe("consultancy");
  });

  it("remembers only same-site pages outside the flow as the way back", () => {
    const origin = "https://www.bazarrealestate.ae";
    expect(returnPathFrom(`${origin}/p/marina-heights?x=1`, origin)).toBe("/p/marina-heights?x=1");
    expect(returnPathFrom(`${origin}/mortgages/apply/details`, origin)).toBeUndefined();
    expect(returnPathFrom("https://elsewhere.test/page", origin)).toBeUndefined();
    expect(returnPathFrom("", origin)).toBeUndefined();
  });
});

describe("which website the applicant came from (0155)", () => {
  const parse = (q: string) => parseEntryParams(new URLSearchParams(q));
  const origin = "https://www.bazarrealestate.ae";

  it("reads site=ar or site=en from the entry link, and ignores anything else", () => {
    expect(parse("service=pre_approval&from=home&site=ar")).toEqual({
      service: "pre_approval",
      entryPoint: "home",
      siteLocale: "ar",
    });
    expect(parse("site=en")).toEqual({ siteLocale: "en" });
    expect(parse("site=fr")).toEqual({});
  });

  it("reads an /ar referrer on this site as the Arabic site", () => {
    expect(siteLocaleFromReferrer(`${origin}/ar/tools/mortgage`, origin)).toBe("ar");
    expect(siteLocaleFromReferrer(`${origin}/ar`, origin)).toBe("ar");
    expect(siteLocaleFromReferrer(`${origin}/areas/al-reem`, origin)).toBe("en");
    expect(siteLocaleFromReferrer(`${origin}/tools/mortgage`, origin)).toBe("en");
    expect(siteLocaleFromReferrer(`${origin}/mortgages/apply/details`, origin)).toBeUndefined();
    expect(siteLocaleFromReferrer("https://www.google.com/", origin)).toBeUndefined();
    expect(siteLocaleFromReferrer("", origin)).toBeUndefined();
  });

  it("lets the link's site win over the referrer, and keeps what the tab knew when neither says", () => {
    const fresh = freshState();
    expect(applyEntry(fresh, { siteLocale: "ar" }, undefined, "en").siteLocale).toBe("ar");
    expect(applyEntry(fresh, {}, undefined, "ar").siteLocale).toBe("ar");
    expect(applyEntry({ ...fresh, siteLocale: "ar" }, {}).siteLocale).toBe("ar");
    expect(applyEntry(fresh, {}).siteLocale).toBeUndefined();
  });
});

describe("guards", () => {
  const base = freshState();

  it("sends everyone without a service to W1", () => {
    expect(guardRedirect(base, "details")).toBe("/mortgages/apply");
    expect(guardRedirect(base, "documents")).toBe("/mortgages/apply");
  });

  it("sends incomplete details back to W2", () => {
    expect(guardRedirect({ ...base, service: "consultancy" }, "review")).toBe("/mortgages/apply/details");
  });

  it("keeps each service on its own last step", () => {
    const consult = { ...base, service: "consultancy" as const, details: complete };
    const pre = { ...base, service: "pre_approval" as const, details: complete };
    expect(guardRedirect(consult, "review")).toBeNull();
    expect(guardRedirect(consult, "documents")).toBe("/mortgages/apply/review");
    expect(guardRedirect(pre, "documents")).toBeNull();
    expect(guardRedirect(pre, "review")).toBe("/mortgages/apply/documents");
  });

  it("shows the received page only after a submit", () => {
    expect(guardRedirect(base, "received")).toBe("/mortgages/apply");
  });

  it("sends every step to the confirmation once submitted, so Back can't resubmit", () => {
    const after = afterSubmit({ ...base, service: "consultancy", details: complete }, {
      reference: "BZM-26-0415",
      service: "consultancy",
      submittedAt: "2026-09-22T05:47:00Z",
      dueAt: null,
      residency: "uae_national",
      employmentType: "salaried",
      mobile: "+971507741290",
      email: "a@b.co",
    });
    expect(guardRedirect(after, "review")).toBe("/mortgages/apply/received");
    expect(guardRedirect(after, "documents")).toBe("/mortgages/apply/received");
    expect(guardRedirect(after, "received")).toBeNull();
    // W1 always opens, and choosing again starts a new application.
    expect(guardRedirect(after, "service")).toBeNull();
    expect(guardRedirect({ ...after, service: "pre_approval" }, "details")).toBeNull();
  });
});

describe("the store", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetStoreCache();
  });

  it("survives a reload in the same tab", () => {
    setApplyState((s) => ({ ...s, service: "pre_approval", details: complete }));
    resetStoreCache();
    expect(getApplyState()).toMatchObject({ service: "pre_approval", details: complete });
  });

  it("starts fresh from a damaged or foreign value", () => {
    window.sessionStorage.setItem(STORE_KEY, "{not json");
    expect(getApplyState().v).toBe(1);
    resetStoreCache();
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ v: 2 }));
    expect(getApplyState().details).toEqual({});
  });

  it("keeps only the summary after a submit, with a new retry key", () => {
    const before = { ...freshState(), service: "consultancy" as const, details: complete, consent: true };
    const after = afterSubmit(before, {
      reference: "BZM-26-0415",
      service: "consultancy",
      submittedAt: "2026-09-22T05:47:00Z",
      dueAt: null,
      residency: "uae_national",
      employmentType: "salaried",
      mobile: "+971507741290",
      email: "ahmed.suwaidi@outlook.com",
    });
    expect(after.details).toEqual({});
    expect(after.service).toBeUndefined();
    expect(after.consent).toBe(false);
    expect(after.idempotencyKey).not.toBe(before.idempotencyKey);
    expect(after.submitted?.reference).toBe("BZM-26-0415");
  });
});
