import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { isEnglishOnlyPath } from "@/lib/i18n/english-only";
import { localiseHref } from "@/lib/i18n/routing";
import { localiseDestination } from "@/lib/i18n/locale-redirects";
import { PREFS_COOKIE, encodePrefs, decodePrefs } from "@/lib/preferences/cookie";

/**
 * English-only paths (lib/i18n/english-only.ts): the CMS, and the mortgage
 * application flow until its Arabic is approved (D12).
 *
 * The three places that ask have to agree, or an Arabic-preferring visitor
 * loops: the proxy sends `/ar/mortgages/…` to English, so it must never send
 * `/mortgages/…` to Arabic, and no link or redirect may point at `/ar/mortgages`.
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
  it("knows the CMS and the mortgage flow, and nothing that merely starts like them", () => {
    expect(isEnglishOnlyPath("/admin")).toBe(true);
    expect(isEnglishOnlyPath("/admin/mortgages")).toBe(true);
    expect(isEnglishOnlyPath("/mortgages/apply")).toBe(true);
    expect(isEnglishOnlyPath("/mortgages/apply?service=pre_approval")).toBe(true);
    expect(isEnglishOnlyPath("/mortgages")).toBe(true);
    expect(isEnglishOnlyPath("/mortgages-guide")).toBe(false);
    expect(isEnglishOnlyPath("/administrative-areas")).toBe(false);
    expect(isEnglishOnlyPath("/tools/mortgage")).toBe(false);
  });

  it("sends /ar/mortgages back to English, keeping the entry link's query and saying it came from /ar", async () => {
    const res = await get("/ar/mortgages/apply?service=pre_approval&from=home");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://bazar.test/mortgages/apply?service=pre_approval&from=home&site=ar",
    );
  });

  it("still sends /ar/admin back to /admin", async () => {
    const res = await get("/ar/admin/enquiries");
    expect(res.headers.get("location")).toBe("https://bazar.test/admin/enquiries");
  });

  it("never sends an Arabic-preferring visitor from the flow to /ar", async () => {
    const res = await get("/mortgages/apply", arabicVisitor);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-test-passthrough")).toBe("1");
  });

  it("still sends an Arabic-preferring visitor to /ar everywhere else", async () => {
    const res = await get("/buy", arabicVisitor);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://bazar.test/ar/buy");
  });

  it("never prefixes a link to the flow from an Arabic page, but marks it as from the Arabic site", () => {
    expect(localiseHref("/mortgages/apply?service=pre_approval&from=home", "ar")).toBe(
      "/mortgages/apply?service=pre_approval&from=home&site=ar",
    );
    expect(localiseHref("/mortgages/apply", "ar")).toBe("/mortgages/apply?site=ar");
    expect(localiseHref("/mortgages/apply?site=en#top", "ar")).toBe("/mortgages/apply?site=ar#top");
    // English pages and the CMS are left as they are.
    expect(localiseHref("/mortgages/apply?service=pre_approval", "en")).toBe("/mortgages/apply?service=pre_approval");
    expect(localiseHref("/admin/enquiries", "ar")).toBe("/admin/enquiries");
    expect(localiseHref("/tools/mortgage", "ar")).toBe("/ar/tools/mortgage");
  });

  it("never gives a redirect's Arabic twin an /ar/mortgages destination", () => {
    expect(localiseDestination("/mortgages/apply", "ar")).toBe("/mortgages/apply");
    expect(localiseDestination("/tools/mortgage", "ar")).toBe("/ar/tools/mortgage");
  });
});
