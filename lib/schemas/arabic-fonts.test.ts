import { describe, expect, it } from "vitest";
import {
  ARABIC_FONT_DEFAULTS,
  arabicFontCss,
  arabicFontSettingsSchema,
  familySlug,
  guessStyle,
  guessWeight,
  parseArabicFonts,
  slugifyFamily,
  type ArabicFontFile,
  type ArabicFontSettings,
} from "./arabic-fonts";

/**
 * `arabicFontCss` is the only place in the product that writes CSS from
 * database values, and its output goes into a `<style>` via
 * `dangerouslySetInnerHTML`. So the tests that matter here are the ones that
 * prove a bad bag produces NO css rather than partial css.
 */

const file = (over: Partial<ArabicFontFile> = {}): ArabicFontFile => ({
  url: "https://cdn.example.com/fonts/bukra-regular.woff2",
  filename: "bukra-regular.woff2",
  format: "woff2",
  weight: "400",
  style: "normal",
  ...over,
});

const settings = (over: Partial<ArabicFontSettings> = {}): ArabicFontSettings =>
  arabicFontSettingsSchema.parse({
    enabled: true,
    families: [
      { id: "fam-1", name: "Bukra", slug: "bzar-bukra", files: [file()] },
    ],
    roles: { display: "fam-1", body: "fam-1", eyebrow: null, mono: null },
    ...over,
  });

describe("parseArabicFonts", () => {
  it("answers with the shipped stack for anything unreadable", () => {
    for (const bad of [null, undefined, 42, "{}", [], { families: 3 }])
      expect(parseArabicFonts(bad)).toEqual(ARABIC_FONT_DEFAULTS);
  });

  it("fills every key from an empty bag, which is the column default", () => {
    expect(parseArabicFonts({})).toEqual(ARABIC_FONT_DEFAULTS);
  });

  it("keeps a bag written before a key existed", () => {
    const parsed = parseArabicFonts({
      families: [
        { id: "a", name: "Cairo", slug: "bzar-cairo", files: [file()] },
      ],
    });
    expect(parsed.enabled).toBe(false);
    expect(parsed.roles).toEqual({
      display: null,
      body: null,
      eyebrow: null,
      mono: null,
    });
  });
});

describe("arabicFontSettingsSchema", () => {
  it("refuses a role pointing at a family that is gone", () => {
    const result = arabicFontSettingsSchema.safeParse({
      enabled: true,
      families: [],
      roles: { display: "ghost", body: null, eyebrow: null, mono: null },
    });
    expect(result.success).toBe(false);
  });

  it("refuses two families sharing a slug", () => {
    const result = arabicFontSettingsSchema.safeParse({
      enabled: true,
      families: [
        { id: "a", name: "One", slug: "bzar-x", files: [file()] },
        { id: "b", name: "Two", slug: "bzar-x", files: [file()] },
      ],
      roles: { display: null, body: null, eyebrow: null, mono: null },
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ['javascript:alert(1)', "not http(s)"],
    ['https://a.com/x.woff2") format("woff2");}html{display:none', "quote escape"],
    ["https://a.com/a b.woff2", "whitespace"],
    ["https://a.com/x.woff2;", "semicolon"],
  ])("refuses the url %s (%s)", (url) => {
    const result = arabicFontSettingsSchema.safeParse({
      enabled: true,
      families: [
        { id: "a", name: "X", slug: "bzar-x", files: [{ ...file(), url }] },
      ],
      roles: { display: "a", body: null, eyebrow: null, mono: null },
    });
    expect(result.success).toBe(false);
  });
});

describe("arabicFontCss", () => {
  it("emits nothing while disabled, however complete the bag is", () => {
    expect(arabicFontCss(settings({ enabled: false }))).toEqual({
      css: "",
      preload: [],
    });
  });

  it("emits nothing when no role is assigned", () => {
    expect(
      arabicFontCss(
        settings({
          roles: { display: null, body: null, eyebrow: null, mono: null },
        }),
      ).css,
    ).toBe("");
  });

  it("declares the face and both role variables", () => {
    const { css } = arabicFontCss(settings());
    expect(css).toContain('@font-face{font-family:"bzar-bukra"');
    expect(css).toContain(
      'src:url("https://cdn.example.com/fonts/bukra-regular.woff2") format("woff2")',
    );
    expect(css).toContain("font-display:swap");
    expect(css).toContain("--bz-font-ar-display:\"bzar-bukra\",var(--bz-font-ar)");
    expect(css).toContain("--bz-font-ar-body:\"bzar-bukra\",var(--bz-font-ar)");
  });

  it("wins on specificity rather than on source order", () => {
    // globals.css declares the same variables on a bare `:root`. If this rule
    // were also `:root` the winner would depend on where Next put the inline
    // <style>, which a layout does not control.
    expect(arabicFontCss(settings()).css).toContain("html:root{");
    expect(arabicFontCss(settings()).css).not.toContain("}:root{");
  });

  it("layers the custom family in front of the shipped stack, never instead of it", () => {
    // A face that 404s, or one that covers Arabic but not the Latin runs
    // beside it, has to fall back to IBM Plex rather than to Times.
    const { css } = arabicFontCss(settings());
    expect(css).toMatch(/--bz-font-ar-display:"bzar-bukra",var\(--bz-font-ar\)/);
  });

  it("leaves mono on the Latin face unless it is assigned", () => {
    const { css } = arabicFontCss(settings());
    expect(css).not.toContain("--bz-font-ar-mono");
  });

  it("does not declare a family no role uses", () => {
    const { css } = arabicFontCss(
      settings({
        families: [
          { id: "fam-1", name: "Bukra", slug: "bzar-bukra", files: [file()] },
          {
            id: "fam-2",
            name: "Idle",
            slug: "bzar-idle",
            files: [file({ filename: "idle.woff2" })],
          },
        ],
      }),
    );
    expect(css).toContain("bzar-bukra");
    expect(css).not.toContain("bzar-idle");
  });

  it("declares a family once even when it fills two roles", () => {
    const { css } = arabicFontCss(settings());
    expect(css.match(/@font-face\{/g)).toHaveLength(1);
  });

  it("serialises a variable font as a weight range", () => {
    const { css } = arabicFontCss(
      settings({
        families: [
          {
            id: "fam-1",
            name: "Cairo",
            slug: "bzar-cairo",
            files: [file({ weight: "variable" })],
          },
        ],
      }),
    );
    expect(css).toContain("font-weight:100 900");
  });

  it("preloads only the woff2 400 of body and display, once", () => {
    const { preload } = arabicFontCss(
      settings({
        families: [
          {
            id: "fam-1",
            name: "Bukra",
            slug: "bzar-bukra",
            files: [
              file(),
              file({ filename: "bukra-bold.woff2", weight: "700" }),
              file({
                url: "https://cdn.example.com/fonts/bukra.otf",
                filename: "bukra.otf",
                format: "opentype",
              }),
            ],
          },
        ],
      }),
    );
    expect(preload).toEqual([
      "https://cdn.example.com/fonts/bukra-regular.woff2",
    ]);
  });

  it("preloads nothing when the assigned face has no woff2 400", () => {
    const { preload } = arabicFontCss(
      settings({
        families: [
          {
            id: "fam-1",
            name: "Bukra",
            slug: "bzar-bukra",
            files: [file({ format: "opentype", filename: "bukra.otf" })],
          },
        ],
      }),
    );
    expect(preload).toEqual([]);
  });

  it("emits nothing at all rather than markup, if a `<` ever survives", () => {
    // Unreachable through the schema — the slug regex and the url check both
    // refuse it — so this asserts the last guard by bypassing them.
    const hostile = {
      enabled: true,
      families: [
        {
          id: "a",
          name: "x",
          slug: '</style><script>alert(1)</script>',
          files: [file()],
        },
      ],
      roles: { display: "a", body: null, eyebrow: null, mono: null },
    } as unknown as ArabicFontSettings;
    expect(arabicFontCss(hostile)).toEqual({ css: "", preload: [] });
  });
});

describe("slugs", () => {
  it("prefixes so a family can never collide with a real font name", () => {
    expect(slugifyFamily("29LT Bukra")).toBe("bzar-29lt-bukra");
  });

  it("falls back rather than emitting an empty family name", () => {
    expect(familySlug("خط عربي", [])).toBe("bzar-font");
  });

  it("disambiguates a repeat", () => {
    expect(familySlug("Bukra", ["bzar-bukra"])).toBe("bzar-bukra-2");
    expect(familySlug("Bukra", ["bzar-bukra", "bzar-bukra-2"])).toBe(
      "bzar-bukra-3",
    );
  });
});

describe("guessWeight", () => {
  it.each([
    ["IBMPlexSansArabic-Regular.woff2", "400"],
    ["IBMPlexSansArabic-SemiBold.woff2", "600"],
    ["IBMPlexSansArabic-ExtraBold.woff2", "800"],
    ["bukra-bold.woff2", "700"],
    ["Cairo-Light.ttf", "300"],
    ["Cairo-ExtraLight.ttf", "200"],
    ["Tajawal-Black.otf", "900"],
    ["Almarai-Medium.woff2", "500"],
    ["NotoKufiArabic-Thin.woff2", "100"],
    ["Cairo-700.woff2", "700"],
    ["Cairo[wght].woff2", "variable"],
    ["Rubik-VariableFont_wght.ttf", "variable"],
    ["some-face.woff2", "400"],
  ])("reads %s as %s", (filename, expected) => {
    expect(guessWeight(filename)).toBe(expected);
  });

  it("prefers the compound name over the substring inside it", () => {
    // "extrabold" contains "bold"; the order of WEIGHT_HINTS is what stops
    // this being 700.
    expect(guessWeight("Foo-ExtraBold.woff2")).toBe("800");
    expect(guessWeight("Foo-SemiBold.woff2")).toBe("600");
    expect(guessWeight("Foo-UltraLight.woff2")).toBe("200");
  });
});

describe("guessStyle", () => {
  it("reads italic and oblique, and nothing else", () => {
    expect(guessStyle("Plex-Italic.woff2")).toBe("italic");
    expect(guessStyle("Plex-BoldOblique.otf")).toBe("italic");
    expect(guessStyle("Plex-Regular.woff2")).toBe("normal");
  });
});
