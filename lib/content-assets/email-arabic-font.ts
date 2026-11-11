/**
 * The Arabic face an email is set in: the site's own.
 *
 * The site's Arabic is CMS-chosen (/admin/settings/typography): the client
 * uploaded 29LT Bukra and assigned it to body and headings. Emails hard-coded
 * IBM Plex Sans Arabic, so every Arabic newsletter read in a different face
 * from the site it links to (client, Nov 2026).
 *
 * This turns those settings into what an email needs: `@font-face` rules for
 * the head, and a font stack for body and headings that names the uploaded
 * family first and the old stack after it. Apple Mail, iOS Mail and Outlook
 * for Mac draw the uploaded face; Gmail and Outlook for Windows ignore
 * `@font-face` in every email and fall back down the stack, as they did
 * before — the stack only ever adds a face in front.
 *
 * With the typography switch off, or nothing assigned, it is exactly the
 * stack emails always used.
 *
 * Pure module.
 */

import type { ArabicFontFamily, ArabicFontSettings } from "@/lib/schemas/arabic-fonts";

/** The family's CSS name, single-quoted: it goes inside inline `style="…"` attributes. */
const ref = (f: Pick<ArabicFontFamily, "slug">) => `'${f.slug}'`;

/** What every Arabic email used before, and still falls back to. */
export const EMAIL_AR_FALLBACK =
  "'IBM Plex Sans Arabic','Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif";

export type EmailArabicFont = {
  /** `font-family` for running text. */
  body: string;
  /** `font-family` for headings and the wordmark. */
  heading: string;
  /** Headings' weight — the site's own when the CMS pins one, else 700. */
  headingWeight: number;
  /** What goes in <head>: @font-face rules, or the IBM Plex stylesheet link. */
  head: string;
};

export const BUILT_IN_EMAIL_ARABIC_FONT: EmailArabicFont = {
  body: EMAIL_AR_FALLBACK,
  heading: EMAIL_AR_FALLBACK,
  headingWeight: 700,
  head: '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">',
};

function faces(family: ArabicFontFamily): string {
  return family.files
    .map(
      (f) =>
        `@font-face{font-family:${ref(family)};src:url('${f.url}') format('${f.format}');font-weight:${f.weight};font-style:${f.style};font-display:swap}`,
    )
    .join("");
}

/** The site's typography settings → an email's Arabic face. */
export function emailArabicFont(settings: ArabicFontSettings | null | undefined): EmailArabicFont {
  if (!settings?.enabled) return BUILT_IN_EMAIL_ARABIC_FONT;
  const byId = new Map(settings.families.map((f) => [f.id, f]));
  const body = settings.roles.body ? byId.get(settings.roles.body) : undefined;
  const display = settings.roles.display ? byId.get(settings.roles.display) : undefined;
  if (!body?.files.length && !display?.files.length) return BUILT_IN_EMAIL_ARABIC_FONT;

  const used = new Map<string, ArabicFontFamily>();
  for (const f of [body, display]) if (f?.files.length) used.set(f.id, f);
  const stack = (f: ArabicFontFamily | undefined) =>
    f?.files.length ? `${ref(f)},${EMAIL_AR_FALLBACK}` : EMAIL_AR_FALLBACK;
  const pinned = Number(settings.weights?.display);

  return {
    body: stack(body),
    heading: stack(display ?? body),
    headingWeight: Number.isFinite(pinned) && pinned > 0 ? pinned : 700,
    head: `<style>${[...used.values()].map(faces).join("")}</style>`,
  };
}

/**
 * A brand as read for a send: the stored email design plus the site's Arabic
 * face (`readEmailBrand` attaches it). Not part of the stored design, so it
 * is read with this rather than typed onto EmailBrand.
 */
export function brandArabicFont(brand: object | null | undefined): EmailArabicFont {
  const f = (brand as { arabicFont?: EmailArabicFont } | null | undefined)?.arabicFont;
  return f ?? BUILT_IN_EMAIL_ARABIC_FONT;
}
