import { z } from "zod";
import { EXT_FONT_FORMAT } from "@/lib/media";

/**
 * The CMS-editable Arabic type stack.
 *
 * WHY THIS SHAPE
 * Every Arabic glyph the site draws already resolves through one variable —
 * `--bz-font-ar` in globals.css. That variable is now split into four
 * role variables (`--bz-font-ar-display`, `-body`, `-eyebrow`, `-mono`), each
 * defaulting to the shipped stack, and this module is what an operator's
 * uploads become: an `@font-face` block plus overrides for those four names,
 * emitted into the `<head>` of RTL pages by `app/[locale]/layout.tsx`.
 *
 * Nothing downstream learns that fonts are configurable. No component, no
 * Tailwind class and no other stylesheet rule changes — which is the whole
 * reason the indirection is worth having.
 *
 * `next/font` cannot do this job: it resolves faces at BUILD time from files in
 * the repo, and these arrive at runtime from Supabase Storage. So the
 * `@font-face` is hand-written, and `arabicFontCss` below is the only place in
 * the product that writes CSS from database values — which is why it sanitises
 * rather than escapes, and why it has its own test file.
 */

// ───────────────────────────────────────────────────────────────
// Roles
// ───────────────────────────────────────────────────────────────

/**
 * The four typographic roles an Arabic page has.
 *
 * Deliberately four and not forty. A role here has to correspond to a hook
 * that already exists in globals.css — `.serif`, `--bz-font-sans`, `.eyebrow`,
 * `.mono` — because a role with no hook is a promise the stylesheet cannot
 * keep. "H1" and "H2" are not separate roles for that reason: both are drawn
 * with `.serif` / `--bz-font-serif`, so a control that claimed to set them
 * apart would be lying about what it does.
 */
export const ARABIC_FONT_ROLES = [
  "display",
  "body",
  "eyebrow",
  "mono",
] as const;
export type ArabicFontRole = (typeof ARABIC_FONT_ROLES)[number];

/** The CSS custom property each role writes. */
export const ARABIC_ROLE_VAR: Record<ArabicFontRole, string> = {
  display: "--bz-font-ar-display",
  body: "--bz-font-ar-body",
  eyebrow: "--bz-font-ar-eyebrow",
  mono: "--bz-font-ar-mono",
};

/**
 * What the role variable falls back to when the operator has not assigned a
 * family — and, equally, what the custom family is layered in FRONT of, so a
 * face that 404s or covers only part of the alphabet degrades to the shipped
 * stack instead of to the browser's last-resort serif.
 *
 * `mono` is the odd one: `.mono` only ever carries prices, areas, dates and
 * reference codes, all of which are Latin-typeset, so its default is the Latin
 * JetBrains face and assigning an Arabic family to it is an opt-in.
 */
export const ARABIC_ROLE_FALLBACK: Record<ArabicFontRole, string> = {
  display: "var(--bz-font-ar)",
  body: "var(--bz-font-ar)",
  // An unset eyebrow follows body rather than the shipped stack: it is a UI
  // label, and a client who set a body face means it to cover labels too.
  eyebrow: "var(--bz-font-ar-body)",
  mono: "var(--bz-font-mono)",
};

export const ARABIC_ROLE_LABEL: Record<ArabicFontRole, string> = {
  display: "Headings & display",
  body: "Body & interface",
  eyebrow: "Eyebrow labels",
  mono: "Numbers & reference codes",
};

export const ARABIC_ROLE_DESCRIPTION: Record<ArabicFontRole, string> = {
  display:
    "Every h1 and h2, hero headlines, section titles, article headings and pull quotes — everything the English site sets in Instrument Serif.",
  body: "Paragraphs, navigation, buttons, form fields, cards, tables. The face most of the page is set in.",
  eyebrow:
    "The small uppercase labels above section headings. Follows the body face unless you set it apart.",
  mono: "Prices, areas, dates and reference codes. These stay Latin-typeset by default — only set this if your face draws Arabic-Indic numerals you want used.",
};

// ───────────────────────────────────────────────────────────────
// Weights
// ───────────────────────────────────────────────────────────────

/**
 * `variable` is not a CSS weight — it serialises to the `100 900` range that a
 * variable font's `@font-face` must declare, so the browser knows it may
 * interpolate rather than synthesising a fake bold from the 400 master.
 */
export const ARABIC_FONT_WEIGHTS = [
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "variable",
] as const;
export type ArabicFontWeight = (typeof ARABIC_FONT_WEIGHTS)[number];

export const ARABIC_WEIGHT_LABEL: Record<ArabicFontWeight, string> = {
  "100": "100 · Thin",
  "200": "200 · ExtraLight",
  "300": "300 · Light",
  "400": "400 · Regular",
  "500": "500 · Medium",
  "600": "600 · SemiBold",
  "700": "700 · Bold",
  "800": "800 · ExtraBold",
  "900": "900 · Black",
  variable: "Variable (100–900)",
};

/** What the weight becomes inside `@font-face`. */
export function cssWeight(weight: ArabicFontWeight): string {
  return weight === "variable" ? "100 900" : weight;
}

/**
 * Guess a file's weight from its name, so the operator corrects a dropdown
 * instead of filling one.
 *
 * Order matters — "extrabold" contains "bold", "semibold" contains "bold", and
 * "ultralight" contains "light", so the compound names have to be tested
 * first. Anything unrecognised lands on 400, which is the weight a lone file
 * dropped on its own almost always is.
 */
const WEIGHT_HINTS: ReadonlyArray<readonly [RegExp, ArabicFontWeight]> = [
  [/\b(vf|variable|var)\b|variablefont|\[wght\]/, "variable"],
  [/extrabold|ultrabold|extra-bold|ultra-bold/, "800"],
  [/semibold|demibold|semi-bold|demi-bold|\bdemi\b/, "600"],
  [/extralight|ultralight|extra-light|ultra-light/, "200"],
  [/\bblack\b|\bheavy\b|\bfat\b/, "900"],
  [/\bbold\b|\bbd\b/, "700"],
  [/\bmedium\b|\bmed\b/, "500"],
  [/\blight\b/, "300"],
  [/\bthin\b|\bhairline\b/, "100"],
  [/\bregular\b|\bnormal\b|\bbook\b|\broman\b/, "400"],
];

export function guessWeight(filename: string): ArabicFontWeight {
  // Separators become spaces so `\b` can see word edges inside
  // "IBMPlexSansArabic-SemiBold.woff2" style names.
  const hay = filename
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/[^a-z0-9[\]]+/g, " ");
  for (const [re, weight] of WEIGHT_HINTS) if (re.test(hay)) return weight;
  // A numeric weight written straight into the name — "Cairo-700.woff2".
  const numeric = hay.match(/\b([1-9]00)\b/);
  if (numeric) return numeric[1] as ArabicFontWeight;
  return "400";
}

/** Italic is rare in Arabic, but a dual-script family ships one for its Latin. */
export function guessStyle(filename: string): "normal" | "italic" {
  return /italic|oblique/i.test(filename) ? "italic" : "normal";
}

// ───────────────────────────────────────────────────────────────
// Schema
// ───────────────────────────────────────────────────────────────

const FONT_FORMATS = Object.values(EXT_FONT_FORMAT) as [string, ...string[]];

/**
 * A stored font URL.
 *
 * Stricter than the image-URL rule beside it, because this value is
 * interpolated into a stylesheet rather than into an `src` attribute: a `"`, a
 * `)`, a `;` or a newline would each close the `url()` early and let the rest
 * of the string be read as CSS. `new URL` normalises and percent-encodes, and
 * the character check refuses anything it left behind.
 */
const fontUrl = z
  .string()
  .trim()
  .min(1, "A font file is required.")
  .max(600)
  .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), {
    message: "Must be an https URL or a path beginning with /.",
  })
  .refine((v) => !/["'()\\;{}<>\s]/.test(v), {
    message: "That URL contains characters a stylesheet can't quote.",
  });

export const arabicFontFileSchema = z.object({
  url: fontUrl,
  filename: z.string().trim().min(1).max(200),
  format: z.enum(FONT_FORMATS),
  weight: z.enum(ARABIC_FONT_WEIGHTS),
  style: z.enum(["normal", "italic"]),
});
export type ArabicFontFile = z.infer<typeof arabicFontFileSchema>;

/**
 * `slug` is the identity the CSS uses — `font-family: "bzar-bukra"`.
 *
 * A separate field from `name` because `name` is the operator's label and can
 * be anything ("29LT Bukra — licensed"), while the slug has to survive being
 * written into a stylesheet unquoted-adjacent and matched by exact string.
 * Assigned once, at creation, and never recomputed: renaming a family in the
 * CMS must not silently orphan the `@font-face` the roles point at.
 */
export const arabicFontFamilySchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1, "Give the family a name.").max(60),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only."),
  files: z
    .array(arabicFontFileSchema)
    .min(1, "A family needs at least one font file.")
    .max(12, "Twelve files is plenty for one family."),
});
export type ArabicFontFamily = z.infer<typeof arabicFontFamilySchema>;

export const arabicFontSettingsSchema = z
  .object({
    /**
     * The kill switch. Off, the site renders the shipped stack and the uploads
     * stay where they are — so a client can try a face, dislike it on the live
     * site, and undo in one click without losing the files or the role
     * assignments they spent ten minutes on.
     */
    enabled: z.boolean().default(false),
    families: z.array(arabicFontFamilySchema).max(8).default([]),
    roles: z
      .object({
        display: z.string().nullable().default(null),
        body: z.string().nullable().default(null),
        eyebrow: z.string().nullable().default(null),
        mono: z.string().nullable().default(null),
      })
      .default({ display: null, body: null, eyebrow: null, mono: null }),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.families.map((f) => f.id));
    const slugs = new Set<string>();
    value.families.forEach((f, i) => {
      if (slugs.has(f.slug))
        ctx.addIssue({
          code: "custom",
          path: ["families", i, "slug"],
          message: `Two families are both called "${f.slug}".`,
        });
      slugs.add(f.slug);
    });
    // A role pointing at a family that was deleted would emit a
    // `font-family: "bzar-gone"` nothing declares, and the role would fall
    // through to the browser's default rather than to ours.
    for (const role of ARABIC_FONT_ROLES) {
      const assigned = value.roles[role];
      if (assigned && !ids.has(assigned))
        ctx.addIssue({
          code: "custom",
          path: ["roles", role],
          message: "That font family no longer exists.",
        });
    }
  });

export type ArabicFontSettings = z.infer<typeof arabicFontSettingsSchema>;

export const ARABIC_FONT_DEFAULTS: ArabicFontSettings = {
  enabled: false,
  families: [],
  roles: { display: null, body: null, eyebrow: null, mono: null },
};

/**
 * Read a stored bag, never throwing.
 *
 * Every failure — an unapplied migration, a revoked grant, a bag written by an
 * older shape, a family whose id no longer resolves — lands on the shipped
 * stack. `/ar` rendering in IBM Plex is a design regression somebody notices;
 * `/ar` rendering in Times New Roman because a jsonb key was renamed is a
 * broken site.
 */
export function parseArabicFonts(raw: unknown): ArabicFontSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return ARABIC_FONT_DEFAULTS;
  const parsed = arabicFontSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : ARABIC_FONT_DEFAULTS;
}

// ───────────────────────────────────────────────────────────────
// Serialisation
// ───────────────────────────────────────────────────────────────

/** A CMS-typed family name → the slug its `@font-face` is registered under. */
export function slugifyFamily(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    // Arabic and other non-Latin names slugify to nothing, which is fine —
    // `familySlug` below falls back to a positional slug rather than failing.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return base ? `bzar-${base}` : "";
}

/** A unique slug for a new family, given the ones already taken. */
export function familySlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugifyFamily(name) || "bzar-font";
  if (!used.has(base)) return base;
  for (let n = 2; n < 100; n += 1) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${used.size + 1}`;
}

/** The `font-family` value that names one uploaded family in CSS. */
export function familyRef(family: Pick<ArabicFontFamily, "slug">): string {
  return `"${family.slug}"`;
}

export type ArabicFontCss = {
  /** The stylesheet text, or "" when there is nothing to say. */
  css: string;
  /**
   * Faces worth a `<link rel="preload">` — the 400-weight woff2 of whatever
   * fills the body and display roles.
   *
   * Only those two, and only woff2. A preload tag is a blocking request the
   * browser makes before it knows whether the page needs the face, so
   * preloading nine weights costs more than the swap it avoids. Everything
   * else loads on demand, which for a weight used below the fold is free.
   */
  preload: string[];
};

const EMPTY_CSS: ArabicFontCss = { css: "", preload: [] };

/**
 * Settings → the `<style>` the layout puts in `<head>`.
 *
 * THIS FUNCTION WRITES CSS FROM DATABASE VALUES. The values are admin-authored
 * and the screen behind them is admin-only, so this is not a hostile input in
 * the usual sense — but "admin-only" has been the last line of defence in
 * enough incidents that it is not treated as one here. Every value that
 * reaches the output is either
 *
 *   · a slug matched against `^[a-z0-9-]+$` by the schema,
 *   · a keyword from a closed enum (weight, style, format), or
 *   · a URL that passed both the protocol check and the quote/paren/semicolon
 *     check in `fontUrl`,
 *
 * and the whole string is checked for `<` at the end, which is the character
 * that would be needed to close the `<style>` element early. A bag that fails
 * any of it produces no CSS at all rather than partial CSS — a page in the
 * shipped face is a design regression, a page with a half-written rule is a
 * broken layout.
 */
export function arabicFontCss(settings: ArabicFontSettings): ArabicFontCss {
  if (!settings.enabled) return EMPTY_CSS;

  const byId = new Map(settings.families.map((f) => [f.id, f]));
  const used = new Map<string, ArabicFontFamily>();
  const declarations: string[] = [];

  for (const role of ARABIC_FONT_ROLES) {
    const id = settings.roles[role];
    const family = id ? byId.get(id) : undefined;
    if (!family || family.files.length === 0) continue;
    used.set(family.id, family);
    declarations.push(
      `${ARABIC_ROLE_VAR[role]}:${familyRef(family)},${ARABIC_ROLE_FALLBACK[role]}`,
    );
  }

  if (declarations.length === 0) return EMPTY_CSS;

  const faces: string[] = [];
  const preload: string[] = [];
  for (const family of used.values()) {
    for (const file of family.files) {
      faces.push(
        `@font-face{` +
          `font-family:${familyRef(family)};` +
          `src:url("${file.url}") format("${file.format}");` +
          `font-weight:${cssWeight(file.weight)};` +
          `font-style:${file.style};` +
          // `swap`, not `optional`: an Arabic page whose face never arrives
          // renders in a system Naskh at a different weight and colour, which
          // reads as two different sites. A flash is cheaper than that.
          `font-display:swap` +
          `}`,
      );
    }
  }

  if (faces.length === 0) return EMPTY_CSS;

  for (const role of ["body", "display"] as const) {
    const id = settings.roles[role];
    const family = id ? byId.get(id) : undefined;
    const face = family?.files.find(
      (f) =>
        f.format === "woff2" &&
        f.style === "normal" &&
        (f.weight === "400" || f.weight === "variable"),
    );
    if (face && !preload.includes(face.url)) preload.push(face.url);
  }

  /*
   * `html:root`, not `:root`.
   *
   * globals.css declares the same four variables on a bare `:root` — the same
   * specificity — so which one wins would come down to source order, and the
   * order of an inline <style> against Next's injected stylesheet <link> is
   * not something a layout controls. `html:root` is (0,1,1) against (0,1,0)
   * and therefore wins whichever way the head is assembled.
   */
  const css = `${faces.join("")}html:root{${declarations.join(";")}}`;

  // The one character that could end the <style> element early. Nothing that
  // passed the schema can produce it; if something did, the page renders in
  // the shipped face rather than rendering markup as text.
  return css.includes("<") ? EMPTY_CSS : { css, preload };
}
