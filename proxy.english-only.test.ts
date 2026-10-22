import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { isEnglishOnlyPath } from "@/lib/i18n/english-only";
import { localiseHref } from "@/lib/i18n/routing";
import { localiseDestination } from "@/lib/i18n/locale-redirects";
import { PREFS_COOKIE, encodePrefs, decodePrefs } from "@/lib/preferences/cookie";

/**
 * English-only paths (lib/i18n/english-only.ts): the CMS. The mortgage
 * application flow left the list when its Arabic launched (D12), so it is now
 * served like any other public page — and the tests below hold that, too.
 *
 * The three places that ask have to agree, or an Arabic-preferring visitor
 * loops: the proxy sends `/ar/admin/…` to English, so it must never send
 * `/admin/…` to Arabic, and no link or redirect may point at `/ar/admin`.
 */

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(() => {
    const res = NextResponse.next();
    res.headers.set("x-test-passthrough", "1");
    return res;
  }),
}));

const { proxy } = await import("./proxy");

function get(url: string, cookie?: string) {
  const req = new NextRequest(new URL(url, "https://bazar.test"));
  if (cookie) req.cookies.set(PREFS_COOKIE, cookie);
  return proxy(req);
}

const arabicVisitor = encodePrefs({ ...decodePrefs(undefined), locale: "ar" });

describe("English-only paths", () => {
  it("knows the CMS, and nothing that merely starts like it", () => {
    expect(isEnglishOnlyPath("/admin")).toBe(true);
    expect(isEnglishOnlyPath("/admin/mortgages")).toBe(true);
    expect(isEnglishOnlyPath("/admin/enquiries?x=1")).toBe(true);
    expect(isEnglishOnlyPath("/administrative-areas")).toBe(false);
    expect(isEnglishOnlyPath("/tools/mortgage")).toBe(false);
  });

  it("sends /ar/admin back to /admin, keeping the query", async () => {
    const res = await get("/ar/admin/enquiries?status=new");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://bazar.test/admin/enquiries?status=new");
  });

  it("never sends an Arabic-preferring visitor from the CMS to /ar", async () => {
    const res = await get("/admin/enquiries", arabicVisitor);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-test-passthrough")).toBe("1");
  });

  it("still sends an Arabic-preferring visitor to /ar everywhere else", async () => {
    const res = await get("/buy", arabicVisitor);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://bazar.test/ar/buy");
  });

  it("never prefixes a link to the CMS from an Arabic page", () => {
    expect(localiseHref("/admin/enquiries", "ar")).toBe("/admin/enquiries");
    expect(localiseDestination("/admin/login", "ar")).toBe("/admin/login");
  });
});

describe("the mortgage flow, since its Arabic launched (D12)", () => {
  it("is not English-only", () => {
    expect(isEnglishOnlyPath("/mortgages")).toBe(false);
    expect(isEnglishOnlyPath("/mortgages/apply?service=pre_approval")).toBe(false);
    expect(isEnglishOnlyPath("/mortgages/r/abc")).toBe(false);
  });

  it("serves /ar/mortgages in Arabic rather than sending it to English", async () => {
    const res = await get("/ar/mortgages/apply?service=pre_approval&from=home");
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends an Arabic-preferring visitor from the English flow to the Arabic one, query and all", async () => {
    const res = await get("/mortgages/apply?service=pre_approval&from=home", arabicVisitor);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://bazar.test/ar/mortgages/apply?service=pre_approval&from=home");
  });

  it("prefixes a link to the flow from an Arabic page, and leaves an English one alone", () => {
    expect(localiseHref("/mortgages/apply?service=pre_approval&from=home", "ar")).toBe(
      "/ar/mortgages/apply?service=pre_approval&from=home",
    );
    expect(localiseHref("/mortgages/apply", "ar")).toBe("/ar/mortgages/apply");
    expect(localiseHref("/mortgages/apply?service=pre_approval", "en")).toBe("/mortgages/apply?service=pre_approval");
    expect(localiseHref("/tools/mortgage", "ar")).toBe("/ar/tools/mortgage");
  });

  it("gives a redirect into the flow an Arabic twin", () => {
    expect(localiseDestination("/mortgages/apply", "ar")).toBe("/ar/mortgages/apply");
  });
});
