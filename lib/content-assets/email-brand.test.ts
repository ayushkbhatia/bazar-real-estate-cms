import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  DEFAULT_EMAIL_BRAND,
  emailBrandSchema,
  logoWarning,
  resolveEmailBrand,
} from "./email-brand";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("resolveEmailBrand", () => {
  it("resolves nothing stored to the original design", () => {
    expect(resolveEmailBrand({})).toEqual(DEFAULT_EMAIL_BRAND);
    expect(resolveEmailBrand(null)).toEqual(DEFAULT_EMAIL_BRAND);
    expect(resolveEmailBrand([])).toEqual(DEFAULT_EMAIL_BRAND);
  });

  it("applies valid overrides and ignores each invalid one on its own", () => {
    const out = resolveEmailBrand({
      buttonColor: "#005777",
      linkColor: "red", // not a hex colour — dropped, the rest survive
      footerText: "Line one\nLine two",
      logoWidth: 9999,
    });
    expect(out.buttonColor).toBe("#005777");
    expect(out.linkColor).toBe(DEFAULT_EMAIL_BRAND.linkColor);
    expect(out.footerText).toBe("Line one\nLine two");
    expect(out.logoWidth).toBe(DEFAULT_EMAIL_BRAND.logoWidth);
  });

  it("treats a blank value as 'use the default'", () => {
    expect(resolveEmailBrand({ wordmark: "" }).wordmark).toBe("Bazar");
  });

  it("falls back to the wordmark when the logo style has no logo", () => {
    expect(resolveEmailBrand({ headerStyle: "logo" }).headerStyle).toBe("wordmark");
    expect(
      resolveEmailBrand({ headerStyle: "logo", logoMediaKey: "brand/a-logo.png" }).headerStyle,
    ).toBe("logo");
  });

  it("refuses a logo key that could point outside the media library", () => {
    expect(resolveEmailBrand({ logoMediaKey: "../../etc/passwd" }).logoMediaKey).toBeNull();
    expect(resolveEmailBrand({ logoUrl: "javascript:alert(1)" }).logoUrl).toBeNull();
  });
});

describe("emailBrandSchema", () => {
  it("names the field a bad colour is in", () => {
    const r = emailBrandSchema.safeParse({ buttonColor: "#12" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["buttonColor"]);
  });
});

describe("logoWarning", () => {
  it("warns about SVG, which Gmail and Outlook don't render", () => {
    expect(logoWarning("https://x.test/logo.svg")).toMatch(/SVG/);
    expect(logoWarning("https://x.test/logo.png")).toBeNull();
    expect(logoWarning(null)).toBeNull();
  });
});

describe("the shell with the default design", () => {
  it("still looks exactly like the emails did before the design page", async () => {
    vi.resetModules();
    const { emailShell } = await import("@/lib/email-templates");
    const html = emailShell("<p>Body</p>");
    expect(html).toContain("background:#FAFAF6");
    expect(html).toContain(
      'font-family:Georgia,serif;font-style:italic;font-size:22px;letter-spacing:-0.01em;margin-bottom:24px;color:#1B1A17;text-align:left">Bazar <span',
    );
    expect(html).toContain("· Abu Dhabi</span>");
    expect(html).toContain("Bazar Real Estate Brokerage LLC · ORN 28041 · Abu Dhabi, UAE");
    expect(html).toContain('<a href="https://bazar.example" style="color:#99896e">bazar.ae</a>');
  });

  it("draws a logo header, escaped, from the media key", async () => {
    vi.resetModules();
    const { emailShell } = await import("@/lib/email-templates");
    const html = emailShell("<p>Body</p>", {
      ...DEFAULT_EMAIL_BRAND,
      headerStyle: "logo",
      logoMediaKey: "brand/abc-logo.png",
      logoAlt: 'Bazar "Real" Estate',
      logoWidth: 160,
      headerAlign: "center",
    });
    expect(html).toContain(
      'src="https://proj.supabase.co/storage/v1/object/public/media/brand/abc-logo.png"',
    );
    expect(html).toContain('alt="Bazar &quot;Real&quot; Estate"');
    expect(html).toContain('width="160"');
    expect(html).toContain("text-align:center");
    expect(html).not.toContain("font-style:italic;font-size:22px");
  });

  it("puts each footer line on its own line, escaped", async () => {
    vi.resetModules();
    const { emailShell } = await import("@/lib/email-templates");
    const html = emailShell("", {
      ...DEFAULT_EMAIL_BRAND,
      footerText: "Bazar <LLC>\nORN 1",
    });
    expect(html).toContain("Bazar &lt;LLC&gt;<br>ORN 1<br>");
  });
});
